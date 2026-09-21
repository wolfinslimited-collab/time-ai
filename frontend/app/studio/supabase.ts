import { createClient } from "@supabase/supabase-js";

export const studioFetch: typeof fetch = (input, init) => {
  const raw=typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const local=typeof window !== 'undefined' && ['localhost','127.0.0.1'].includes(window.location.hostname);
  const prefix='https://xmxsqmxuiksldqhtugvv.supabase.co/functions/v1/';
  return fetch(local && raw.startsWith(prefix) ? '/__studio-functions/'+raw.slice(prefix.length) : input, init);
};

export const studioSupabase = createClient(
  "https://xmxsqmxuiksldqhtugvv.supabase.co",
  "sb_publishable_WUFwWg577SCT9xxbYY9i9g_fAUDsR0Q",
  {
    global: {fetch: studioFetch},
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
