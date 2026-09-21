import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
  studioCorsHeaders,
  StudioError,
  verifyStoredObject,
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
    const requestedExpiry = Number(body?.expiresIn ?? 900);
    const expiresIn = Math.min(
      Math.max(Number.isFinite(requestedExpiry) ? requestedExpiry : 900, 60),
      3600,
    );
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(assetId)) {
      throw new StudioError("invalid_asset_id");
    }

    const { data: asset, error: assetError } = await admin
      .from("studio_assets")
      .select(
        "id, bucket_id, object_path, mime_type, status, expires_at, retained_at",
      )
      .eq("id", assetId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (assetError) throw assetError;
    if (!asset || asset.status === "deleted") {
      throw new StudioError("asset_not_found", 404);
    }
    if (
      !asset.retained_at && asset.expires_at &&
      new Date(asset.expires_at).getTime() <= Date.now()
    ) {
      throw new StudioError("asset_expired", 410);
    }

    if (asset.status === "pending_upload") {
      const exists = await verifyStoredObject(
        admin,
        asset.bucket_id,
        asset.object_path,
      );
      if (!exists) throw new StudioError("asset_upload_incomplete", 409);
      const { error: updateError } = await admin
        .from("studio_assets")
        .update({ status: "ready" })
        .eq("id", asset.id);
      if (updateError) throw updateError;
    }
    if (asset.status === "failed") throw new StudioError("asset_failed", 409);

    const { data: signed, error: signedError } = await admin.storage
      .from(asset.bucket_id)
      .createSignedUrl(asset.object_path, expiresIn);
    if (signedError || !signed) {
      throw signedError ?? new Error("signed_url_failed");
    }

    return jsonResponse(request, {
      assetId: asset.id,
      url: signed.signedUrl,
      mimeType: asset.mime_type,
      expiresIn,
    });
  } catch (error) {
    return handleStudioError(request, error);
  }
});
