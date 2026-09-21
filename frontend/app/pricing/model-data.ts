export type PricingModel = { key: string; name: string; kind: string; defaults: Record<string, string | number | boolean>; durations: (string | number)[] };
export const pricingModels: PricingModel[] = [
  {
    "key": "nano-banana-2-1k",
    "name": "Nano Banana 2",
    "kind": "image",
    "defaults": {
      "resolution": "1K",
      "aspect_ratio": "auto",
      "output_format": "png"
    },
    "durations": [
      1
    ]
  },
  {
    "key": "flux-2-flex-1k",
    "name": "FLUX.2 Flex",
    "kind": "image",
    "defaults": {
      "resolution": "1K",
      "aspect_ratio": "1:1",
      "nsfw_checker": true
    },
    "durations": [
      1
    ]
  },
  {
    "key": "gpt-image-2",
    "name": "GPT Image 2",
    "kind": "image",
    "defaults": {
      "resolution": "1K",
      "aspect_ratio": "16:9"
    },
    "durations": [
      1
    ]
  },
  {
    "key": "gpt-image-1-5",
    "name": "GPT Image 1.5",
    "kind": "image",
    "defaults": {
      "quality": "medium",
      "aspect_ratio": "1:1"
    },
    "durations": [
      1
    ]
  },
  {
    "key": "seedream-5-lite",
    "name": "Seedream 5.0 Lite",
    "kind": "image",
    "defaults": {
      "quality": "basic",
      "aspect_ratio": "1:1",
      "nsfw_checker": true,
      "output_format": "png"
    },
    "durations": [
      1
    ]
  },
  {
    "key": "seedream-5-pro",
    "name": "Seedream 5.0 Pro",
    "kind": "image",
    "defaults": {
      "quality": "basic",
      "aspect_ratio": "1:1",
      "nsfw_checker": true,
      "output_format": "png"
    },
    "durations": [
      1
    ]
  },
  {
    "key": "seedance-1-5-pro-720p-8s",
    "name": "Seedance 1.5 Pro",
    "kind": "video",
    "defaults": {
      "duration": 8,
      "fixed_lens": false,
      "resolution": "720p",
      "aspect_ratio": "16:9",
      "nsfw_checker": true,
      "generate_audio": false
    },
    "durations": [
      4,
      8,
      12
    ]
  },
  {
    "key": "kling-3-video",
    "name": "Kling 3.0",
    "kind": "video",
    "defaults": {
      "mode": "std",
      "sound": false,
      "duration": "5",
      "multi_shots": false,
      "aspect_ratio": "16:9"
    },
    "durations": [
      "3",
      "5",
      "8",
      "10",
      "15"
    ]
  },
  {
    "key": "wan-3-video",
    "name": "Wan 3.0",
    "kind": "video",
    "defaults": {
      "audio": true,
      "duration": 5,
      "resolution": "480P",
      "aspect_ratio": "adaptive"
    },
    "durations": [
      5,
      10,
      15,
      30
    ]
  }
];
