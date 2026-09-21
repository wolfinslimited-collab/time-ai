import { supportStreamResponse } from "../_shared/support_stream.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleStudioError,
  jsonResponse,
  requiredEnv,
  studioCorsHeaders,
  StudioError,
} from "../_shared/studio.ts";
import { guestSupportHistory } from "../_shared/support.ts";
import { answerSupport } from "../_shared/support_provider.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: studioCorsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }
  try {
    const body = await request.json().catch(() => ({}));
    // Public support never accepts ticket creation or account reads.
    if (body.action !== "message") {
      throw new StudioError("authentication_required", 401);
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 2000) {
      throw new StudioError("invalid_message");
    }
    let history;
    try {
      history = guestSupportHistory(body.history);
    } catch {
      throw new StudioError("invalid_history");
    }
    const admin = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const address =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        requiredEnv("SUPABASE_SERVICE_ROLE_KEY") + ":" + address,
      ),
    );
    const fingerprint = Array.from(
      new Uint8Array(hash),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const { error } = await admin.rpc("studio_support_guest_reserve", {
      p_fingerprint: fingerprint,
    });
    if (error) {
      if (error.message.includes("support_rate_limited")) {
        throw new StudioError("support_rate_limited", 429);
      }
      throw error;
    }
    const respond = async (emit?: (answer: string) => void) => {
    try {
      const answer = await answerSupport(admin, message, history, true, emit);
      return {answer: answer.answer, requiresSignIn: answer.escalate};
    } catch (error) {
      const reason = error instanceof Error &&
          /^provider_unavailable_\d+$|^provider_reply_\d+$|^invalid_support_answer$|^catalog_unavailable$/
            .test(error.message)
        ? error.message
        : error instanceof SyntaxError
        ? "invalid_support_json"
        : "support_request_failed";
      console.error("Studio guest support unavailable", reason);
      return {
        answer:
          "AI support is unavailable right now. Please try again shortly, or use Open a ticket for help.",
        requiresSignIn: false,
      };
    }
    };
    if (body.stream === true) return supportStreamResponse(request, respond);
    return jsonResponse(request, await respond());
  } catch (error) {
    return handleStudioError(request, error);
  }
});
