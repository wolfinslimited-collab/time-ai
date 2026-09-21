import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-wolfins-secret, x-timeless-cli-secret',
}

const encoder = new TextEncoder()

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const publishableKey = requiredEnv('SUPABASE_ANON_KEY')
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const bearerToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : ''
    const trustedServiceRoleRequest = bearerToken.length > 0 &&
      secureEquals(bearerToken, serviceRoleKey)
    const cliSecret = request.headers.get('x-timeless-cli-secret')?.trim() || ''
    const expectedCliSecret = Deno.env.get('TIMELESS_UPLOAD_CLI_SECRET')?.trim() || ''
    const trustedCliRequest = expectedCliSecret.length >= 32 &&
      secureEquals(cliSecret, expectedCliSecret)
    const wolfinsSecret = request.headers.get('x-wolfins-secret')?.trim() || ''
    const expectedWolfinsSecret = Deno.env.get('WOLFINS_CONTROL_SECRET')?.trim() || ''
    const trustedWolfinsRequest = expectedWolfinsSecret.length >= 32 &&
      secureEquals(wolfinsSecret, expectedWolfinsSecret)

    if (!trustedCliRequest && !trustedServiceRoleRequest && !trustedWolfinsRequest) {
      if (!authorization) return json({ error: 'authentication_required' }, 401)
      const userClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authorization } },
      })
      const { data: userData, error: userError } = await userClient.auth.getUser()
      if (userError || !userData.user) return json({ error: 'invalid_session' }, 401)
      const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
      if (adminError) throw adminError
      if (isAdmin !== true) return json({ error: 'admin_required' }, 403)
    }

    const body = await request.json().catch(() => ({}))
    const assetType = body?.assetType === 'trailer' ? 'trailer' : 'episode'
    const episodeId = String(body?.episodeId ?? '').trim()
    const seriesId = String(body?.seriesId ?? '').trim()
    const assetId = assetType === 'trailer' ? seriesId : episodeId
    const fileName = String(body?.fileName ?? '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(assetId)) {
      return json({ error: `invalid_${assetType}_id` }, 400)
    }
    if (!fileName.toLowerCase().endsWith('.mp4')) {
      return json({ error: 'mp4_required' }, 400)
    }

    const region = requiredEnv('AWS_VIDEO_REGION')
    const bucket = requiredEnv('AWS_VIDEO_ORIGINALS_BUCKET')
    const accessKeyId = requiredEnv('AWS_VIDEO_ACCESS_KEY_ID')
    const secretAccessKey = requiredEnv('AWS_VIDEO_SECRET_ACCESS_KEY')
    const objectKey = assetType === 'trailer'
      ? `uploads/trailers/${seriesId}.mp4`
      : `uploads/${episodeId}.mp4`
    const uploadUrl = await presignS3Put({
      region,
      bucket,
      objectKey,
      accessKeyId,
      secretAccessKey,
      expiresIn: 900,
    })

    const mediaPayload = {
      provider: 'aws',
      video_path: objectKey,
      source_asset_id: assetId,
      playback_path: assetType === 'trailer'
        ? `hls/trailers/${seriesId}/index.m3u8`
        : `hls/${episodeId}/index.m3u8`,
      transcode_status: 'pending',
      transcode_job_id: null,
      source_etag: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    }
    const { error: mediaError } = assetType === 'trailer'
      ? await adminClient.from('series_trailer_media').upsert({
          series_id: seriesId,
          ...mediaPayload,
        })
      : await adminClient.from('episode_media').upsert({
          episode_id: episodeId,
          ...mediaPayload,
        })
    if (mediaError) throw mediaError

    if (assetType === 'trailer') {
      const { error: seriesError } = await adminClient
        .from('series')
        .update({ has_trailer: false })
        .eq('id', seriesId)
      if (seriesError) throw seriesError
    }

    return json({
      uploadUrl,
      assetType,
      assetId,
      objectKey,
      expiresIn: 900,
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
    })
  } catch (error) {
    console.error('video-upload-url failed', error)
    return json({ error: 'upload_authorization_failed' }, 500)
  }
})

async function presignS3Put(options: {
  region: string
  bucket: string
  objectKey: string
  accessKeyId: string
  secretAccessKey: string
  expiresIn: number
}) {
  const now = new Date()
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const shortDate = iso.slice(0, 8)
  const scope = `${shortDate}/${options.region}/s3/aws4_request`
  const host = `${options.bucket}.s3.${options.region}.amazonaws.com`
  const canonicalUri = `/${options.objectKey.split('/').map(encodeURIComponent).join('/')}`
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${options.accessKeyId}/${scope}`,
    'X-Amz-Date': iso,
    'X-Amz-Expires': String(options.expiresIn),
    'X-Amz-SignedHeaders': 'host',
  })
  query.sort()
  const canonicalQuery = query.toString().replaceAll('+', '%20')
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    iso,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n')
  const dateKey = await hmac(encoder.encode(`AWS4${options.secretAccessKey}`), shortDate)
  const regionKey = await hmac(dateKey, options.region)
  const serviceKey = await hmac(regionKey, 's3')
  const signingKey = await hmac(serviceKey, 'aws4_request')
  const signature = hex(await hmac(signingKey, stringToSign))
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

async function sha256Hex(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
}

async function hmac(key: Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value)))
}

function hex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name}_missing`)
  return value
}

function secureEquals(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
