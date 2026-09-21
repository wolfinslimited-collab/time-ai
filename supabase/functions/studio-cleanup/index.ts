import {
  handleStudioError,
  jsonResponse,
  requiredEnv,
  secureEquals,
  StudioError,
} from "../_shared/studio.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const batchSize = 100;
type ExpiredAsset = {
  id: string;
  bucket_id: string;
  object_path: string;
  status: "pending_upload" | "ready" | "failed";
  expires_at: string;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }

  try {
    const suppliedSecret = request.headers.get("x-studio-cleanup-secret")
      ?.trim() || "";
    if (
      !suppliedSecret ||
      !secureEquals(suppliedSecret, requiredEnv("STUDIO_CLEANUP_SECRET"))
    ) {
      throw new StudioError("invalid_cleanup_secret", 401);
    }

    const admin = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const now = new Date().toISOString();
    const { data: expired, error: expiredError } = await admin
      .from("studio_assets")
      .select("id,bucket_id,object_path,status,expires_at")
      .is("retained_at", null)
      .not("expires_at", "is", null)
      .lte("expires_at", now)
      .neq("status", "deleted")
      .order("expires_at", { ascending: true })
      .limit(500);
    if (expiredError) throw expiredError;
    const expiredAssets = (expired ?? []) as ExpiredAsset[];

    let deleted = 0;
    const failures: Array<{ bucket: string; count: number }> = [];
    const byBucket = new Map<string, ExpiredAsset[]>();
    for (const asset of expiredAssets) {
      const bucketAssets = byBucket.get(asset.bucket_id) ?? [];
      bucketAssets.push(asset);
      byBucket.set(asset.bucket_id, bucketAssets);
    }

    for (const [bucket, assets] of byBucket) {
      for (let index = 0; index < assets.length; index += batchSize) {
        const batch = assets.slice(index, index + batchSize);
        const { data: claimed, error: claimError } = await admin
          .from("studio_assets")
          .update({ status: "deleted", deleted_at: now })
          .in("id", batch.map((asset) => asset.id))
          .is("retained_at", null)
          .lte("expires_at", now)
          .neq("status", "deleted")
          .select("id");
        if (claimError) throw claimError;
        const claimedIds = new Set((claimed ?? []).map((asset) => asset.id));
        const claimedAssets = batch.filter((asset) => claimedIds.has(asset.id));
        if (claimedAssets.length === 0) continue;

        const { error: removeError } = await admin.storage.from(bucket).remove(
          claimedAssets.map((asset) => asset.object_path),
        );
        if (removeError) {
          console.error("Studio retention removal failed", {
            bucket,
            count: claimedAssets.length,
            error: removeError.message,
          });
          failures.push({ bucket, count: claimedAssets.length });
          for (const asset of claimedAssets) {
            const { error: restoreError } = await admin.from("studio_assets")
              .update({
                status: asset.status,
                expires_at: asset.expires_at,
                deleted_at: null,
              })
              .eq("id", asset.id)
              .eq("status", "deleted");
            if (restoreError) {
              console.error("Studio retention claim restore failed", {
                assetId: asset.id,
                error: restoreError.message,
              });
            }
          }
          continue;
        }
        deleted += claimedAssets.length;
      }
    }

    return jsonResponse(request, {
      ok: failures.length === 0,
      scanned: expiredAssets.length,
      deleted,
      failures,
      hasMore: expiredAssets.length === 500,
    }, failures.length === 0 ? 200 : 207);
  } catch (error) {
    return handleStudioError(request, error);
  }
});
