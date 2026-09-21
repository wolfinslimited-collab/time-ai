import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
  requiredEnv,
  studioCorsHeaders,
  StudioError,
} from "../_shared/studio.ts";
import {
  sanitizeChatAnswer,
  TIMELESS_CHAT_SYSTEM_PROMPT,
} from "../_shared/chat.ts";

import { requestWaveSpeedChat } from "../_shared/wavespeed.ts";

const CHAT_COST = 1;
const CHAT_MODEL = "gpt-5-2";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: studioCorsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }

  let chargeReference: string | undefined;
  let userId: string | undefined;
  let reserved = false;
  let refundAdmin:
    | Awaited<ReturnType<typeof authenticateStudioRequest>>["admin"]
    | undefined;
  try {
    const { admin, user } = await authenticateStudioRequest(request);
    refundAdmin = admin;
    userId = user.id;
    const body = await request.json().catch(() => ({}));
    const projectId = String(body?.projectId ?? "").trim();
    const requestedThreadId = String(body?.threadId ?? "").trim();
    const content = String(body?.message ?? "").trim();

    if (!isUuid(projectId)) throw new StudioError("invalid_project_id");
    if (requestedThreadId && !isUuid(requestedThreadId)) {
      throw new StudioError("invalid_thread_id");
    }
    if (content.length < 1 || content.length > 12000) {
      throw new StudioError("invalid_chat_message");
    }

    const { data: project, error: projectError } = await admin
      .from("studio_projects").select("id").eq("id", projectId)
      .eq("user_id", user.id).maybeSingle();
    if (projectError) throw projectError;
    if (!project) throw new StudioError("project_not_found", 404);

    let threadId = requestedThreadId;
    if (threadId) {
      const { data: thread, error } = await admin.from("studio_chat_threads")
        .select("id").eq("id", threadId).eq("user_id", user.id)
        .eq("project_id", projectId).maybeSingle();
      if (error) throw error;
      if (!thread) throw new StudioError("chat_thread_not_found", 404);
    } else {
      const { data: thread, error } = await admin.from("studio_chat_threads")
        .insert({
          user_id: user.id,
          project_id: projectId,
          title: content.replace(/\s+/g, " ").slice(0, 80),
          model_key: CHAT_MODEL,
        }).select("id").single();
      if (error) throw error;
      threadId = String(thread.id);
    }

    const userMessageId = crypto.randomUUID();
    chargeReference = `chat:${userMessageId}`;
    const { error: userMessageError } = await admin
      .from("studio_chat_messages").insert({
        id: userMessageId,
        thread_id: threadId,
        user_id: user.id,
        role: "user",
        content,
      });
    if (userMessageError) throw userMessageError;

    const { error: reserveError } = await admin.rpc(
      "studio_spend_chat_credits",
      {
        p_user_id: user.id,
        p_reference_id: chargeReference,
        p_amount: CHAT_COST,
      },
    );
    if (reserveError) {
      await admin.from("studio_chat_messages").delete().eq("id", userMessageId);
      if (reserveError.message.includes("insufficient_studio_credits")) {
        throw new StudioError("insufficient_credits", 402, {
          required: CHAT_COST,
        });
      }
      throw reserveError;
    }
    reserved = true;

    const { data: recent, error: recentError } = await admin
      .from("studio_chat_messages")
      .select("role,content")
      .eq("thread_id", threadId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (recentError) throw recentError;
    const messages = [
      { role: "system", content: TIMELESS_CHAT_SYSTEM_PROMPT },
      ...(recent || []).reverse().map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const providerResponse = await requestWaveSpeedChat(
      requiredEnv("WAVESPEED_API_KEY"), "openai/gpt-5.2", messages,
    );
    const providerBody = await providerResponse.json().catch(() => ({}));
    const answer = sanitizeChatAnswer(
      providerBody?.choices?.[0]?.message?.content,
    );
    if (!providerResponse.ok || !answer) {
      throw new StudioError("wavespeed_chat_failed", 502, {
        providerStatus: providerResponse.status,
      });
    }

    const totalTokens = Number(providerBody?.usage?.total_tokens ?? 0);
    const { data: assistantMessage, error: assistantError } = await admin
      .from("studio_chat_messages").insert({
        thread_id: threadId,
        user_id: user.id,
        role: "assistant",
        content: answer,
        credits_charged: CHAT_COST,
        provider_tokens: Number.isFinite(totalTokens) ? totalTokens : null,
      }).select("id,role,content,credits_charged,provider_tokens,created_at")
      .single();
    if (assistantError) throw assistantError;

    await admin.from("studio_chat_threads").update({
      updated_at: new Date().toISOString(),
    }).eq("id", threadId);

    return jsonResponse(request, {
      threadId,
      message: assistantMessage,
      creditsCharged: CHAT_COST,
    });
  } catch (error) {
    if (reserved && chargeReference && userId && refundAdmin) {
      try {
        await refundAdmin.rpc("studio_refund_chat_credits", {
          p_user_id: userId,
          p_reference_id: chargeReference,
        });
      } catch (refundError) {
        console.error("Studio chat refund failed", refundError);
      }
    }
    return handleStudioError(request, error);
  }
});

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}
