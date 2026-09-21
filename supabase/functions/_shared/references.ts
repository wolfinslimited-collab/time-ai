// This pure contract is shared with the Studio client. Only owned, verified assets
// receive URLs in the adapter; user-supplied URLs are never accepted here.
export type ReferenceSlot = {
  key: string; label: string; field: string; mimeTypes: string[]; max: number; min?: number;
  encoding?: 'url' | 'urls' | 'video_list' | 'image_references';
  maxBytes?: number; minDuration?: number; maxDuration?: number; totalDuration?: number;
  minSide?: number; maxSide?: number; minRatio?: number; maxRatio?: number;
  minPixels?: number; maxPixels?: number; minFps?: number; maxFps?: number;
  maxClipDuration?: number; group?: 'frames' | 'references'; weight?: number;
};
export type ReferenceConfig = {
  referenceSlots?: ReferenceSlot[]; referenceQuota?: number; minInputs?: number;
  frameAspectRatio?: string; omitPrompt?: boolean; maxCombinedDuration?: number; supportsShots?: boolean; imageModel?: string; autoDurationWithVideo?: boolean;
};
export type ReferenceAsset = {
  id: string; slot: string; mimeType: string; sizeBytes: number; duration?: number;
  width?: number; height?: number; fps?: number; start?: number; end?: number; url?: string;
};
export function referenceError(config: ReferenceConfig, assets: ReferenceAsset[], complete = true, parameters: Record<string,unknown> = {}): string | null {
  const slots = config.referenceSlots || [];
  if (new Set(assets.map(a => a.id)).size !== assets.length) return 'duplicate_reference';
  if (complete && assets.length < (config.minInputs || 0)) return 'reference_required';
  let quota = 0; const groups = new Set<string>();
  for (const asset of assets) {
    const slot = slots.find(s => s.key === asset.slot);
    if (!slot) return 'invalid_reference_slot';
    if (!slot.mimeTypes.includes(asset.mimeType)) return 'unsupported_reference_type';
    if (!Number.isFinite(asset.sizeBytes) || asset.sizeBytes <= 0 || asset.sizeBytes > (slot.maxBytes || 10 * 1024 * 1024)) return 'reference_file_too_large';
    if (slot.group) groups.add(slot.group);
    quota += slot.weight || 1;
    if (asset.mimeType.startsWith('video/') || asset.mimeType.startsWith('audio/')) {
      if (!Number.isFinite(asset.duration) || asset.duration! <= 0) return 'invalid_reference_media';
      if (asset.duration! < (slot.minDuration || 0) || asset.duration! > (slot.maxDuration || 30)) return 'invalid_reference_duration';
      if (slot.encoding === 'video_list') {
        const start = asset.start ?? 0, end = asset.end ?? Math.min(asset.duration!, slot.maxClipDuration || 10);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > asset.duration! + 0.05 || end - start > (slot.maxClipDuration || 10) + 0.001) return 'invalid_reference_trim';
      }
    }
    if (asset.mimeType.startsWith('image/') || asset.mimeType.startsWith('video/')) {
      const w = asset.width || 0, h = asset.height || 0;
      if (!w || !h) return 'invalid_reference_media';
      if (Math.min(w,h) < (slot.minSide || 1) || Math.max(w,h) > (slot.maxSide || 30000) || w/h < (slot.minRatio || 0) || w/h > (slot.maxRatio || 1000) || w*h < (slot.minPixels || 1) || w*h > (slot.maxPixels || 1e9)) return 'invalid_reference_dimensions';
      if (asset.mimeType.startsWith('video/') && (slot.minFps || slot.maxFps) && (!asset.fps || asset.fps < (slot.minFps || 0) - 0.05 || asset.fps > (slot.maxFps || 120) + 0.05)) return 'invalid_reference_fps';
    }
  }
  if (groups.has('frames') && groups.has('references')) return 'conflicting_reference_modes';
  if (complete && assets.some(a => a.slot === 'last') && !assets.some(a => a.slot === 'first')) return 'first_frame_required';
  if (config.referenceQuota && quota > config.referenceQuota) return 'too_many_reference_slots';
  for (const slot of slots) {
    const selected = assets.filter(a => a.slot === slot.key);
    if (selected.length > slot.max) return 'too_many_references';
    if (complete && selected.length < (slot.min || 0)) return 'reference_required';
    if (slot.totalDuration && selected.reduce((n,a) => n + (a.duration || 0),0) > slot.totalDuration + 0.05) return 'reference_total_duration_exceeded';
  }
  if (config.maxCombinedDuration && assets.filter(a=>a.mimeType.startsWith("video/")).reduce((n,a)=>n+(a.duration||0),0) + Number(parameters.duration||0) > config.maxCombinedDuration + 0.05) return "reference_output_duration_exceeded";
  return null;
}
export function referencePricing(assets: ReferenceAsset[]) {
  return {
    _hasVideo: assets.some(a => a.mimeType.startsWith('video/')),
    _videoSeconds: Math.ceil(assets.filter(a => a.mimeType.startsWith('video/')).reduce((n,a) => n + (a.duration || 0),0)),
    _audioSeconds: Math.ceil(assets.filter(a => a.mimeType.startsWith('audio/')).reduce((n,a) => n + (a.duration || 0),0)),
    _imageCount: assets.filter(a => a.mimeType.startsWith('image/')).length,
  };
}
export function referenceFields(config: ReferenceConfig, assets: ReferenceAsset[]) {
  const input: Record<string, unknown> = {};
  for (const slot of config.referenceSlots || []) {
    const refs = assets.filter(a => a.slot === slot.key);
    if (!refs.length) continue;
    if (refs.some(a => !a.url)) throw Error('reference_url_missing');
    input[slot.field] = slot.encoding === 'url' ? refs[0].url
      : slot.encoding === 'video_list' ? refs.map(a => ({url:a.url,start:a.start ?? 0,ends:a.end ?? Math.min(a.duration!,slot.maxClipDuration || 10)}))
      : slot.encoding === 'image_references' ? refs.map((a,i) => ({image_url:a.url,type:'subject',ref_name:`Reference${i+1}`}))
      : refs.map(a => a.url);
  }
  return input;
}

export function shotSequenceError(supported: boolean, shots: unknown, referenceCount: number): string | null {
  if (!supported || !Array.isArray(shots) || shots.length < 2 || shots.length > 5) return 'invalid_shots';
  if (shots.some(s => typeof s?.prompt !== 'string' || !s.prompt.trim() || s.prompt.length > 500 || !Number.isInteger(s.duration) || s.duration < 1 || s.duration > 12)) return 'invalid_shots';
  const total = shots.reduce((sum,s) => sum + s.duration, 0);
  return total < 3 || total > 15 || referenceCount > 1 ? 'invalid_shot_duration_or_references' : null;
}
