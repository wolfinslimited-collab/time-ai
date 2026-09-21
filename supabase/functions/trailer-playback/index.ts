import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const body = await request.json().catch(() => ({}))
    const seriesId = String(body?.seriesId ?? '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(seriesId)) {
      return json({ error: 'invalid_series_id' }, 400)
    }

    const client = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )
    const { data: series, error: seriesError } = await client
      .from('series')
      .select('id')
      .eq('id', seriesId)
      .eq('status', 'published')
      .eq('has_trailer', true)
      .maybeSingle()
    if (seriesError) throw seriesError
    if (!series) return json({ error: 'trailer_not_found' }, 404)

    const { data: media, error: mediaError } = await client
      .from('series_trailer_media')
      .select('provider,playback_path,transcode_status,captions')
      .eq('series_id', seriesId)
      .single()
    if (mediaError) throw mediaError
    if (media.provider !== 'aws' || media.transcode_status !== 'ready' || !media.playback_path) {
      return json({ error: 'video_processing' }, 409)
    }

    const expiresIn = 900
    const domain = requiredEnv('AWS_CLOUDFRONT_DOMAIN')
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn
    const resource = `https://${domain}/hls/trailers/${seriesId}/*`
    const policy = JSON.stringify({
      Statement: [{
        Resource: resource,
        Condition: { DateLessThan: { 'AWS:EpochTime': expiresAt } },
      }],
    })
    const signature = await signCloudFrontPolicy(
      policy,
      requiredEnv('AWS_CLOUDFRONT_PRIVATE_KEY'),
    )
    const cookie = [
      `CloudFront-Policy=${cloudFrontBase64(new TextEncoder().encode(policy))}`,
      `CloudFront-Signature=${signature}`,
      `CloudFront-Key-Pair-Id=${requiredEnv('AWS_CLOUDFRONT_KEY_PAIR_ID')}`,
    ].join('; ')

    return json({
      url: `https://${domain}/${media.playback_path}`,
      headers: { Cookie: cookie },
      captions: media.captions,
      expiresIn,
      provider: 'aws',
    })
  } catch (error) {
    console.error('trailer-playback failed', error)
    return json({ error: 'playback_unavailable' }, 500)
  }
})

async function signCloudFrontPolicy(policy: string, pem: string) {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replaceAll(/\s/g, '')
  const keyBytes = Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(policy),
    ),
  )
  return cloudFrontBase64(signature)
}

function cloudFrontBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('=', '_').replaceAll('/', '~')
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name}_missing`)
  return value
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
