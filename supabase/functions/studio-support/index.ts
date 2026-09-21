import { supportStreamResponse } from "../_shared/support_stream.ts";
import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
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
    const { admin, user } = await authenticateStudioRequest(request);
    if (user.is_anonymous) {
      throw new StudioError("authentication_required", 401);
    }
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    if (!["load", "message", "ticket"].includes(action)) {
      throw new StudioError("invalid_action");
    }
    if (action === "load") {
      const { data, error } = await admin.from("studio_support_conversations")
        .select("*").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return jsonResponse(request, { conversation: data });
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (message.length > 2000 || (action === "message" && !message)) {
      throw new StudioError("invalid_message");
    }
    const { data: conversation, error: reserveError } = await admin.rpc(
      "studio_support_reserve",
      { p_user_id: user.id, p_email: user.email ?? null },
    );
    if (reserveError) {
      if (reserveError.message.includes("support_rate_limited")) {
        throw new StudioError("support_rate_limited", 429);
      }
      throw reserveError;
    }
    const respond = async (emit?: (answer: string) => void) => {
    let answer = "Your conversation is ready for our support team to review.";
    let escalate = action === "ticket";
    if (action === "message") {
      try {
        const result = await answerSupport(
          admin,
          message,
          conversation.transcript ?? [],
          false,
          emit,
        );
        answer = result.answer;
        escalate = result.escalate;
      } catch {
        answer =
          "AI support is unavailable right now. Your question needs support-team review.";
        escalate = true;
      }
    }
    let guestContext = "";
    if (action === "ticket" && body.guestHistory) {
      try {
        const history = guestSupportHistory(body.guestHistory);
        guestContext = history.length
          ? "Guest conversation supplied by the customer (unverified context):\n" +
            history.map((item) => `${item.role}: ${item.content}`).join("\n\n")
          : "";
      } catch {
        throw new StudioError("invalid_history");
      }
    }
    const now = new Date().toISOString();
    const messages = [
      ...(guestContext
        ? [{ role: "user", content: guestContext, created_at: now }]
        : []),
      {
        role: "user",
        content: message ||
          "Please open a support ticket for this conversation.",
        created_at: now,
      },
      { role: "assistant", content: answer, created_at: now },
    ];
    const { data, error } = await admin.rpc("studio_support_append", {
      p_id: conversation.id,
      p_messages: messages,
      p_escalate: escalate,
    });
    if (error) throw error;
    return { conversation: data };
    };
    if (body.stream === true && action === "message") return supportStreamResponse(request, respond);
    return jsonResponse(request, await respond());
  } catch (error) {
    return handleStudioError(request, error);
  }
});
