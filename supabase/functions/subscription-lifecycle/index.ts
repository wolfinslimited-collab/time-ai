import { appleRevenue, googleOrderRevenue, saveRevenue } from '../_shared/revenue.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
const encoder = new TextEncoder()

type LifecycleUpdate = {
  revenue?: Record<string, any> | null
  provider: 'apple' | 'google'
  eventId: string
  eventType: string
  subtype: string | null
  productId: string
  transactionId: string
  originalTransactionId: string
  status: 'active' | 'grace_period' | 'expired' | 'revoked' | 'refunded'
  environment: 'sandbox' | 'production'
  purchasedAt: string
  expiresAt: string
  lookupIds: string[]
  rawPayload: Record<string, unknown>
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const path = new URL(request.url).pathname
    const provider = path.endsWith('/apple')
      ? 'apple'
      : path.endsWith('/google')
        ? 'google'
        : null
    if (!provider) return json({ error: 'provider_required' }, 404)

    const body = await request.json().catch(() => ({}))
    const update = provider === 'apple'
      ? await appleLifecycle(body)
      : await googleLifecycle(request, body)
    if (!update) return json({ accepted: true, test: true })

    const admin = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )
    const userId = await findPurchaseOwner(admin, update.provider, update.lookupIds)
    if (!userId) throw new Error('purchase_owner_not_found')

    const { data, error } = await admin.rpc('apply_subscription_lifecycle', {
      p_user_id: userId,
      p_provider: update.provider,
      p_event_id: update.eventId,
      p_event_type: update.eventType,
      p_subtype: update.subtype,
      p_product_id: update.productId,
      p_transaction_id: update.transactionId,
      p_original_transaction_id: update.originalTransactionId,
      p_status: update.status,
      p_environment: update.environment,
      p_purchased_at: update.purchasedAt,
      p_expires_at: update.expiresAt,
      p_raw_payload: update.rawPayload,
    })
    if (error) throw error
    await saveRevenue(admin, update.provider, update.transactionId, update.revenue)
    return json({ accepted: true, ...data })
  } catch (error) {
    console.error('subscription-lifecycle failed', safeError(error))
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('_missing') || message === 'purchase_owner_not_found') {
      return json({ error: message }, 503)
    }
    if (message.startsWith('invalid_')) return json({ error: message }, 400)
    return json({ error: 'lifecycle_processing_unavailable' }, 502)
  }
})

async function appleLifecycle(body: Record<string, unknown>): Promise<LifecycleUpdate | null> {
  const signedPayload = String(body?.signedPayload ?? '')
  if (!signedPayload) throw new Error('invalid_apple_payload')
  const notification = decodeJwtPayload(signedPayload)
  const eventType = String(notification.notificationType ?? '')
  if (eventType === 'TEST') return null

  const data = object(notification.data)
  const signedTransaction = String(data.signedTransactionInfo ?? '')
  if (!signedTransaction) throw new Error('invalid_apple_transaction')
  const notificationTransaction = decodeJwtPayload(signedTransaction)
  const transactionId = String(notificationTransaction.transactionId ?? '')
  if (!/^\d+$/.test(transactionId)) throw new Error('invalid_apple_transaction')

  const verified = await fetchAppleSubscriptionStatus(transactionId)
  const transaction = verified.transaction
  const renewal = verified.renewal
  const bundleId = requiredEnv('APPLE_IAP_BUNDLE_ID')
  if (transaction.bundleId !== bundleId) throw new Error('invalid_apple_bundle')

  const productId = String(transaction.productId ?? '')
  const originalTransactionId = String(transaction.originalTransactionId ?? '')
  const currentTransactionId = String(transaction.transactionId ?? '')
  if (!productId || !originalTransactionId || !currentTransactionId) {
    throw new Error('invalid_apple_transaction')
  }

  const appleStatus = Number(verified.status)
  const status = appleStatus === 1
    ? 'active'
    : appleStatus === 4
      ? 'grace_period'
      : appleStatus === 5
        ? transaction.revocationDate ? 'refunded' : 'revoked'
        : 'expired'
  const expiresValue = status === 'grace_period'
    ? renewal.gracePeriodExpiresDate ?? transaction.expiresDate
    : transaction.expiresDate
  const expiresAt = dateFromMilliseconds(expiresValue)

  return {
    provider: 'apple',
    revenue: appleRevenue(transaction),
    eventId: String(notification.notificationUUID ?? `${currentTransactionId}:${eventType}:${notification.signedDate ?? ''}`),
    eventType,
    subtype: notification.subtype ? String(notification.subtype) : null,
    productId,
    transactionId: currentTransactionId,
    originalTransactionId,
    status,
    environment: verified.environment,
    purchasedAt: dateFromMilliseconds(transaction.purchaseDate),
    expiresAt,
    lookupIds: [originalTransactionId, currentTransactionId, transactionId],
    rawPayload: {
      notificationType: eventType,
      subtype: notification.subtype ?? null,
      status: appleStatus,
      signedDate: notification.signedDate ?? null,
    },
  }
}

async function fetchAppleSubscriptionStatus(transactionId: string) {
  const bundleId = requiredEnv('APPLE_IAP_BUNDLE_ID')
  const token = await appleApiToken(bundleId)
  const endpoints: Array<{ base: string; environment: 'production' | 'sandbox' }> = [
    { base: 'https://api.storekit.apple.com', environment: 'production' },
    { base: 'https://api.storekit-sandbox.apple.com', environment: 'sandbox' },
  ]
  for (const endpoint of endpoints) {
    const response = await fetch(
      `${endpoint.base}/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      },
    )
    if (response.status === 404) continue
    if (!response.ok) throw new Error(`invalid_apple_response_${response.status}`)
    const result = await response.json()
    const candidates = (result?.data ?? []).flatMap(
      (group: Record<string, unknown>) => Array.isArray(group.lastTransactions)
        ? group.lastTransactions
        : [],
    ) as Array<Record<string, unknown>>
    for (const candidate of candidates) {
      if (!candidate.signedTransactionInfo) continue
      const transaction = decodeJwtPayload(String(candidate.signedTransactionInfo))
      const renewal = candidate.signedRenewalInfo
        ? decodeJwtPayload(String(candidate.signedRenewalInfo))
        : {}
      return {
        status: Number(candidate.status),
        transaction,
        renewal,
        environment: endpoint.environment,
      }
    }
    throw new Error('invalid_apple_subscription_status')
  }
  throw new Error('invalid_apple_transaction')
}

async function googleLifecycle(
  request: Request,
  body: Record<string, unknown>,
): Promise<LifecycleUpdate | null> {
  await verifyGooglePushIdentity(request)
  const message = object(body.message)
  const encodedData = String(message.data ?? '')
  const eventId = String(message.messageId ?? message.message_id ?? '')
  if (!encodedData || !eventId) throw new Error('invalid_google_notification')
  const notification = JSON.parse(decodeBase64(encodedData))
  if (notification.packageName !== requiredEnv('GOOGLE_PLAY_PACKAGE_NAME')) {
    throw new Error('invalid_google_package')
  }
  if (notification.testNotification) return null
  const subscription = notification.subscriptionNotification
  if (!subscription?.purchaseToken) return null

  const purchaseToken = String(subscription.purchaseToken)
  const result = await fetchGoogleSubscription(purchaseToken)
  const lineItems = Array.isArray(result.lineItems) ? result.lineItems : []
  const lineItem = lineItems
    .filter((item: Record<string, unknown>) => item.productId && item.expiryTime)
    .sort(
      (left: Record<string, unknown>, right: Record<string, unknown>) =>
        Date.parse(String(right.expiryTime)) - Date.parse(String(left.expiryTime)),
    )[0]
  if (!lineItem) throw new Error('invalid_google_subscription')

  const productId = String(lineItem.productId)
  const expiresAt = validIsoDate(lineItem.expiryTime)
  const state = String(result.subscriptionState ?? '')
  const status = state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
    ? 'grace_period'
    : (state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_CANCELED') &&
        Date.parse(expiresAt) > Date.now()
      ? 'active'
      : 'expired'
  const linkedToken = result.linkedPurchaseToken
    ? String(result.linkedPurchaseToken)
    : null
  const originalTransactionId = linkedToken ?? purchaseToken
  const transactionId = String(
    lineItem.latestSuccessfulOrderId ?? result.latestOrderId ?? purchaseToken,
  )
  const eventType = googleNotificationType(Number(subscription.notificationType))

  return {
    provider: 'google',
    revenue: await googleOrderRevenue(requiredEnv('GOOGLE_PLAY_PACKAGE_NAME'), transactionId, await googleAccessToken(JSON.parse(requiredEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')))),
    eventId,
    eventType,
    subtype: null,
    productId,
    transactionId,
    originalTransactionId,
    status,
    environment: result.testPurchase ? 'sandbox' : 'production',
    purchasedAt: validIsoDate(result.startTime ?? new Date().toISOString()),
    expiresAt,
    lookupIds: [purchaseToken, linkedToken, originalTransactionId, transactionId]
      .filter((value): value is string => Boolean(value)),
    rawPayload: {
      notificationType: Number(subscription.notificationType),
      subscriptionState: state,
      eventTimeMillis: notification.eventTimeMillis ?? null,
    },
  }
}

async function verifyGooglePushIdentity(request: Request) {
  const authorization = request.headers.get('Authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new Error('invalid_google_push_identity')
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(match[1])}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!response.ok) throw new Error('invalid_google_push_identity')
  const identity = await response.json()
  if (
    identity.aud !== requiredEnv('GOOGLE_PUBSUB_AUDIENCE') ||
    identity.email !== requiredEnv('GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL') ||
    String(identity.email_verified) !== 'true'
  ) {
    throw new Error('invalid_google_push_identity')
  }
}

async function fetchGoogleSubscription(purchaseToken: string) {
  const serviceAccount = JSON.parse(requiredEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'))
  const accessToken = await googleAccessToken(serviceAccount)
  const packageName = requiredEnv('GOOGLE_PLAY_PACKAGE_NAME')
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!response.ok) throw new Error(`invalid_google_response_${response.status}`)
  return await response.json()
}

async function findPurchaseOwner(
  admin: any,
  provider: 'apple' | 'google',
  identifiers: string[],
) {
  for (const identifier of [...new Set(identifiers.filter(Boolean))]) {
    for (const field of ['original_transaction_id', 'provider_transaction_id']) {
      const { data, error } = await admin
        .from('store_purchase_receipts')
        .select('user_id')
        .eq('provider', provider)
        .eq(field, identifier)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (data?.user_id) return String(data.user_id)
    }
  }
  return null
}

function googleNotificationType(value: number) {
  const types: Record<number, string> = {
    1: 'SUBSCRIPTION_RECOVERED',
    2: 'SUBSCRIPTION_RENEWED',
    3: 'SUBSCRIPTION_CANCELED',
    4: 'SUBSCRIPTION_PURCHASED',
    5: 'SUBSCRIPTION_ON_HOLD',
    6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
    7: 'SUBSCRIPTION_RESTARTED',
    9: 'SUBSCRIPTION_DEFERRED',
    10: 'SUBSCRIPTION_PAUSED',
    11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
    12: 'SUBSCRIPTION_REVOKED',
    13: 'SUBSCRIPTION_EXPIRED',
    19: 'SUBSCRIPTION_PRICE_CHANGE_UPDATED',
    20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
    22: 'SUBSCRIPTION_PRICE_STEP_UP_CONSENT_UPDATED',
  }
  return types[value] ?? `SUBSCRIPTION_EVENT_${value}`
}

async function appleApiToken(bundleId: string) {
  const now = Math.floor(Date.now() / 1000)
  return await signJwt(
    { alg: 'ES256', kid: requiredEnv('APPLE_IAP_KEY_ID'), typ: 'JWT' },
    {
      iss: requiredEnv('APPLE_IAP_ISSUER_ID'),
      iat: now,
      exp: now + 600,
      aud: 'appstoreconnect-v1',
      bid: bundleId,
    },
    requiredEnv('APPLE_IAP_PRIVATE_KEY'),
    'ES256',
  )
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
  const key = algorithm === 'ES256'
    ? await crypto.subtle.importKey(
      'pkcs8',
      pemBytes(pem),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )
    : await crypto.subtle.importKey(
      'pkcs8',
      pemBytes(pem),
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
  if (parts.length !== 3) throw new Error('invalid_jws')
  return JSON.parse(decodeBase64(parts[1]))
}

function decodeBase64(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return new TextDecoder().decode(
    Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)),
  )
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

function validIsoDate(value: unknown) {
  const parsed = Date.parse(String(value ?? ''))
  if (!Number.isFinite(parsed)) throw new Error('invalid_purchase_date')
  return new Date(parsed).toISOString()
}

function object(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
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
