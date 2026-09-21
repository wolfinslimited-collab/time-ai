import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const encoder = new TextEncoder()

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const rawBody = await request.text()
    const timestamp = request.headers.get('x-timeless-timestamp') ?? ''
    const signature = request.headers.get('x-timeless-signature') ?? ''
    const timestampMs = Number(timestamp) * 1000
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 300_000) {
      return json({ error: 'expired_request' }, 401)
    }

    const secret = requiredEnv('AWS_VIDEO_STATUS_SECRET')
    const expected = await hmacHex(secret, `${timestamp}.${rawBody}`)
    if (!constantTimeEqual(signature, expected)) {
      return json({ error: 'invalid_signature' }, 401)
    }

    const event = JSON.parse(rawBody) as Record<string, unknown>
    const detail = object(event.detail)
    const metadata = object(detail.userMetadata)
    const assetType = String(metadata.asset_type ?? 'episode')
    const episodeId = String(metadata.episode_id ?? '')
    const seriesId = String(metadata.series_id ?? '')
    const assetId = assetType === 'trailer' ? seriesId : episodeId
    const jobId = String(detail.jobId ?? '')
    const status = String(detail.status ?? '')
    if (!['episode', 'trailer'].includes(assetType) ||
        !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(assetId) || !jobId) {
      return json({ error: 'invalid_event' }, 400)
    }

    const transcodeStatus = status === 'COMPLETE'
      ? 'ready'
      : status === 'ERROR' || status === 'CANCELED'
      ? 'failed'
      : 'processing'
    const errorMessage = transcodeStatus === 'failed'
      ? String(detail.errorMessage ?? detail.errorCode ?? 'AWS MediaConvert failed')
      : null

    const client = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )
    const statusPayload = {
      provider: 'aws',
      transcode_status: transcodeStatus,
      transcode_job_id: jobId,
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    }
    const { error } = assetType === 'trailer'
      ? await client.from('series_trailer_media').update(statusPayload).eq('series_id', seriesId)
      : await client.from('episode_media').update(statusPayload).eq('episode_id', episodeId)
    if (error) throw error

    if (assetType === 'trailer') {
      const { error: seriesError } = await client
        .from('series')
        .update({ has_trailer: transcodeStatus === 'ready' })
        .eq('id', seriesId)
      if (seriesError) throw seriesError
    }

    return json({ accepted: true, assetType, assetId, jobId, status: transcodeStatus })
  } catch (error) {
    console.error('video-transcode-status failed', error)
    return json({ error: 'status_update_failed' }, 500)
  }
})

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
  )
  return [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name}_missing`)
  return value
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
