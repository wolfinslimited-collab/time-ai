import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
  safeFileName,
  studioCorsHeaders,
  StudioError,
} from "../_shared/studio.ts";

const mimeLimits: Record<string, number> = {
  "audio/wav": 10 * 1024 * 1024,
  "image/jpeg": 25 * 1024 * 1024,
  "image/png": 25 * 1024 * 1024,
  "image/webp": 25 * 1024 * 1024,
  "video/mp4": 100 * 1024 * 1024,
  "video/quicktime": 100 * 1024 * 1024,
};

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
    const projectId = String(body?.projectId ?? "").trim();
    const fileName = safeFileName(String(body?.fileName ?? "asset"));
    const mimeType = String(body?.mimeType ?? "").trim().toLowerCase();
    const sizeBytes = Number(body?.sizeBytes);

    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) {
      throw new StudioError("invalid_project_id");
    }
    const sizeLimit = mimeLimits[mimeType];
    if (!sizeLimit) {
      throw new StudioError("unsupported_mime_type", 400, {
        allowed: Object.keys(mimeLimits),
      });
    }
    if (
      !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 ||
      sizeBytes > sizeLimit
    ) {
      throw new StudioError("invalid_file_size", 400, { maxBytes: sizeLimit });
    }

    const { data: project, error: projectError } = await admin
      .from("studio_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) throw new StudioError("project_not_found", 404);

    const assetId = crypto.randomUUID();
    const objectPath = `${user.id}/${projectId}/${assetId}/${fileName}`;
    const { error: assetError } = await admin.from("studio_assets").insert({
      id: assetId,
      user_id: user.id,
      project_id: projectId,
      role: "input",
      bucket_id: "studio-inputs",
      object_path: objectPath,
      original_filename: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      status: "pending_upload",
    });
    if (assetError) throw assetError;

    const { data: signedUpload, error: uploadError } = await admin.storage
      .from("studio-inputs")
      .createSignedUploadUrl(objectPath);
    if (uploadError || !signedUpload) {
      await admin.from("studio_assets").delete().eq("id", assetId);
      throw uploadError ?? new Error("signed_upload_failed");
    }

    return jsonResponse(request, {
      asset: {
        id: assetId,
        projectId,
        mimeType,
        sizeBytes,
        status: "pending_upload",
      },
      upload: {
        method: "PUT",
        url: signedUpload.signedUrl,
        token: signedUpload.token,
        headers: { "Content-Type": mimeType },
      },
    }, 201);
  } catch (error) {
    return handleStudioError(request, error);
  }
});
