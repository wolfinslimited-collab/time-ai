import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'authentication_required' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data, error: userError } = await userClient.auth.getUser()
    if (userError || !data.user) return json({ error: 'invalid_session' }, 401)

    const body = await request.json().catch(() => ({}))
    if (body?.confirmation !== 'DELETE') {
      return json({ error: 'confirmation_required' }, 400)
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.user.id)
    if (deleteError) throw deleteError
    return json({ deleted: true })
  } catch (error) {
    console.error('delete-account failed', error)
    return json({ error: 'account_deletion_failed' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
