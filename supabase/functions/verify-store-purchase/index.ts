import { appleRevenue, googleOrderRevenue, saveRevenue } from '../_shared/revenue.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const encoder = new TextEncoder()

type VerifiedPurchase = {
  revenue?: Record<string, any> | null
  provider: 'apple' | 'google'
  productId: string
  transactionId: string
  originalTransactionId: string | null
  environment: 'sandbox' | 'production'
  purchasedAt: string
  expiresAt: string | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'authentication_required' }, 401)

    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const publishableKey = requiredEnv('SUPABASE_ANON_KEY')
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'invalid_session' }, 401)

    const body = await request.json().catch(() => ({}))
    const productId = String(body?.productId ?? '').trim()
    const source = String(body?.source ?? '').trim().toLowerCase()
    const purchaseId = String(body?.purchaseId ?? '').trim()
    const verificationData = String(body?.verificationData ?? '').trim()
    if (!productId || !verificationData) {
      return json({ error: 'purchase_data_required' }, 400)
    }

    const { data: product, error: productError } = await adminClient
      .from('store_products')
      .select('product_id,kind')
      .eq('product_id', productId)
      .eq('kind', 'subscription')
      .eq('is_active', true)
      .single()
    if (productError || !product) return json({ error: 'unknown_product' }, 400)

    const verified = source.includes('google')
      ? await verifyGooglePurchase(productId, product.kind, verificationData)
      : await verifyApplePurchase(productId, purchaseId)

    const { data: applied, error: applyError } = await adminClient.rpc(
      'apply_verified_store_purchase',
      {
        p_user_id: userData.user.id,
        p_provider: verified.provider,
        p_product_id: verified.productId,
        p_transaction_id: verified.transactionId,
        p_original_transaction_id: verified.originalTransactionId,
        p_environment: verified.environment,
        p_purchased_at: verified.purchasedAt,
        p_expires_at: verified.expiresAt,
      },
    )
    if (applyError) throw applyError
    await saveRevenue(adminClient, verified.provider, verified.transactionId, verified.revenue)
    return json({ verified: true, ...applied })
  } catch (error) {
    console.error('verify-store-purchase failed', safeError(error))
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('_missing')) return json({ error: 'store_verifier_not_configured' }, 503)
    if (message.startsWith('invalid_') || message.includes('not_active')) {
      return json({ error: 'purchase_verification_failed' }, 400)
    }
    return json({ error: 'purchase_verification_unavailable' }, 502)
  }
})

async function verifyApplePurchase(productId: string, purchaseId: string): Promise<VerifiedPurchase> {
  if (!/^\d+$/.test(purchaseId)) throw new Error('invalid_apple_transaction')
  const bundleId = requiredEnv('APPLE_IAP_BUNDLE_ID')
  const token = await appleApiToken(bundleId)
  let response = await fetchAppleTransaction(
    'https://api.storekit.itunes.apple.com',
    purchaseId,
    token,
  )
  let environment: 'sandbox' | 'production' = 'production'
  if (response.status === 404) {
    response = await fetchAppleTransaction(
      'https://api.storekit-sandbox.itunes.apple.com',
      purchaseId,
      token,
    )
    environment = 'sandbox'
  }
  if (!response.ok) throw new Error(`invalid_apple_response_${response.status}`)
  const result = await response.json()
  const transaction = decodeJwtPayload(String(result?.signedTransactionInfo ?? ''))
  if (transaction.bundleId !== bundleId || transaction.productId !== productId) {
    throw new Error('invalid_apple_product')
  }
  if (String(transaction.transactionId ?? '') !== purchaseId || transaction.revocationDate) {
    throw new Error('invalid_apple_transaction')
  }
  const purchasedAt = dateFromMilliseconds(transaction.purchaseDate)
  const expiresAt = transaction.expiresDate == null
    ? null
    : dateFromMilliseconds(transaction.expiresDate)
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw new Error('subscription_not_active')
  return {
    provider: 'apple',
    revenue: appleRevenue(transaction),
    productId,
    transactionId: purchaseId,
    originalTransactionId: transaction.originalTransactionId
      ? String(transaction.originalTransactionId)
      : null,
    environment,
    purchasedAt,
    expiresAt,
  }
}

async function fetchAppleTransaction(baseUrl: string, transactionId: string, token: string) {
  return await fetch(`${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
}

async function appleApiToken(bundleId: string) {
  const issuerId = requiredEnv('APPLE_IAP_ISSUER_ID')
  const keyId = requiredEnv('APPLE_IAP_KEY_ID')
  const privateKey = requiredEnv('APPLE_IAP_PRIVATE_KEY')
  const now = Math.floor(Date.now() / 1000)
  return await signJwt(
    { alg: 'ES256', kid: keyId, typ: 'JWT' },
    { iss: issuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1', bid: bundleId },
    privateKey,
    'ES256',
  )
}

async function verifyGooglePurchase(
  productId: string,
  kind: string,
  purchaseToken: string,
): Promise<VerifiedPurchase> {
  const serviceAccount = JSON.parse(requiredEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'))
  const packageName = requiredEnv('GOOGLE_PLAY_PACKAGE_NAME')
  const accessToken = await googleAccessToken(serviceAccount)
  const headers = { Authorization: `Bearer ${accessToken}` }

  if (kind === 'subscription') {
    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
      { headers, signal: AbortSignal.timeout(15_000) },
    )
    if (!response.ok) throw new Error(`invalid_google_response_${response.status}`)
    const result = await response.json()
    const validStates = new Set([
      'SUBSCRIPTION_STATE_ACTIVE',
      'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
      'SUBSCRIPTION_STATE_CANCELED',
    ])
    if (!validStates.has(String(result?.subscriptionState ?? ''))) {
      throw new Error('subscription_not_active')
    }
    const lineItem = (result?.lineItems ?? []).find(
      (item: Record<string, unknown>) => item.productId === productId,
    )
    if (!lineItem?.expiryTime) throw new Error('invalid_google_product')
    if (Date.parse(lineItem.expiryTime) <= Date.now()) throw new Error('subscription_not_active')
    const transactionId = String(lineItem.latestSuccessfulOrderId ?? result.latestOrderId ?? '')
    if (!transactionId) throw new Error('invalid_google_transaction')
    return {
      provider: 'google',
      revenue: await googleOrderRevenue(packageName, transactionId, accessToken),
      productId,
      transactionId,
      originalTransactionId: String(result?.linkedPurchaseToken ?? purchaseToken),
      environment: result?.testPurchase ? 'sandbox' : 'production',
      purchasedAt: result?.startTime ?? new Date().toISOString(),
      expiresAt: lineItem.expiryTime,
    }
  }

  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers, signal: AbortSignal.timeout(15_000) },
  )
  if (!response.ok) throw new Error(`invalid_google_response_${response.status}`)
  const result = await response.json()
  if (Number(result?.purchaseState) !== 0 || !result?.orderId) {
    throw new Error('invalid_google_transaction')
  }
  return {
    provider: 'google',
    productId,
    transactionId: String(result.orderId),
    originalTransactionId: null,
    environment: result?.purchaseType === 0 ? 'sandbox' : 'production',
    purchasedAt: dateFromMilliseconds(result.purchaseTimeMillis),
    expiresAt: null,
  }
}

async function googleAccessToken(serviceAccount: Record<string, string>) {
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_missing')
  }
  const now = Math.floor(Date.now() / 1000)
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    serviceAccount.private_key,
    'RS256',
  )
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`invalid_google_auth_${response.status}`)
  const result = await response.json()
  if (!result?.access_token) throw new Error('invalid_google_auth')
  return String(result.access_token)
}

async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  pem: string,
  algorithm: 'ES256' | 'RS256',
) {
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`
  const keyBytes = pemBytes(pem)
  const key = algorithm === 'ES256'
    ? await crypto.subtle.importKey(
      'pkcs8',
      keyBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )
    : await crypto.subtle.importKey(
      'pkcs8',
      keyBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  const signature = algorithm === 'ES256'
    ? await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      encoder.encode(signingInput),
    )
    : await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signingInput))
  return `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`
}

function decodeJwtPayload(value: string): Record<string, unknown> {
  const parts = value.split('.')
  if (parts.length !== 3) throw new Error('invalid_apple_jws')
  const normalized = parts[1].replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))))
}

function pemBytes(pem: string) {
  const body = pem.replace(/-----[^-]+-----/g, '').replaceAll(/\s/g, '')
  return Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
}

function base64UrlJson(value: Record<string, unknown>) {
  return base64UrlBytes(encoder.encode(JSON.stringify(value)))
}

function base64UrlBytes(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function dateFromMilliseconds(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('invalid_purchase_date')
  return new Date(parsed).toISOString()
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name}_missing`)
  return value
}

function safeError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
