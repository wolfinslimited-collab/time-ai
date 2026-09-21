import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const body = await request.json()
    const episodeId = body?.episodeId as string | undefined
    if (!episodeId) return json({ error: 'episode_id_required' }, 400)

    let canWatch = false
    const authorization = request.headers.get('Authorization')
    if (authorization) {
      const userClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authorization } },
      })
      const { data: userData } = await userClient.auth.getUser()
      if (userData.user) {
        const { data: access, error: accessError } = await userClient.rpc(
          'can_watch_episode',
          { p_episode_id: episodeId },
        )
        if (accessError) throw accessError
        canWatch = access === true
      }
    }
    if (!canWatch) {
      const { data: freeEpisode, error: episodeError } = await adminClient
        .from('episodes')
        .select('id')
        .eq('id', episodeId)
        .eq('status', 'published')
        .eq('is_free', true)
        .maybeSingle()
      if (episodeError) throw episodeError
      canWatch = freeEpisode !== null
    }
    if (!canWatch) return json({ error: 'episode_locked' }, 403)

    const { data: media, error: mediaError } = await adminClient
      .from('episode_media')
      .select('video_path,captions,provider,playback_path,transcode_status')
      .eq('episode_id', episodeId)
      .single()
    if (mediaError) throw mediaError

    const expiresIn = 900
    if (media.provider === 'aws') {
      if (media.transcode_status !== 'ready' || !media.playback_path) {
        return json({ error: 'video_processing' }, 409)
      }
      const domain = requiredEnv('AWS_CLOUDFRONT_DOMAIN')
      const keyPairId = requiredEnv('AWS_CLOUDFRONT_KEY_PAIR_ID')
      const privateKey = requiredEnv('AWS_CLOUDFRONT_PRIVATE_KEY')
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn
      const resource = `https://${domain}/hls/${episodeId}/*`
      const policy = JSON.stringify({
        Statement: [{
          Resource: resource,
          Condition: { DateLessThan: { 'AWS:EpochTime': expiresAt } },
        }],
      })
      const signature = await signCloudFrontPolicy(policy, privateKey)
      const cookie = [
        `CloudFront-Policy=${cloudFrontBase64(new TextEncoder().encode(policy))}`,
        `CloudFront-Signature=${signature}`,
        `CloudFront-Key-Pair-Id=${keyPairId}`,
      ].join('; ')
      return json({
        url: `https://${domain}/${media.playback_path}`,
        headers: { Cookie: cookie },
        captions: media.captions,
        expiresIn,
        provider: 'aws',
      })
    }

    const { data: signed, error: signedError } = await adminClient.storage
      .from('episode-video')
      .createSignedUrl(media.video_path, expiresIn)
    if (signedError) throw signedError

    return json({
      url: signed.signedUrl,
      headers: {},
      captions: media.captions,
      expiresIn,
      provider: 'supabase',
    })
  } catch (error) {
    console.error(error)
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
    keyBytes,
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
