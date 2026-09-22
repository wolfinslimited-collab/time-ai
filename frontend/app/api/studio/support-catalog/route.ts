import { modelCatalog } from "../../../lib/studio/model-catalog";

export function GET() {
  return Response.json({
    entries: Object.entries(modelCatalog).flatMap(([mediaType, entries]) => entries.map(entry => ({
      name: entry.name, mediaType, modelKey: entry.modelKey ?? null,
      status: entry.modelKey ? "configured" : "coming_soon",
    }))),
  }, {headers: {"Cache-Control": "public, max-age=60"}});
}
