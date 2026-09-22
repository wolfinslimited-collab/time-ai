import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
  studioCorsHeaders,
  StudioError,
} from "../_shared/studio.ts";
import { refreshProviderJob, resolveProvider } from "../_shared/providers.ts";
import {
  isStudioUuid,
  STUDIO_PLATFORM_LIMITS,
} from "../_shared/regulation.ts";

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
    if (!isStudioUuid(generationId)) {
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
    const route = resolveProvider(generation.provider);
    const refreshed = await refreshProviderJob(
      route,
      generationId,
      STUDIO_PLATFORM_LIMITS.providerRefreshTimeoutMs,
    );
    return jsonResponse(request, refreshed);
  } catch (error) {
    return handleStudioError(request, error);
  }
});
