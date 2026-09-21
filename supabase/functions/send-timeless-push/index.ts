import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64Url } from "https://deno.land/std@0.220.0/encoding/base64url.ts";

type FirebaseServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
};

type PushRequest = {
  title: string;
  body: string;
  type?: string;
  user_id?: string;
  series_id?: string;
  episode_number?: number;
  saved_series_only?: boolean;
  platform?: "ios" | "android" | "all";
};

const jsonHeaders = { "Content-Type": "application/json" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function serviceAccount(): FirebaseServiceAccount {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  return JSON.parse(raw) as FirebaseServiceAccount;
}

async function accessToken(account: FirebaseServiceAccount): Promise<string> {
  const tokenUri = account.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const header = encodeBase64Url(
    encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
  );
  const payload = encodeBase64Url(
    encoder.encode(JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })),
  );
  const unsigned = `${header}.${payload}`;
  const pem = account.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "\n")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsigned),
  );
  const assertion = `${unsigned}.${encodeBase64Url(new Uint8Array(signature))}`;
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error("Firebase access token exchange failed");
  }
  return result.access_token as string;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const authHeader = request.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userResult } = await caller.auth.getUser();
    const callerId = userResult.user?.id;
    if (!callerId) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await caller.rpc("is_admin");
    if (isAdmin !== true) return json({ error: "forbidden" }, 403);

    const payload = await request.json() as PushRequest;
    const title = payload.title?.trim();
    const body = payload.body?.trim();
    if (!title || !body) return json({ error: "title_and_body_required" }, 400);
    if (title.length > 120 || body.length > 500) {
      return json({ error: "notification_too_long" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    let tokenQuery = admin.from("timeless_push_tokens")
      .select("token,user_id,platform")
      .eq("enabled", true);
    if (payload.user_id) tokenQuery = tokenQuery.eq("user_id", payload.user_id);
    if (payload.platform && payload.platform !== "all") {
      tokenQuery = tokenQuery.eq("platform", payload.platform);
    }
    const { data: tokenRows, error: tokenError } = await tokenQuery;
    if (tokenError) throw tokenError;

    let eligibleUsers: Set<string> | null = null;
    if (payload.saved_series_only && payload.series_id) {
      const { data: savedRows, error: savedError } = await admin
        .from("saved_series")
        .select("user_id")
        .eq("series_id", payload.series_id);
      if (savedError) throw savedError;
      eligibleUsers = new Set((savedRows || []).map((row) => row.user_id));
    }
    const userIds = [...new Set((tokenRows || []).map((row) => row.user_id))];
    const { data: preferenceRows } = userIds.length === 0
      ? { data: [] }
      : await admin.from("timeless_notification_preferences")
        .select(
          "user_id,enabled,new_episodes,saved_series_updates,continue_watching,subscription_updates",
        )
        .in("user_id", userIds);
    const preferences = new Map(
      (preferenceRows || []).map((row) => [row.user_id, row]),
    );
    const type = payload.type || "general";
    const tokens = (tokenRows || []).filter((row) => {
      if (eligibleUsers && !eligibleUsers.has(row.user_id)) return false;
      const pref = preferences.get(row.user_id);
      if (pref?.enabled === false) return false;
      if (type === "new_episode" && pref?.new_episodes === false) return false;
      if (type === "saved_series" && pref?.saved_series_updates === false) {
        return false;
      }
      if (type === "continue_watching" && pref?.continue_watching === false) {
        return false;
      }
      if (type === "subscription" && pref?.subscription_updates === false) {
        return false;
      }
      return true;
    });

    const account = serviceAccount();
    const oauthToken = tokens.length > 0 ? await accessToken(account) : null;
    const endpoint =
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
    let delivered = 0;
    let failed = 0;
    const invalidTokens: string[] = [];
    const data: Record<string, string> = { type };
    if (payload.series_id) data.series_id = payload.series_id;
    if (payload.episode_number != null) {
      data.episode_number = String(payload.episode_number);
    }

    for (const row of tokens) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oauthToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: row.token,
            notification: { title, body },
            data,
            android: {
              priority: "HIGH",
              notification: {
                channel_id: "timeless_updates",
                sound: "default",
              },
            },
            apns: {
              headers: { "apns-priority": "10" },
              payload: { aps: { sound: "default", badge: 1 } },
            },
          },
        }),
      });
      if (response.ok) {
        delivered++;
      } else {
        failed++;
        const result = await response.json().catch(() => ({}));
        const code = result?.error?.details?.[0]?.errorCode ||
          result?.error?.status;
        if (["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"].includes(code)) {
          invalidTokens.push(row.token);
        }
      }
    }

    if (invalidTokens.length > 0) {
      await admin.from("timeless_push_tokens").delete().in(
        "token",
        invalidTokens,
      );
    }
    await admin.from("timeless_push_delivery_events").insert({
      notification_type: type,
      title,
      body,
      series_id: payload.series_id || null,
      episode_number: payload.episode_number || null,
      target_user_id: payload.user_id || null,
      target_platform: payload.platform || "all",
      attempted: tokens.length,
      delivered,
      failed,
      created_by: callerId,
    });

    return json({
      success: true,
      attempted: tokens.length,
      delivered,
      failed,
      invalid_tokens_removed: invalidTokens.length,
    });
  } catch (error) {
    console.error("send-timeless-push failed", error);
    return json({ error: "push_send_failed" }, 500);
  }
});
