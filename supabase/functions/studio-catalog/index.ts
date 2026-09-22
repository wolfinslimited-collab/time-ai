import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleStudioError,
  jsonResponse,
  requiredEnv,
  studioCorsHeaders,
} from "../_shared/studio.ts";
import {
  loadActiveCatalogModels,
  loadActiveCreditPacks,
  toPublicCatalogModel,
} from "../_shared/regulation.ts";
import {
  loadActiveStudioTools,
  toPublicStudioTool,
} from "../_shared/tools.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: studioCorsHeaders(request) });
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }

  try {
    const admin = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const [models, packs, tools] = await Promise.all([
      loadActiveCatalogModels(admin),
      loadActiveCreditPacks(admin),
      loadActiveStudioTools(admin),
    ]);
    return jsonResponse(request, {
      ok: true,
      models: models.map(toPublicCatalogModel),
      packs,
      tools: tools.map(toPublicStudioTool),
    });
  } catch (error) {
    return handleStudioError(request, error);
  }
});
