import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
  requiredEnv,
  studioCorsHeaders,
  StudioError,
} from "../_shared/studio.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: studioCorsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }
  try {
    const { admin, user } = await authenticateStudioRequest(request);
    const body = await request.json().catch(() => ({}));
    const generationId = String(body?.generationId ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(generationId)) {
      throw new StudioError("invalid_generation_id");
    }
    const { data: generation, error } = await admin
      .from("studio_generations")
      .select("id,status,provider")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!generation) throw new StudioError("generation_not_found", 404);
    if (["succeeded", "failed", "canceled"].includes(generation.status)) {
      return jsonResponse(request, { generation, terminal: true });
    }
    if (generation.provider !== "kie") {
      throw new StudioError("provider_refresh_unsupported", 409);
    }
    const response = await fetch(requiredEnv("STUDIO_PROVIDER_SUBMIT_URL"), {
      method: "POST",
      signal: AbortSignal.timeout(130_000),
      headers: {
        "Authorization": `Bearer ${requiredEnv("STUDIO_PROVIDER_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "refresh", clientJobId: generationId }),
    });
    const refreshed = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new StudioError("provider_refresh_failed", 502, {
        providerStatus: response.status,
      });
    }
    return jsonResponse(request, refreshed);
  } catch (error) {
    return handleStudioError(request, error);
  }
});
