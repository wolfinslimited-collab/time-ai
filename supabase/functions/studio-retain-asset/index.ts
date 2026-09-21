import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
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
    const assetId = String(body?.assetId ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(assetId)) {
      throw new StudioError("invalid_asset_id");
    }

    const { data: asset, error: assetError } = await admin
      .from("studio_assets")
      .select("id, role, status, expires_at, retained_at")
      .eq("id", assetId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (assetError) throw assetError;
    if (!asset || asset.role !== "output") {
      throw new StudioError("asset_not_found", 404);
    }
    if (asset.status !== "ready") {
      throw new StudioError("asset_not_retainable", 409);
    }
    if (
      !asset.retained_at && asset.expires_at &&
      new Date(asset.expires_at).getTime() <= Date.now()
    ) {
      throw new StudioError("asset_expired", 410);
    }

    const retainedAt = asset.retained_at ?? new Date().toISOString();
    if (asset.retained_at) {
      return jsonResponse(request, {
        assetId: asset.id,
        retainedAt,
        expiresAt: null,
      });
    }
    const { data: retained, error: retainError } = await admin
      .from("studio_assets")
      .update({ retained_at: retainedAt, expires_at: null })
      .eq("id", asset.id)
      .eq("user_id", user.id)
      .eq("status", "ready")
      .is("retained_at", null)
      .gt("expires_at", retainedAt)
      .select("id")
      .maybeSingle();
    if (retainError) throw retainError;
    if (!retained) throw new StudioError("asset_expired", 410);

    return jsonResponse(request, {
      assetId: asset.id,
      retainedAt,
      expiresAt: null,
    });
  } catch (error) {
    return handleStudioError(request, error);
  }
});
