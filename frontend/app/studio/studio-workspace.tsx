"use client";

import videoModels from "./video-models.json";
import { validParameterOptions, updateModelParameter } from "./video-settings";

import { studioCatalogPricing } from "./catalog-pricing";

import type { Session, User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  AudioLines,
  BadgePlus,
  Bookmark,
  BookOpenText,
  Camera,
  Check,
  ChevronDown,
  Clapperboard,
  Clock3,
  Coins,
  Copy,
  Download,
  Eraser,
  FolderKanban,
  ImageIcon,
  Layers3,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Maximize2,
  MessageSquareText,
  Mic2,
  Music2,
  Palette,
  Paperclip,
  Plus,
  RefreshCw,
  ScanFace,
  Search,
  Send,
  Settings2,
  Shirt,
  Sparkles,
  SunMedium,
  Upload,
  WandSparkles,
  Waves,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMetaBrowserIdentifiers, trackMetaEvent } from "../meta-pixel";
import referenceOverrides from './reference-overrides.json';
import {referenceError,referencePricing,shotSequenceError,type ReferenceConfig} from './references';
import {ReferencePanel,referenceMessage,type UploadedReference} from './reference-panel';
import { calculateStudioCredits, type StudioCreditRules } from "./pricing";
import { modelCatalog, type CatalogModel } from "./model-catalog";
import { studioSupabase } from "./supabase";
import { StudioSupport } from "./studio-support";
import { clearAuthErrorUrl, emailAuthErrorMessage, googleSignInUrl, socialAuthErrorMessage } from "./auth";

type MediaType = "image" | "video" | "audio" | "chat";
type GenerativeMediaType = Exclude<MediaType, "chat">;

type StudioModel = {
  key: string;
  name: string;
  description: string;
  media_type: GenerativeMediaType;
  credit_cost: number;
  credit_rules?: StudioCreditRules | null;
  badge: string | null;
  parameter_schema: { forbiddenCombinations?: Record<string, string | number | boolean>[]; properties?: Record<string, { type?: string; enum?: Array<string | number | boolean> }> };
  provider_config: ReferenceConfig & { minInputs?: number; maxInputs?: number; inputMimeTypes?: string[]; allowNegativePrompt?: boolean; maxPromptLength?: number; inputField?: string; defaultInput?: Record<string, string | number | boolean> };
};

type StudioProject = { id: string; name: string };
type StudioGeneration = {
  id: string; project_id: string; model_key: string; media_type: GenerativeMediaType;
  status: "created" | "queued" | "processing" | "succeeded" | "failed" | "canceled";
  prompt: string; progress: number; credits_charged: number; error_message: string | null; created_at: string;
};
type StudioOutputAsset = {
  id: string; generation_id: string; status: "pending_upload" | "ready" | "failed" | "deleted";
  expires_at: string | null; retained_at: string | null;
};
type CreditPack = { key: string; name: string; description: string; credits: number; price_cents: number; currency: string; badge: string | null };
type CheckoutConfirmation = { creditsAdded: number; balance: number };
type StudioTool = {
  key: string; mediaType: GenerativeMediaType; name: string; description: string; icon: LucideIcon;
  badge?: string; available?: boolean; reference?: boolean; modelKey?: string; promptPrefix?: string;
};

type ChatThread = { id: string; title: string; project_id: string; model_key: string; updated_at: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; credits_charged: number; provider_tokens: number | null; created_at: string };
type ShowcaseExample = {
  key: string;
  title: string;
  category: string;
  image: string;
  alt: string;
  prompt: string;
  style: string;
  toolKey: string;
  model?: string;
  badge?: "New" | "Trending";
  size?: "wide" | "tall" | "standard";
};

const fallbackModels: StudioModel[] = [
  {
    key: "nano-banana-2-1k", name: "Nano Banana 2", description: "Fast image creation and editing from 1K drafts to 4K finals.",
    media_type: "image", ...studioCatalogPricing["nano-banana-2-1k"], badge: "Popular",
    parameter_schema: { properties: {
      aspect_ratio: { type: "string", enum: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"] },
      resolution: { type: "string", enum: ["1K", "2K", "4K"] }, output_format: { type: "string", enum: ["png", "jpg"] },
    } },
    provider_config: { inputField: "image_input", defaultInput: { aspect_ratio: "auto", resolution: "1K", output_format: "png" } },
  },
  {
    key: "flux-2-flex-1k", name: "FLUX.2 Flex", description: "Detailed cinematic image generation with 1K and 2K output.",
    media_type: "image", ...studioCatalogPricing["flux-2-flex-1k"], badge: null,
    parameter_schema: { properties: {
      aspect_ratio: { type: "string", enum: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"] },
      resolution: { type: "string", enum: ["1K", "2K"] }, nsfw_checker: { type: "boolean" },
    } },
    provider_config: { defaultInput: { aspect_ratio: "1:1", resolution: "1K", nsfw_checker: true } },
  },
  {
    key: "gpt-image-2", name: "GPT Image 2", description: "Premium image rendering with precise text and 1K, 2K, or 4K output.",
    media_type: "image", ...studioCatalogPricing["gpt-image-2"], badge: "New",
    parameter_schema: { properties: {
      aspect_ratio: { type: "string", enum: ["3:2", "2:3", "4:3", "3:4", "16:9", "9:16"] },
      resolution: { type: "string", enum: ["1K", "2K", "4K"] },
    } },
    provider_config: { defaultInput: { aspect_ratio: "16:9", resolution: "1K" } },
  },
  {
    key: "gpt-image-1-5", name: "GPT Image 1.5", description: "Creative image generation with medium or high quality output.",
    media_type: "image", ...studioCatalogPricing["gpt-image-1-5"], badge: null,
    parameter_schema: { properties: {
      aspect_ratio: { type: "string", enum: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"] },
      quality: { type: "string", enum: ["medium", "high"] },
    } },
    provider_config: { defaultInput: { aspect_ratio: "1:1", quality: "medium" } },
  },
  {
    key: "seedream-5-lite", name: "Seedream 5.0 Lite", description: "Efficient photorealistic image generation for rapid exploration.",
    media_type: "image", ...studioCatalogPricing["seedream-5-lite"], badge: "New",
    parameter_schema: { properties: {
      aspect_ratio: { type: "string", enum: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"] },
      quality: { type: "string", enum: ["basic"] }, output_format: { type: "string", enum: ["png", "jpeg"] }, nsfw_checker: { type: "boolean" },
    } },
    provider_config: { defaultInput: { aspect_ratio: "1:1", quality: "basic", output_format: "png", nsfw_checker: true } },
  },
  {
    key: "seedream-5-pro", name: "Seedream 5.0 Pro", description: "Art-directed photorealistic imagery in 1K basic or 2K high quality.",
    media_type: "image", ...studioCatalogPricing["seedream-5-pro"], badge: "Pro",
    parameter_schema: { properties: {
      aspect_ratio: { type: "string", enum: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"] },
      quality: { type: "string", enum: ["basic", "high"] }, output_format: { type: "string", enum: ["png", "jpeg"] }, nsfw_checker: { type: "boolean" },
    } },
    provider_config: { defaultInput: { aspect_ratio: "1:1", quality: "basic", output_format: "png", nsfw_checker: true } },
  },
  {
    key: "seedance-1-5-pro-720p-8s", name: "Seedance 1.5 Pro", description: "Cinematic 4–12 second video with 480p–1080p output and optional native audio.",
    media_type: "video", ...studioCatalogPricing["seedance-1-5-pro-720p-8s"], badge: "Popular",
    parameter_schema: { properties: {
      aspect_ratio: { type: "string", enum: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"] }, resolution: { type: "string", enum: ["480p", "720p", "1080p"] },
      duration: { type: "integer", enum: [4, 8, 12] }, fixed_lens: { type: "boolean" }, generate_audio: { type: "boolean" }, nsfw_checker: { type: "boolean" },
    } },
    provider_config: { inputField: "input_urls", defaultInput: { aspect_ratio: "16:9", resolution: "720p", duration: 8, fixed_lens: false, generate_audio: false, nsfw_checker: true } },
  },
  {
    key: "kling-3-video", name: "Kling 3.0", description: "Expressive 3–15 second video with standard, pro, and 4K modes.",
    media_type: "video", ...studioCatalogPricing["kling-3-video"], badge: "New",
    parameter_schema: { properties: {
      aspect_ratio: { type: "string", enum: ["16:9", "9:16", "1:1"] }, duration: { type: "string", enum: ["3", "5", "8", "10", "15"] },
      mode: { type: "string", enum: ["std", "pro", "4K"] }, sound: { type: "boolean" }, multi_shots: { type: "boolean", enum: [false] },
    } },
    provider_config: { inputField: "image_urls", defaultInput: { aspect_ratio: "16:9", duration: "5", mode: "std", sound: false, multi_shots: false } },
  },
  {
    key: "wan-3-video", name: "Wan 3.0", description: "Flexible 2–30 second video with 480p, 720p, and 1080p output.",
    media_type: "video", ...studioCatalogPricing["wan-3-video"], badge: "New",
    parameter_schema: { properties: {
      resolution: { type: "string", enum: ["480P", "720P", "1080P"] }, aspect_ratio: { type: "string", enum: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"] },
      duration: { type: "integer", enum: [5, 10, 15, 30] }, audio: { type: "boolean" },
    } },
    provider_config: { inputField: "first_frame_url", defaultInput: { resolution: "480P", aspect_ratio: "adaptive", duration: 5, audio: true } },
  },
  {
    key: "elevenlabs-dialogue-v3", name: "ElevenLabs Dialogue v3", description: "Natural creator narration using Kie's Dialogue v3 voice engine.",
    media_type: "audio", credit_cost: 10, badge: "Voice",
    parameter_schema: { properties: {
      stability: { type: "number", enum: [0.35, 0.5, 0.75] },
    } },
    provider_config: { defaultInput: { voice: "EkK5I93UQWFDigLMpZcX", stability: 0.5 } },
  },
  ...videoModels as unknown as StudioModel[],
].map(model => ({...model,...(referenceOverrides as Record<string, unknown>)[model.key] as object})) as StudioModel[];

const fallbackPacks: CreditPack[] = [
  { key: "spark", name: "Spark", description: "For quick image concepts.", credits: 1000, price_cents: 999, currency: "usd", badge: null },
  { key: "creator", name: "Creator", description: "For a weekly creative workflow.", credits: 3500, price_cents: 2999, currency: "usd", badge: "Most popular" },
  { key: "production", name: "Production", description: "For image, video, sound, and chat production.", credits: 10000, price_cents: 7999, currency: "usd", badge: "Best value" },
];

const tools: StudioTool[] = [
  { key: "image-trends", mediaType: "image", name: "Trends", description: "Start from visual formats creators are using now.", icon: Sparkles, badge: "New" },
  { key: "create-image", mediaType: "image", name: "Create image", description: "Turn any idea into a polished visual.", icon: WandSparkles, badge: "Popular", available: true, modelKey: "nano-banana-2-1k" },
  { key: "cinematic-image", mediaType: "image", name: "Cinematic camera", description: "Direct the lens, framing, and point of view.", icon: Camera, badge: "Pro", available: true, modelKey: "flux-2-flex-1k", promptPrefix: "Create a cinematic photograph with intentional lens choice and composition. " },
  { key: "moodboard", mediaType: "image", name: "Moodboard", description: "Turn references into one coherent visual direction.", icon: Palette },
  { key: "consistent-character", mediaType: "image", name: "Consistent character", description: "Keep one identity across a visual series.", icon: ScanFace },
  { key: "virtual-face", mediaType: "image", name: "Virtual face", description: "Build and manage a reusable virtual identity.", icon: ScanFace },
  { key: "moments-album", mediaType: "image", name: "Moments album", description: "Generate a coordinated set with one mood.", icon: ImageIcon, badge: "New" },
  { key: "relight", mediaType: "image", name: "Relight", description: "Control the light, mood, and color grade.", icon: SunMedium },
  { key: "inpaint", mediaType: "image", name: "Inpaint", description: "Select and replace one area precisely.", icon: Eraser },
  { key: "upscale-image", mediaType: "image", name: "Image upscale", description: "Increase detail and resolution cleanly.", icon: Maximize2 },
  { key: "face-swap", mediaType: "image", name: "Face swap", description: "Replace a face while preserving the scene.", icon: ScanFace },
  { key: "character-swap", mediaType: "image", name: "Character swap", description: "Replace the full subject in an existing scene.", icon: RefreshCw },
  { key: "sketch-to-image", mediaType: "image", name: "Sketch to image", description: "Turn a rough drawing into a finished visual.", icon: WandSparkles },
  { key: "virtual-try-on", mediaType: "image", name: "Virtual try-on", description: "Put a garment on a model naturally.", icon: Shirt, badge: "New" },
  { key: "edit-image", mediaType: "image", name: "Edit with a prompt", description: "Upload an image and describe the change.", icon: Layers3, available: true, reference: true, modelKey: "nano-banana-2-1k", promptPrefix: "Edit the reference image: " },
  { key: "product-shot", mediaType: "image", name: "Product studio", description: "Create clean campaign-ready product imagery.", icon: Camera, available: true, reference: true, modelKey: "nano-banana-2-1k", promptPrefix: "Create a premium commercial product photograph from the reference. " },
  { key: "style-transfer", mediaType: "image", name: "Style transfer", description: "Reimagine a reference in a new visual language.", icon: Palette, available: true, reference: true, modelKey: "nano-banana-2-1k", promptPrefix: "Restyle the reference image while preserving its subject. " },
  { key: "video-trends", mediaType: "video", name: "Trends", description: "Start from current short-form video formats.", icon: Sparkles, badge: "New" },
  { key: "create-video", mediaType: "video", name: "Create video", description: "Generate a cinematic sequence from text.", icon: Clapperboard, badge: "Popular", available: true, modelKey: "seedance-1-5-pro-720p-8s" },
  { key: "image-to-video", mediaType: "video", name: "Image to video", description: "Animate a still frame with natural motion.", icon: ImageIcon, available: true, reference: true, modelKey: "seedance-1-5-pro-720p-8s", promptPrefix: "Animate the reference image with cinematic motion. " },
  { key: "camera-motion", mediaType: "video", name: "Cinematic camera", description: "Direct the camera, lens, and movement.", icon: Camera, badge: "Pro", available: true, modelKey: "seedance-1-5-pro-720p-8s", promptPrefix: "Use deliberate cinematic camera movement: " },
  { key: "motion-presets", mediaType: "video", name: "Motion presets", description: "Apply production-ready camera moves in one click.", icon: WandSparkles, available: true, modelKey: "seedance-1-5-pro-720p-8s", promptPrefix: "Use a bold, production-ready camera move: " },
  { key: "viral-video", mediaType: "video", name: "Viral trends", description: "Turn an idea into a current social format.", icon: Sparkles, badge: "New" },
  { key: "sketch-to-video", mediaType: "video", name: "Sketch to video", description: "Develop a hand-drawn idea into a moving scene.", icon: WandSparkles },
  { key: "social-ad", mediaType: "video", name: "Social ad", description: "Build an attention-first vertical campaign clip.", icon: BadgePlus, available: true, modelKey: "seedance-1-5-pro-720p-8s", promptPrefix: "Create a polished social advertisement with a strong opening beat. " },
  { key: "first-last", mediaType: "video", name: "First & last frame", description: "Animate smoothly between two images.", icon: Layers3, available:true, reference:true, modelKey:"minimax-h3-image" },
  { key: "lip-sync", mediaType: "video", name: "Lip sync", description: "Match a video to your voice recording.", available:true, reference:true, modelKey:"video-lip-sync", icon: Mic2 },
  { key: "video-effects", mediaType: "video", name: "Video effects", description: "Transform style, atmosphere, and energy.", icon: Sparkles },
  { key: "virtual-character-ad", mediaType: "video", name: "Virtual character ad", description: "Create an ad led by a consistent virtual creator.", icon: BadgePlus, badge: "New" },
  { key: "video-edit", mediaType: "video", name: "Video edit", description: "Upload footage and describe the change.", icon: Clapperboard, badge: "New", available:true, reference:true, modelKey:"wan-2-7-edit" },
  { key: "character-swap-video", mediaType: "video", name: "Character swap in video", description: "Replace the subject throughout a moving shot.", icon: RefreshCw },
  { key: "change-video-speech", mediaType: "video", name: "Change video speech", description: "Replace spoken delivery while preserving timing.", icon: Mic2 },
  { key: "upscale-video", mediaType: "video", name: "Video upscale", description: "Enhance footage toward a 4K finish.", icon: Maximize2 },
  { key: "extend-video", mediaType: "video", name: "Extend video", description: "Continue a clip beyond its current ending.", icon: Plus },
  { key: "extend-grok", mediaType: "video", name: "Extend with Grok", description: "Continue the action with a context-aware model.", icon: Plus },
  { key: "audio-trends", mediaType: "audio", name: "Trends", description: "Start from audio formats creators are using now.", icon: Sparkles, badge: "New" },
  { key: "voiceover", mediaType: "audio", name: "Voiceover", description: "Turn a script into natural multilingual speech.", icon: Mic2, badge: "Provider paused" },
  { key: "narration", mediaType: "audio", name: "Narration", description: "Create a paced read for stories and explainers.", icon: BookOpenText, badge: "Provider paused" },
  { key: "dialogue", mediaType: "audio", name: "Multi-voice dialogue", description: "Build a conversation with distinct speakers.", icon: MessageSquareText, badge: "New" },
  { key: "sound-effects", mediaType: "audio", name: "Sound effects", description: "Describe an effect and generate the sound.", icon: Waves },
  { key: "music", mediaType: "audio", name: "Music", description: "Create an original song or instrumental.", icon: Music2 },
  { key: "audio-isolation", mediaType: "audio", name: "Audio isolation", description: "Remove noise and extract clean speech.", icon: AudioLines },
  { key: "song-recreation", mediaType: "audio", name: "Song recreation", description: "Rebuild a song concept in a fresh musical style.", icon: Music2 },
];

const showcaseExamples: ShowcaseExample[] = [
  {
    key: "wind-sculpt",
    title: "Wind sculpt",
    category: "Fashion",
    image: "/studio-showcase/wind-tunnel-couture.jpg",
    alt: "Three adult fashion models crossing a brutalist wind tunnel in flowing black and silver tailoring",
    prompt: "Three adult professional models walk through a powerful wind tunnel inside a monumental brutalist studio, tailored black and silver garments and translucent ribbons streaming through the air, low wide camera, confident forward motion, deep architectural perspective, hard white strobe cutting through soft haze, cool graphite shadows with restrained coral highlights, world-class contemporary fashion campaign, photorealistic, adults only, fully clothed, original wardrobe, no brands, no text, no logos.",
    style: "Editorial",
    toolKey: "cinematic-image",
    model: "FLUX.2 Flex",
    badge: "New",
    size: "wide",
  },
  {
    key: "reality-door",
    title: "Reality door",
    category: "VFX",
    image: "/studio-showcase/portal-platform.jpg",
    alt: "A commuter stepping through a subway doorway directly into a tropical ocean",
    prompt: "A seamless reality transition: an open subway door reveals a sunlit tropical ocean and one fully clothed adult commuter steps from the dark underground platform directly into shallow turquoise water. Wide symmetrical composition, the train fills one side, the glowing doorway is the focal point, moody fluorescent shadows meet brilliant tropical noon light, believable reflections, scale and perspective, cinematic photorealism, no brands, no readable text, no logos.",
    style: "Cinematic",
    toolKey: "create-image",
    model: "GPT Image 2",
    badge: "Trending",
    size: "wide",
  },
  {
    key: "chrome-impact",
    title: "Chrome impact",
    category: "Product",
    image: "/studio-showcase/chrome-splash.jpg",
    alt: "An unbranded chrome sneaker floating inside a ring of electric pink liquid",
    prompt: "An unbranded sculptural chrome sneaker floating above a glossy black pedestal while a controlled ring of liquid electric-pink paint explodes around it at the peak instant, hyperreal luxury sports campaign, close hero shot from a slightly low angle, strong diagonal energy, precise studio rim light, mirror chrome, ink black and electric pink palette, product fully visible and razor sharp, no text, no label, no logo.",
    style: "Photoreal",
    toolKey: "product-shot",
    model: "Nano Banana 2",
    badge: "New",
    size: "standard",
  },
  {
    key: "glass-bullet-time",
    title: "Glass bullet time",
    category: "Viral",
    image: "/studio-showcase/bullet-skate.jpg",
    alt: "An adult skateboarder frozen in midair among glass fragments above a rainy city intersection",
    prompt: "Animate this action scene in bullet time: the adult skateboarder remains frozen at the apex of the jump while glass fragments and glowing rain droplets hang motionless. The camera performs one smooth 180-degree orbit at a fixed radius and constant speed, keeping the subject centered and the wet city background moving with correct parallax. Prestige action-film lighting, no new objects, no cuts, no warping, no text or logos.",
    style: "Cinematic",
    toolKey: "camera-motion",
    model: "Seedance 1.5 Pro",
    badge: "Trending",
    size: "tall",
  },
  {
    key: "neon-diner",
    title: "Last stop before dawn",
    category: "Cinematic photography",
    image: "/studio-showcase/neon-diner.jpg",
    alt: "A vintage convertible outside a neon roadside diner on a rainy night",
    prompt: "A cinematic midnight roadside diner glowing coral and teal in a rainy desert, one vintage convertible parked outside, wet asphalt reflections, wide establishing shot from a low eye level, realistic textures, subtle 35mm film grain, neon nocturne, mysterious but inviting, no people, no text, no logos.",
    style: "Cinematic",
    toolKey: "cinematic-image",
    model: "FLUX.2 Flex",
    size: "standard",
  },
  {
    key: "cloud-skater",
    title: "Skating above the clouds",
    category: "Surreal editorial",
    image: "/studio-showcase/cloud-skater.jpg",
    alt: "A figure skater in flowing crimson fabric on a reflective lake above the clouds",
    prompt: "A graceful figure skating alone on a mirror-like frozen lake suspended above soft clouds, flowing crimson fabric tracing the motion, high-end surreal fashion editorial, wide dynamic composition, crisp blue dawn, elegant and ethereal, photorealistic subject, no text or logos.",
    style: "Editorial",
    toolKey: "create-image",
    model: "Nano Banana 2",
    size: "tall",
  },
  {
    key: "crimson-glass",
    title: "Crimson glass campaign",
    category: "Product studio",
    image: "/studio-showcase/crimson-glass.jpg",
    alt: "A transparent red perfume bottle among sculptural glass ribbons",
    prompt: "A transparent cherry-red perfume bottle on polished chrome surrounded by translucent red glass ribbons and fine mist, luxury beauty campaign photography, hyper-detailed glass and metal, dramatic close product hero, deep burgundy studio, sharp highlights, premium finish, unbranded bottle, no label, no text.",
    style: "Photoreal",
    toolKey: "create-image",
    model: "GPT Image 2",
    size: "standard",
  },
  {
    key: "tokyo-after-rain",
    title: "Tokyo after the rain",
    category: "Street cinema",
    image: "/studio-showcase/tokyo-after-rain.jpg",
    alt: "A woman in a cobalt raincoat walking through a wet Tokyo side street at night",
    prompt: "A lone woman in a cobalt raincoat walking through a narrow Tokyo side street after rain, warm lanterns and cool city lights reflecting on the pavement, cinematic street photography, rear three-quarter view, layered depth and leading lines, atmospheric night, contemplative mood, subtle 35mm film grain, avoid readable signs and logos.",
    style: "Cinematic",
    toolKey: "cinematic-image",
    model: "FLUX.2 Flex",
    size: "standard",
  },
  {
    key: "alpine-ensemble",
    title: "The alpine ensemble",
    category: "Character concept",
    image: "/studio-showcase/alpine-ensemble.jpg",
    alt: "Three sharply dressed anthropomorphic rabbits in an alpine meadow",
    prompt: "Three sharply dressed anthropomorphic rabbits posed like a stylish adventure-film ensemble in a windswept alpine meadow, premium cinematic character concept art, realistic fur and tailored fabric, heroic medium-wide group portrait, dramatic golden backlight, playful confidence, no weapons, no text, no logos.",
    style: "Cinematic",
    toolKey: "create-image",
    model: "GPT Image 2",
    size: "tall",
  },
  {
    key: "glass-atelier",
    title: "Future in soft focus",
    category: "Fashion portrait",
    image: "/studio-showcase/glass-atelier.jpg",
    alt: "A silver-haired fashion model wearing translucent eyewear in a glass atrium",
    prompt: "An editorial portrait of a silver-haired model wearing sculptural translucent eyewear and an iridescent jacket inside a minimalist glass atrium, contemporary fashion photography, polished magazine quality, medium close-up with architectural lines, soft magenta and icy blue daylight, refined and futuristic, no text or logos.",
    style: "Editorial",
    toolKey: "cinematic-image",
    model: "FLUX.2 Flex",
    size: "standard",
  },
  {
    key: "direct-flash-night",
    title: "After-hours flash",
    category: "Direct-flash editorial",
    image: "/studio-showcase/direct-flash-night.jpg",
    alt: "Three adult fashion models in metallic streetwear photographed with direct flash in a parking structure",
    prompt: "Three adult professional models in sophisticated layered streetwear inside an empty underground parking structure, energetic standing group pose, early-2000s digital-camera character, premium photorealistic editorial photography, slightly tilted handheld framing, hard on-camera flash, deep shadows, sodium-vapor background glow, silver, cobalt and black palette, subtle sensor noise, adults only, fully clothed, original wardrobe, no brands, no text, no logos.",
    style: "Editorial",
    toolKey: "create-image",
    model: "Nano Banana 2",
    badge: "Trending",
    size: "standard",
  },
  {
    key: "liquid-cobalt",
    title: "Liquid cobalt",
    category: "Product studio",
    image: "/studio-showcase/liquid-cobalt.jpg",
    alt: "An unbranded translucent blue skincare jar floating above liquid chrome",
    prompt: "An unbranded translucent cobalt-blue skincare jar suspended above a mirror of liquid chrome, surrounded by levitating water droplets and glass spheres, hyperreal luxury product campaign photography, dramatic close product hero centered slightly off-axis, razor-sharp studio rim light, soft blue caustics, cobalt, liquid silver and icy white palette, frosted glass and polished chrome, no label, no readable text, no logo.",
    style: "Photoreal",
    toolKey: "create-image",
    model: "GPT Image 2",
    size: "tall",
  },
  {
    key: "petal-freeze",
    title: "Time held still",
    category: "Cinematic photography",
    image: "/studio-showcase/petal-freeze.jpg",
    alt: "An adult performer crossing a brutalist plaza through frozen pink petals",
    prompt: "An adult contemporary performer in a tailored black suit crossing a brutalist plaza while hundreds of pale pink flower petals and rain droplets hang suspended in midair, high-end cinematic photography, wide dynamic side view, strong architectural leading lines, overcast silver daylight, surreal frozen-time tension, charcoal concrete, black and pale pink palette, fully clothed adult, no text, no logos.",
    style: "Cinematic",
    toolKey: "cinematic-image",
    model: "FLUX.2 Flex",
    badge: "Trending",
    size: "standard",
  },
  {
    key: "strawberry-atelier",
    title: "Strawberry atelier",
    category: "Surreal macro",
    image: "/studio-showcase/strawberry-atelier.jpg",
    alt: "Miniature gardeners tending enormous translucent strawberries inside a greenhouse",
    prompt: "A whimsical miniature world where tiny greenhouse gardeners tend giant translucent strawberries inside a glass conservatory at sunrise, cinematic macro photography with believable miniature craftsmanship, low viewpoint through foliage, layered depth, warm sunrise beams through misted glass, coral red, leaf green and honey-gold palette, tactile dew, soil, linen aprons and weathered tools, not cartoon, no brands, no text, no logos.",
    style: "Cinematic",
    toolKey: "create-image",
    model: "Nano Banana 2",
    badge: "New",
    size: "standard",
  },
  {
    key: "bound-giant",
    title: "The bound giant",
    category: "Fantasy cinema",
    image: "/frozen-mind-01.jpg",
    alt: "A lone traveler facing a colossal chained creature in a frozen landscape",
    prompt: "A lone traveler in a dark winter cloak facing a colossal ancient creature bound in iron chains across a frozen battlefield, epic dark-fantasy cinema, immense scale, snow haze, desaturated steel-blue palette, detailed creature skin and armor, dramatic wide composition, no text, no logos.",
    style: "Cinematic",
    toolKey: "cinematic-image",
    model: "FLUX.2 Flex",
    size: "wide",
  },
  {
    key: "winter-sentinel",
    title: "Winter sentinel",
    category: "Character concept",
    image: "/frozen-mind-02.jpg",
    alt: "A frost-covered armored sentinel in a wintry close-up",
    prompt: "Intense close portrait of a frost-covered medieval sentinel wearing intricately engraved dark steel armor, pale blue eyes, snow caught on skin and metal, cinematic shallow depth of field, cold natural light, prestige fantasy drama, realistic texture, no text, no logos.",
    style: "Cinematic",
    toolKey: "create-image",
    model: "GPT Image 2",
    size: "tall",
  },
  {
    key: "white-citadel",
    title: "The white citadel",
    category: "Fantasy cinema",
    image: "/frozen-mind-03.jpg",
    alt: "Two crimson-cloaked figures walking toward a monumental white citadel",
    prompt: "Two figures in deep crimson cloaks climbing monumental steps toward an impossibly tall white stone citadel, epic architectural fantasy, pale winter atmosphere, symmetrical wide composition, subtle snowfall, grand cinematic scale, intricate gothic detail, no readable text, no logos.",
    style: "Cinematic",
    toolKey: "cinematic-image",
    model: "FLUX.2 Flex",
    size: "standard",
  },
  {
    key: "orbit-reveal",
    title: "Orbit reveal",
    category: "Camera",
    image: "/studio-showcase/liquid-cobalt.jpg",
    alt: "A cobalt skincare jar suspended above reflective liquid chrome",
    prompt: "Animate the product with one continuous 360-degree orbit. The camera travels a complete circle at a fixed radius and fixed height, continuously panning to keep the cobalt jar dead center at constant size. Water droplets rotate slowly in the opposite direction, reflections remain physically accurate, one seamless take, premium studio lighting, no cuts, no zoom, no deformation, no text or logos.",
    style: "Photoreal",
    toolKey: "camera-motion",
    model: "Seedance 1.5 Pro",
    badge: "Trending",
    size: "standard",
  },
  {
    key: "impossible-pullback",
    title: "Impossible pullback",
    category: "Camera",
    image: "/frozen-mind-03.jpg",
    alt: "Two figures approaching a monumental white citadel",
    prompt: "Begin close behind the two crimson-cloaked figures and execute one accelerating aerial pullback, revealing the monumental citadel, then the frozen valley, then the entire mountain range. Maintain the figures at the visual center as scale expands naturally, smooth continuous motion, atmospheric depth, no cuts, no time jump, no added structures, no text or logos.",
    style: "Cinematic",
    toolKey: "camera-motion",
    model: "Kling 3.0",
    badge: "New",
    size: "wide",
  },
  {
    key: "paparazzi-burst",
    title: "Paparazzi burst",
    category: "Viral",
    image: "/studio-showcase/direct-flash-night.jpg",
    alt: "Fashion models photographed with hard direct flash in a parking structure",
    prompt: "Animate as a chaotic early-2000s paparazzi arrival. The models advance two steps while rapid off-camera flashes fire from alternating directions, slight handheld push-in, authentic digital shutter cadence, confident expressions, natural garment movement, hard flash shadows, no cuts, no extra people entering frame, no readable brands, no text or logos.",
    style: "Editorial",
    toolKey: "motion-presets",
    model: "Seedance 1.5 Pro",
    badge: "Trending",
    size: "standard",
  },
  {
    key: "miniature-awakening",
    title: "Miniature awakening",
    category: "Surreal",
    image: "/studio-showcase/strawberry-atelier.jpg",
    alt: "Miniature gardeners working among enormous translucent strawberries",
    prompt: "Animate this miniature greenhouse world at sunrise. Tiny gardeners coordinate around the giant translucent strawberries, dew rolls over leaf edges, warm light advances through the glass, and the camera makes a slow macro dolly through foreground foliage. Preserve miniature scale and tactile materials, gentle natural motion, no camera shake, no new characters, no text or logos.",
    style: "Cinematic",
    toolKey: "image-to-video",
    model: "Seedance 1.5 Pro",
    size: "tall",
  },
  {
    key: "rain-ramp",
    title: "Rain speed ramp",
    category: "Camera",
    image: "/studio-showcase/tokyo-after-rain.jpg",
    alt: "A woman in a cobalt raincoat walking through a wet city street",
    prompt: "Animate a cinematic rain speed-ramp. Start in real time behind the subject, accelerate through the neon street while the subject remains steady, then ease into slow motion as she turns slightly toward a warm doorway. Smooth stabilized tracking, wet reflections and rain physics remain coherent, no cuts, no face distortion, no readable signs or logos.",
    style: "Cinematic",
    toolKey: "camera-motion",
    model: "Kling 3.0",
    size: "standard",
  },
  {
    key: "metal-bloom",
    title: "Metal bloom",
    category: "VFX",
    image: "/studio-showcase/chrome-splash.jpg",
    alt: "A chrome sneaker surrounded by an electric pink liquid splash",
    prompt: "Transform the liquid ring into polished chrome as it rises around the sneaker, then fracture the metal surface into weightless reflective petals that orbit once and settle back into liquid. Keep the unbranded shoe unchanged, centered and sharp. Photoreal material transition, premium commercial pacing, one continuous shot, no text or logos.",
    style: "Photoreal",
    toolKey: "video-effects",
    model: "Kling 3.0",
    badge: "New",
    size: "standard",
  },
  {
    key: "fabric-freeze",
    title: "Fabric freeze",
    category: "Fashion",
    image: "/studio-showcase/wind-tunnel-couture.jpg",
    alt: "Fashion models surrounded by suspended fabric in a concrete studio",
    prompt: "Animate the models walking through the wind tunnel, then freeze all bodies and fabric mid-motion while the camera continues a smooth lateral arc through the suspended ribbons. Restart motion with a precise speed ramp at the end. Editorial pacing, physically coherent cloth, stable faces and wardrobe, no cuts, no text or logos.",
    style: "Editorial",
    toolKey: "camera-motion",
    model: "Seedance 1.5 Pro",
    badge: "Trending",
    size: "wide",
  },
  {
    key: "cloud-orbit",
    title: "Cloud orbit",
    category: "Surreal",
    image: "/studio-showcase/cloud-skater.jpg",
    alt: "A figure skater moving across a reflective lake above the clouds",
    prompt: "Animate one elegant orbit around the skater as the crimson fabric draws a perfect spiral across the reflective ice. Clouds move slowly below the suspended lake, the subject completes one controlled turn, dawn light remains consistent, graceful cinematic motion, no cuts, no duplicated limbs, no text or logos.",
    style: "Editorial",
    toolKey: "image-to-video",
    model: "Seedance 1.5 Pro",
    size: "tall",
  },
  {
    key: "giant-awakens",
    title: "The giant awakens",
    category: "VFX",
    image: "/frozen-mind-01.jpg",
    alt: "A traveler facing a colossal chained creature in a frozen landscape",
    prompt: "The colossal bound creature slowly opens its eyes and exhales a vast cloud of frost while chains tighten across the frozen battlefield. The traveler remains still in the foreground. Slow ground-level push-in, immense scale, subtle snow displacement, prestige fantasy realism, restrained motion, no violence, no cuts, no text or logos.",
    style: "Cinematic",
    toolKey: "image-to-video",
    model: "Kling 3.0",
    size: "wide",
  },
];



const activeStatuses = new Set(["created", "queued", "processing"]);

function retentionLabel(asset: StudioOutputAsset | undefined) {
  if (!asset) return null;
  if (asset.retained_at) return "Kept";
  if (asset.status === "deleted") return "Expired";
  if (!asset.expires_at) return null;
  const remaining = new Date(asset.expires_at).getTime() - Date.now();
  if (remaining <= 0) return "Expired";
  const days = Math.ceil(remaining / 86_400_000);
  return days === 1 ? "Expires today" : `Expires in ${days} days`;
}

function messageForError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.includes("reference_image_required")) return "Add a reference image for this model first.";
  if (raw.includes("reference")) return referenceMessage(raw);
  if (raw.includes("unsupported_parameter_combination")) return "That quality and duration combination is unavailable. Choose another duration.";
  if (raw.includes("invalid_prompt_length")) return "The prompt is outside this model’s supported length. Shorten it and try again.";
  if (raw.includes("insufficient_credits")) return "You need more credits for this action.";
  if (raw.includes("too_many_active_generations")) return "Three creations are already running. Let one finish first.";
  if (raw.includes("generation_rate_limited")) return "You are creating very quickly. Wait a moment and try again.";
  if (raw.includes("provider_submission_failed") || raw.includes("kie_submission_failed") || raw.includes("kie_chat_failed")) return "That AI model is temporarily unavailable. Your credits were returned.";
  if (raw.includes("stripe_not_configured") || raw.includes("STRIPE_SECRET_KEY")) return "Payments are being activated. Please try again shortly.";
  if (raw.includes("Failed to send") || raw.includes("FunctionsFetchError") || raw.includes("fetch failed")) return "Timeless Studio could not reach the service. Please try again.";
  return raw && raw !== "[object Object]" ? raw : "Something went wrong. Please try again.";
}

function readableParam(key: string) {
  const labels: Record<string, string> = { generate_audio_switch: "Audio", generate_multi_clip_switch: "Multi-shot", ratio: "Ratio", aspect_ratio: "Ratio", resolution: "Quality", quality: "Quality", duration: "Duration", mode: "Mode", output_format: "Format", similarity_boost: "Clarity", stability: "Stability", speed: "Speed", fixed_lens: "Fixed lens", nsfw_checker: "Safety", generate_audio: "Audio", audio: "Audio", sound: "Sound", multi_shots: "Multi-shot" };
  return labels[key] || key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayParamValue(key: string, value: string | number | boolean) {
  if (key === "duration") return `${value}s`;
  if (key === "mode" && value === "std") return "Standard";
  if (key === "mode" && value === "pro") return "Pro";
  if (["generate_audio", "audio", "sound", "multi_shots", "fixed_lens", "nsfw_checker"].includes(key)) return value ? "On" : "Off";
  return String(value);
}

function modelVariantLabel(model: StudioModel, parameters: Record<string, string | number | boolean>) {
  const details = ["duration", "resolution", "quality", "mode"]
    .filter((key) => parameters[key] !== undefined)
    .map((key) => displayParamValue(key, parameters[key]));
  return [model.name, ...details].join(" · ");
}

function defaultModelCredits(model: StudioModel) {
  return calculateStudioCredits(model.credit_cost, model.provider_config.defaultInput || {}, model.credit_rules);
}

function displayName(user: User | null) { return user ? String(user.user_metadata?.full_name || user.email || "Creator") : ""; }
function modeLabel(mode: MediaType) { return mode === "audio" ? "Sound" : mode.charAt(0).toUpperCase() + mode.slice(1); }

export function StudioWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [models, setModels] = useState<StudioModel[]>(fallbackModels);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [generations, setGenerations] = useState<StudioGeneration[]>([]);
  const [outputUrls, setOutputUrls] = useState<Record<string, string>>({});
  const [outputAssets, setOutputAssets] = useState<Record<string, StudioOutputAsset>>({});
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>(fallbackPacks);
  const [balance, setBalance] = useState(0);
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [menuType, setMenuType] = useState<MediaType | null>(null);
  const [activeToolKey, setActiveToolKey] = useState<string | null>(null);
  const [modelKey, setModelKey] = useState(fallbackModels[0].key);
  const [parameters, setParameters] = useState<Record<string, string | number | boolean>>(fallbackModels[0].provider_config.defaultInput || {});
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [promptEnhance, setPromptEnhance] = useState(true);
  const [creativeStyle, setCreativeStyle] = useState("Cinematic");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [references, setReferences] = useState<UploadedReference[]>([]);
  const [shots,setShots] = useState<{prompt:string;duration:number}[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retainingAssetId, setRetainingAssetId] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const checkoutStarted = useRef(false);
  const [pendingPack, setPendingPack] = useState<string | null>(null);
  const openPricing = () => window.location.assign("/pricing");
  const [profileOpen, setProfileOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkoutConfirmation, setCheckoutConfirmation] = useState<CheckoutConfirmation | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const handledCheckout = useRef<string | null>(null);

  const user = session?.user ?? null;
  const activeTool = tools.find((tool) => tool.key === activeToolKey) || null;
  const generationType: GenerativeMediaType = mediaType === "chat" ? "image" : mediaType;
  const filteredModels = useMemo(() => models.filter((model) => model.media_type === generationType), [models, generationType]);
  const selectedModel = filteredModels.find((model) => model.key === modelKey) || filteredModels[0] || fallbackModels.find((model) => model.media_type === generationType) || fallbackModels[0];
  const selectedProject = projects.find((project) => project.id === projectId) || null;
  const projectGenerations = generations.filter((generation) => (!projectId || generation.project_id === projectId) && generation.media_type === generationType);
  const categoryTools = tools.filter((tool) => tool.mediaType === generationType);
  const visibleThreads = threads.filter((thread) => thread.title.toLowerCase().includes(chatSearch.toLowerCase()));
  const quotedCredits = calculateStudioCredits(selectedModel.credit_cost, {...parameters,...(shots.length?{duration:String(shots.reduce((n,s)=>n+s.duration,0))}:{}),...referencePricing(references)}, selectedModel.credit_rules);
  const displayParameters = { ...parameters };
  if (selectedModel.provider_config.frameAspectRatio && references.some(r => r.slot === "first")) displayParameters.aspect_ratio = selectedModel.provider_config.frameAspectRatio;
  if (shots.length) displayParameters.duration = String(shots.reduce((sum, shot) => sum + shot.duration, 0));
  else if (selectedModel.provider_config.autoDurationWithVideo && references.some(r => r.mimeType.startsWith("video/"))) delete displayParameters.duration;
  const visibleModelChoices = filteredModels.filter((model) => `${model.name} ${model.description}`.toLowerCase().includes(modelSearch.trim().toLowerCase()));

  const invoke = useCallback(async <T,>(name: string, body: Record<string, unknown>) => {
    const { data, error } = await studioSupabase.functions.invoke(name, { body });
    if (error) {
      let details = error.message;
      const context = (error as { context?: unknown }).context;
      if (context && typeof context === "object") {
        const clone = (context as { clone?: unknown }).clone;
        if (typeof clone === "function") {
          try {
            const copy = clone.call(context) as { json?: unknown };
            if (typeof copy?.json === "function") {
              const payload = await copy.json().catch(() => null) as { error?: string } | null;
              if (payload?.error) details = payload.error;
            }
          } catch {
            // A network-level function error may expose a non-Response context.
          }
        }
      }
      throw new Error(details);
    }
    return data as T;
  }, []);

  const loadOutputs = useCallback(async (rows: StudioGeneration[]) => {
    const succeeded = rows.filter((row) => row.status === "succeeded").map((row) => row.id);
    if (!succeeded.length) { setOutputAssets({}); return setOutputUrls({}); }
    const { data: assets, error } = await studioSupabase.from("studio_assets").select("id,generation_id,status,expires_at,retained_at").eq("role", "output").in("generation_id", succeeded);
    if (error) throw error;
    const outputRows = (assets || []) as StudioOutputAsset[];
    setOutputAssets(Object.fromEntries(outputRows.map((asset) => [asset.generation_id, asset])));
    const available = outputRows.filter((asset) => asset.status === "ready" && (asset.retained_at || !asset.expires_at || new Date(asset.expires_at).getTime() > Date.now()));
    const signed = await Promise.all(available.map(async (asset) => {
      try { const result = await invoke<{ url: string }>("studio-asset-url", { assetId: asset.id, expiresIn: 3600 }); return [asset.generation_id as string, result.url] as const; }
      catch { return null; }
    }));
    setOutputUrls(Object.fromEntries(signed.filter(Boolean) as Array<readonly [string, string]>));
  }, [invoke]);

  const loadGenerations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await studioSupabase.from("studio_generations").select("id,project_id,model_key,media_type,status,prompt,progress,credits_charged,error_message,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(80);
    if (error) throw error;
    const rows = (data || []) as StudioGeneration[]; setGenerations(rows); await loadOutputs(rows);
  }, [loadOutputs, user]);

  const loadThreads = useCallback(async (nextProjectId?: string) => {
    if (!user) return;
    const targetProject = nextProjectId || projectId;
    let query = studioSupabase.from("studio_chat_threads").select("id,title,project_id,model_key,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50);
    if (targetProject) query = query.eq("project_id", targetProject);
    const { data, error } = await query; if (error) throw error; setThreads((data || []) as ChatThread[]);
  }, [projectId, user]);

  const loadMessages = useCallback(async (nextThreadId: string | null) => {
    setThreadId(nextThreadId); if (!nextThreadId) return setMessages([]);
    const { data, error } = await studioSupabase.from("studio_chat_messages").select("id,role,content,credits_charged,provider_tokens,created_at").eq("thread_id", nextThreadId).order("created_at", { ascending: true });
    if (error) throw error; setMessages((data || []) as ChatMessage[]);
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!user) return; setWorkspaceLoading(true);
    try {
      const [modelsResult, projectsResult, walletResult, packsResult] = await Promise.all([
        studioSupabase.from("studio_models").select("*").eq("is_active", true).order("sort_order"),
        studioSupabase.from("studio_projects").select("id,name").eq("user_id", user.id).order("created_at"),
        studioSupabase.from("studio_credit_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
        studioSupabase.from("studio_credit_packs").select("*").eq("is_active", true).order("sort_order"),
      ]);
      if (modelsResult.error) throw modelsResult.error; if (projectsResult.error) throw projectsResult.error; if (walletResult.error) throw walletResult.error; if (packsResult.error) throw packsResult.error;
      const liveModels = (modelsResult.data || []) as StudioModel[]; const livePacks = (packsResult.data || []) as CreditPack[];
      if (liveModels.length) setModels(liveModels); if (livePacks.length) setCreditPacks(livePacks); setBalance(Number(walletResult.data?.balance || 0));
      let liveProjects = (projectsResult.data || []) as StudioProject[];
      if (!liveProjects.length) {
        const { data, error } = await studioSupabase.from("studio_projects").insert({ user_id: user.id, name: "My first project" }).select("id,name").single();
        if (error) throw error; liveProjects = [data as StudioProject];
      }
      setProjects(liveProjects); const nextProjectId = liveProjects.some((project) => project.id === projectId) ? projectId : liveProjects[0].id; setProjectId(nextProjectId);
      await Promise.all([loadGenerations(), loadThreads(nextProjectId)]);
    } catch (error) { setNotice(messageForError(error)); } finally { setWorkspaceLoading(false); }
  }, [loadGenerations, loadThreads, projectId, user]);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const { error: callbackError } = await studioSupabase.auth.initialize();
        if (callbackError && active) {
          setNotice(socialAuthErrorMessage(callbackError));
          setAuthOpen(true);
          window.history.replaceState(window.history.state, "", clearAuthErrorUrl(window.location.href));
        }
        const { data, error } = await studioSupabase.auth.getSession();
        if (error) throw error;
        if (active) setSession(data.session);
      } catch (error) {
        if (active) setNotice(socialAuthErrorMessage(error));
      } finally {
        if (active) setAuthReady(true);
      }
    }
    void restoreSession();
    const { data } = studioSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession); setAuthReady(true); if (nextSession) setAuthOpen(false);
      else { setProjects([]); setProjectId(""); setGenerations([]); setOutputUrls({}); setOutputAssets({}); setThreads([]); setMessages([]); setBalance(0); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (!user) return; const timer = window.setTimeout(() => loadWorkspace(), 0); return () => window.clearTimeout(timer); }, [loadWorkspace, user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const checkoutResult = params.get("checkout");
    const sessionId = params.get("session_id");
    const purchaseEventId = params.get("meta_purchase_event_id") || undefined;

    const clearCheckoutParams = () => {
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("checkout");
      cleaned.searchParams.delete("session_id");
      cleaned.searchParams.delete("meta_purchase_event_id");
      window.history.replaceState({}, "", `${cleaned.pathname}${cleaned.search}${cleaned.hash}`);
    };

    if (checkoutResult === "cancel" || checkoutResult === "canceled") {
      const timer = window.setTimeout(() => setNotice("Checkout canceled. You were not charged."), 0);
      clearCheckoutParams();
      return () => window.clearTimeout(timer);
    }
    if (checkoutResult !== "success" || !sessionId || handledCheckout.current === sessionId) return;

    handledCheckout.current = sessionId;
    let active = true;
    let completed = false;
    const verifyCheckout = async () => {
      setNotice("Payment received. Confirming your credits…");
      for (let attempt = 0; attempt < 8 && active; attempt += 1) {
        const { data: checkout, error } = await studioSupabase
          .from("studio_stripe_checkouts")
          .select("credits,status,pack_key,amount_total,currency")
          .eq("stripe_session_id", sessionId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          completed = true;
          setNotice(messageForError(error));
          clearCheckoutParams();
          return;
        }
        if (checkout?.status === "paid") {
          const { data: wallet, error: walletError } = await studioSupabase
            .from("studio_credit_wallets")
            .select("balance")
            .eq("user_id", user.id)
            .maybeSingle();
          if (walletError) {
            completed = true;
            setNotice(messageForError(walletError));
            clearCheckoutParams();
            return;
          }
          const nextBalance = Number(wallet?.balance || 0);
          if (!active) return;
          setBalance(nextBalance);
          setNotice(null);
          setCheckoutConfirmation({ creditsAdded: Number(checkout.credits || 0), balance: nextBalance });
          const purchaseMarker = `timeless-meta-purchase:${purchaseEventId || sessionId}`;
          let shouldTrackPurchase = true;
          try {
            shouldTrackPurchase = window.localStorage.getItem(purchaseMarker) !== "sent";
          } catch {
            // Storage can be unavailable in hardened browser modes; checkout
            // URL cleanup and the in-memory guard still prevent normal repeats.
          }
          if (shouldTrackPurchase) {
            trackMetaEvent("Purchase", {
              content_ids: [String(checkout.pack_key || "studio-credits")],
              content_name: "Timeless Studio credits",
              content_type: "product",
              credits: Number(checkout.credits || 0),
              currency: String(checkout.currency || "usd").toUpperCase(),
              value: Number(checkout.amount_total || 0) / 100,
            }, purchaseEventId);
            try {
              window.localStorage.setItem(purchaseMarker, "sent");
            } catch {
              // The event is still queued even when persistent storage is blocked.
            }
          }
          completed = true;
          clearCheckoutParams();
          return;
        }
        if (["failed", "expired"].includes(String(checkout?.status || ""))) {
          completed = true;
          setNotice("Stripe could not complete this checkout. Your credits were not changed.");
          clearCheckoutParams();
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (active) {
        completed = true;
        setNotice("Your payment is still being confirmed. Your balance will update automatically.");
        clearCheckoutParams();
      }
    };
    void verifyCheckout();
    return () => {
      active = false;
      if (!completed && handledCheckout.current === sessionId) handledCheckout.current = null;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = studioSupabase.channel(`studio-web-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_generations", filter: `user_id=eq.${user.id}` }, () => loadGenerations())
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_credit_wallets", filter: `user_id=eq.${user.id}` }, (payload) => { const next = payload.new as { balance?: number }; if (typeof next.balance === "number") setBalance(next.balance); }).subscribe();
    const timer = window.setInterval(() => { if (generations.some((generation) => activeStatuses.has(generation.status))) loadGenerations(); }, 8000);
    return () => { window.clearInterval(timer); studioSupabase.removeChannel(channel); };
  }, [generations, loadGenerations, user]);

  function selectModel(key: string) {
    const model = models.find((item) => item.key === key); if (!model) return;
    setModelKey(key); setParameters(model.provider_config.defaultInput || {}); setReferences([]); setShots([]); setModelPickerOpen(false); setModelSearch("");
  }

  function resetStudioScroll() {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }

  function changeMediaType(nextType: MediaType) {
    setMediaType(nextType); setActiveToolKey(null); setAdvancedOpen(false); setModelPickerOpen(false); setReferences([]); setShots([]);
    setCreativeStyle(nextType === "audio" ? "Natural" : "Cinematic");
    if (nextType !== "chat") {
      const nextModel = models.find((model) => model.media_type === nextType) || fallbackModels.find((model) => model.media_type === nextType);
      if (nextModel) { setModelKey(nextModel.key); setParameters(nextModel.provider_config.defaultInput || {}); }
    }
    resetStudioScroll();
  }

  function openTool(tool: StudioTool) {
    setMenuType(null);
    if (!tool.available) {
      return setNotice(
        tool.badge === "Provider paused"
          ? `${tool.name} is temporarily paused while Kie restores audio capacity.`
          : `${tool.name} is next in the Timeless rollout.`,
      );
    }
    setActiveToolKey(tool.key); setMediaType(tool.mediaType); setAdvancedOpen(false); setModelPickerOpen(false); setReferences([]); setShots([]);
    const model = models.find((item) => item.key === tool.modelKey) || models.find((item) => item.media_type === tool.mediaType) || fallbackModels.find((item) => item.media_type === tool.mediaType);
    if (model) { setModelKey(model.key); setParameters(model.provider_config.defaultInput || {}); }
    resetStudioScroll();
  }

  async function recreateExample(example: ShowcaseExample) {
    const tool = tools.find((item) => item.key === example.toolKey) || tools.find((item) => item.key === "create-image");
    if (!tool) return;
    openTool(tool);
    setPrompt(example.prompt);
    setCreativeStyle(example.style);
    try {
      await navigator.clipboard.writeText(example.prompt);
      setNotice("Prompt copied and ready to recreate.");
    } catch {
      setNotice("Prompt loaded and ready to recreate.");
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Creation prompt"]')?.focus());
    });
  }

  function toggleModeMenu(nextType: MediaType) {
    const shouldClose = menuType === nextType;
    changeMediaType(nextType);
    setMenuType(shouldClose ? null : nextType);
  }

  function chooseCatalogModel(nextType: MediaType, catalogModel: CatalogModel) {
    if (nextType === "chat" && catalogModel.modelKey === "gpt-5-2") {
      setMediaType("chat"); setActiveToolKey(null); setMenuType(null); resetStudioScroll(); return;
    }
    const model = models.find((item) => item.key === catalogModel.modelKey) || fallbackModels.find((item) => item.key === catalogModel.modelKey);
    if (!model) { setMenuType(null); setNotice(`${catalogModel.name} is in the next Timeless model rollout.`); return; }
    setMediaType(nextType); setActiveToolKey(tools.find((tool) => tool.available && tool.mediaType === nextType && !tool.reference)?.key || null);
    setModelKey(model.key); setParameters(model.provider_config.defaultInput || {}); setReferences([]); setShots([]); setMenuType(null);
    resetStudioScroll();
  }

  async function uploadReference(file: File): Promise<string> {
    if (!user) { setAuthOpen(true); throw Error("Sign in to upload reference files."); }
    if (!projectId) throw Error("Create a project first.");
    const authorization = await invoke<{asset:{id:string};upload:{url:string;headers?:Record<string,string>}}>("studio-upload-url",{projectId,fileName:file.name,mimeType:file.type,sizeBytes:file.size});
    const response = await fetch(authorization.upload.url,{method:"PUT",headers:authorization.upload.headers||{"Content-Type":file.type},body:file});
    if(!response.ok)throw Error("Upload failed. Please try again.");
    return authorization.asset.id;
  }

  async function generate() {
    if (!user) return setAuthOpen(true); if (!prompt.trim() && !shots.length && !selectedModel.provider_config.omitPrompt) return setNotice(mediaType === "audio" ? "Add the script you want spoken." : "Describe what you want to create first.");
    if (!projectId) return setNotice("Create a project first."); if ((activeTool?.reference || selectedModel.provider_config.minInputs) && !references.length) return setNotice("Add a reference file for this tool first.");
    const refError = referenceError(selectedModel.provider_config,references,true,parameters); if (selectedModel.provider_config.referenceSlots && refError) return setNotice(referenceMessage(refError)); if (balance < quotedCredits) return openPricing();
    if(shots.length && shotSequenceError(Boolean(selectedModel.provider_config.supportsShots),shots,references.length)) return setNotice("Use 2–5 shots, 1–12 seconds each, totaling 3–15 seconds. Multi-shot supports one first-frame image.");
    setBusy(true); setNotice(null);
    try {
      const userPrompt = prompt.trim() || (shots.length ? shots.map(s=>s.prompt).join(" ") : "Lip sync video to voice recording");
      const toolPrompt = promptEnhance && activeTool?.promptPrefix ? `${activeTool.promptPrefix}${userPrompt}` : userPrompt;
      const stylePrompt = creativeStyle === "None" || creativeStyle === "Natural" ? toolPrompt : `${creativeStyle} style. ${toolPrompt}`;
      const composedPrompt = mediaType === "audio" && creativeStyle !== "Natural" ? `Voice delivery: ${creativeStyle}. ${toolPrompt}` : stylePrompt;
      await invoke("studio-create-generation", { projectId, modelKey: selectedModel.key, prompt: composedPrompt, negativePrompt: selectedModel.provider_config.allowNegativePrompt === false ? undefined : negativePrompt.trim() || undefined, parameters, shots:shots.length?shots:undefined, inputAssetIds: references.map(r=>r.id), references: selectedModel.provider_config.referenceSlots ? references.map(({id,slot,start,end})=>({id,slot,start,end})) : undefined, idempotencyKey: crypto.randomUUID() });
      setPrompt(""); setReferences([]); setShots([]); await loadGenerations();
    } catch (error) { const message = messageForError(error); if (message.includes("more credits")) openPricing(); else setNotice(message); } finally { setBusy(false); }
  }

  async function sendChat() {
    if (!user) return setAuthOpen(true); if (!chatPrompt.trim()) return; if (!projectId) return setNotice("Create a project first."); if (balance < 1) return openPricing();
    const outgoing = chatPrompt.trim(); setChatPrompt(""); setBusy(true); setNotice(null);
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: "user", content: outgoing, credits_charged: 0, provider_tokens: null, created_at: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]);
    try { const result = await invoke<{ threadId: string }>("studio-chat", { projectId, threadId, message: outgoing }); await Promise.all([loadThreads(projectId), loadMessages(result.threadId)]);
      const { data: wallet } = await studioSupabase.from("studio_credit_wallets").select("balance").eq("user_id", user.id).maybeSingle();
      if (wallet) setBalance(Number(wallet.balance));
    }
    catch (error) { setMessages((current) => current.filter((message) => message.id !== optimistic.id)); const message = messageForError(error); if (message.includes("more credits")) openPricing(); else setNotice(message); }
    finally { setBusy(false); }
  }

  async function refreshGeneration(generationId: string) { try { await invoke("studio-refresh-generation", { generationId }); await loadGenerations(); } catch (error) { setNotice(messageForError(error)); } }
  async function createProject(name: string) {
    if (!user) return setAuthOpen(true); const cleaned = name.trim(); if (!cleaned) return;
    try { const { data, error } = await studioSupabase.from("studio_projects").insert({ user_id: user.id, name: cleaned }).select("id,name").single(); if (error) throw error; const project = data as StudioProject; setProjects((current) => [...current, project]); setProjectId(project.id); setNewProjectOpen(false); }
    catch (error) { setNotice(messageForError(error)); }
  }
  async function startCheckout(packKey: string) {
    if (!user) return setAuthOpen(true);
    const initiateCheckoutEventId = crypto.randomUUID();
    const purchaseEventId = crypto.randomUUID();
    const pack = creditPacks.find((item) => item.key === packKey);
    if (pack) {
      trackMetaEvent("InitiateCheckout", {
        content_ids: [pack.key],
        content_name: `${pack.name} Studio credits`,
        content_type: "product",
        credits: pack.credits,
        currency: pack.currency.toUpperCase(),
        num_items: 1,
        value: pack.price_cents / 100,
      }, initiateCheckoutEventId);
    }
    setBusy(true);
    setNotice("Opening secure checkout…");
    try {
      const result = await invoke<{ url: string }>("studio-stripe-checkout", {
        packKey,
        metaInitiateCheckoutEventId: initiateCheckoutEventId,
        metaPurchaseEventId: purchaseEventId,
        metaBrowserIdentifiers: getMetaBrowserIdentifiers(),
      });
      window.location.assign(result.url);
    } catch (error) {
      setNotice(messageForError(error));

    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("buy");
    let saved: string | null = null;
    try { saved = sessionStorage.getItem("timeless.pendingPack"); } catch {}
    const selected = requested || saved;
    if (!selected || !fallbackPacks.some((pack) => pack.key === selected)) return;
    const timer = window.setTimeout(() => setPendingPack(selected), 0);
    try { sessionStorage.setItem("timeless.pendingPack", selected); } catch {}
    url.searchParams.delete("buy");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authReady || !pendingPack || checkoutStarted.current) return;
    const timer = window.setTimeout(() => {
      if (!user) { setAuthOpen(true); return; }
      if (checkoutStarted.current) return;
      checkoutStarted.current = true;
      try { sessionStorage.removeItem("timeless.pendingPack"); } catch {}
      setPendingPack(null);
      void startCheckout(pendingPack);
    }, 0);
    return () => window.clearTimeout(timer);
    // The ref prevents duplicate checkout creation across auth updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPack, user?.id, authReady]);

  async function retainOutput(asset: StudioOutputAsset) {
    if (asset.retained_at || retainingAssetId) return;
    setRetainingAssetId(asset.id);
    try {
      const result = await invoke<{ retainedAt: string }>("studio-retain-asset", { assetId: asset.id });
      setOutputAssets((current) => ({ ...current, [asset.generation_id]: { ...asset, retained_at: result.retainedAt, expires_at: null } }));
      setNotice("Saved to your project. This file will not expire.");
    } catch (error) { setNotice(messageForError(error)); }
    finally { setRetainingAssetId(null); }
  }
  async function signOut() { await studioSupabase.auth.signOut(); setProfileOpen(false); }

  const parameterEntries = Object.entries(selectedModel.parameter_schema?.properties || {}).map(([key, rule]) => [key, { ...rule, enum: rule.enum ? validParameterOptions(key, rule.enum, parameters, selectedModel.parameter_schema.forbiddenCombinations) : undefined }] as const).filter(([key]) => !(key === "aspect_ratio" && selectedModel.provider_config.frameAspectRatio && references.some(r=>r.slot === "first")) && !(key === "duration" && (shots.length > 0 || selectedModel.provider_config.autoDurationWithVideo && references.some(r=>r.mimeType.startsWith("video/")))) && !["multi_shots", "timestamps", "style", "language_code", "previous_text", "next_text", "align_audio"].includes(key));
  const styleOptions = mediaType === "audio" ? ["Natural", "Warm", "Editorial", "Dramatic"] : ["Cinematic", "Editorial", "Minimal", "Photoreal", "Anime", "None"];

  return (
    <main className={`studio-app studio-mode-${mediaType}`}>
      <header className="studio-topbar">
        <Link className="studio-wordmark" href="/" aria-label="Timeless home"><img className="studio-mark" src="/timeless-icon.png" alt="" /><span>TIMELESS</span><small>STUDIO</small></Link>
        <nav className="studio-mode-nav" aria-label="Creation modes">
          <button aria-expanded={menuType === "image"} className={mediaType === "image" ? "is-active" : ""} onClick={() => toggleModeMenu("image")} type="button"><ImageIcon size={16} /> Image <ChevronDown className={menuType === "image" ? "is-open" : ""} size={12} /></button>
          <button aria-expanded={menuType === "video"} className={mediaType === "video" ? "is-active" : ""} onClick={() => toggleModeMenu("video")} type="button"><Clapperboard size={16} /> Video <ChevronDown className={menuType === "video" ? "is-open" : ""} size={12} /></button>
          <button aria-expanded={menuType === "audio"} className={mediaType === "audio" ? "is-active" : ""} onClick={() => toggleModeMenu("audio")} type="button"><AudioLines size={16} /> Sound <ChevronDown className={menuType === "audio" ? "is-open" : ""} size={12} /></button>
          <button aria-expanded={menuType === "chat"} className={mediaType === "chat" ? "is-active" : ""} onClick={() => toggleModeMenu("chat")} type="button"><MessageSquareText size={16} /> Chat <ChevronDown className={menuType === "chat" ? "is-open" : ""} size={12} /></button>
        </nav>
        <div className="studio-account-preview">
          <div className="studio-project-switcher-wrap">
            <button className="studio-project-switcher" type="button" onClick={() => user ? setProjectMenuOpen((open) => !open) : setAuthOpen(true)}><FolderKanban size={15} /><span>{selectedProject?.name || (user ? "Projects" : "My studio")}</span><ChevronDown size={13} /></button>
            {projectMenuOpen && <div className="studio-project-menu"><p>Projects</p>{projects.map((project) => <button className={project.id === projectId ? "is-active" : ""} key={project.id} type="button" onClick={() => { setProjectId(project.id); setProjectMenuOpen(false); loadThreads(project.id); loadMessages(null); }}><FolderKanban size={14} /><span>{project.name}</span>{project.id === projectId && <Check size={13} />}</button>)}<button className="studio-new-project-link" type="button" onClick={() => { setProjectMenuOpen(false); setNewProjectOpen(true); }}><Plus size={14} /> New project</button></div>}
          </div>
          <button className="studio-credits" onClick={() => openPricing()} type="button"><Coins size={15} /> {balance.toLocaleString()}</button>
          {!authReady ? <span className="studio-auth-loader"><LoaderCircle size={16} /></span> : user ? <div className="studio-profile-wrap"><button className="studio-avatar" onClick={() => setProfileOpen((open) => !open)} type="button">{displayName(user).slice(0, 2).toUpperCase()} <ChevronDown size={13} /></button>{profileOpen && <div className="studio-profile-menu"><strong>{displayName(user)}</strong><span>{user.email}</span><button type="button" onClick={signOut}><LogOut size={14} /> Sign out</button></div>}</div> : <button className="studio-signin" onClick={() => setAuthOpen(true)} type="button">Sign in</button>}
        </div>
      </header>

      {menuType && <>
        <button className="studio-mega-scrim" type="button" aria-label="Close creation menu" onClick={() => setMenuType(null)} />
        <StudioMegaMenu activeType={menuType} models={modelCatalog[menuType]} onClose={() => setMenuType(null)} onModel={(model) => chooseCatalogModel(menuType, model)} onTool={openTool} />
      </>}

      {mediaType === "chat" ? <ChatWorkspace busy={busy} chatPrompt={chatPrompt} chatSearch={chatSearch} messages={messages} onNew={() => loadMessages(null)} onPrompt={setChatPrompt} onSearch={setChatSearch} onSelectThread={loadMessages} onSend={sendChat} selectedThreadId={threadId} threads={visibleThreads} user={user} />
      : !activeTool ? <ToolLibrary mediaType={generationType} tools={categoryTools} onMode={changeMediaType} onOpen={openTool} onRecreate={recreateExample} />
      : <section className="studio-stage">
          <div className="studio-workspace-toolbar"><button type="button" onClick={() => setActiveToolKey(null)}><ArrowLeft size={15} /> All {modeLabel(mediaType)} tools</button><span><activeTool.icon size={14} /> {activeTool.name}</span><button type="button" onClick={() => document.getElementById("studio-generations")?.scrollIntoView({ behavior: "smooth" })}><Clock3 size={15} /> History</button></div>
          {workspaceLoading && !projectGenerations.length ? <div className="studio-loading-state"><LoaderCircle size={24} /> Loading your studio…</div>
          : projectGenerations.length ? <div className="studio-generations" id="studio-generations">{projectGenerations.map((generation) => {
              const model = models.find((item) => item.key === generation.model_key); const outputUrl = outputUrls[generation.id]; const outputAsset = outputAssets[generation.id]; const retention = retentionLabel(outputAsset); const expired = retention === "Expired"; const isActive = activeStatuses.has(generation.status);
              return <article className={`studio-generation studio-generation-${generation.media_type}`} key={generation.id}><div className="studio-generation-media">{outputUrl && generation.media_type === "image" ? <img src={outputUrl} alt={generation.prompt} /> : outputUrl && generation.media_type === "video" ? <video src={outputUrl} controls preload="metadata" /> : outputUrl && generation.media_type === "audio" ? <div className="studio-audio-result"><AudioLines size={34} /><audio src={outputUrl} controls preload="metadata" /></div> : <div className={`studio-generation-placeholder is-${expired ? "expired" : generation.status}`}>{isActive ? <LoaderCircle size={24} /> : generation.status === "failed" || expired ? <X size={24} /> : <Sparkles size={24} />}<span>{isActive ? `${generation.progress || 1}% creating` : expired ? "File expired" : generation.status}</span></div>}<span className={`studio-status studio-status-${expired ? "expired" : generation.status}`}>{expired ? "expired" : generation.status}</span></div><div className="studio-generation-info"><p>{generation.prompt}</p><div><span>{model?.name || generation.model_key}</span><span>{generation.credits_charged} credits</span><span>{new Date(generation.created_at).toLocaleDateString()}</span>{retention && <span className={`studio-retention-state ${outputAsset?.retained_at ? "is-kept" : expired ? "is-expired" : ""}`}><Clock3 size={12} /> {retention}</span>}{isActive && <button onClick={() => refreshGeneration(generation.id)} type="button"><RefreshCw size={12} /> Refresh</button>}{outputUrl && <a href={outputUrl} download target="_blank" rel="noreferrer"><Download size={12} /> Export</a>}{outputUrl && outputAsset && !outputAsset.retained_at && <button disabled={retainingAssetId === outputAsset.id} onClick={() => retainOutput(outputAsset)} type="button">{retainingAssetId === outputAsset.id ? <LoaderCircle size={12} /> : <Bookmark size={12} />} Keep</button>}</div></div></article>;
            })}</div>
          : <div className="studio-empty-state"><div className="studio-focus-frame" aria-hidden="true"><i /><i /><i /><i /></div><p>{modeLabel(mediaType).toUpperCase()}</p><h2>{activeTool.name}</h2><span>{activeTool.description}</span><button className="studio-model-pill" type="button">{selectedModel.name} <Sparkles size={12} /></button></div>}

          <section className="studio-composer" aria-label="AI creation controls">
            {advancedOpen && <div className="studio-advanced-panel">{selectedModel.provider_config.allowNegativePrompt !== false && <label>Negative prompt<input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder="What should the model avoid?" /></label>}<p>Outputs are private to your Timeless account and project.</p></div>}
            {selectedModel.provider_config.supportsShots && <section className="studio-shot-list" aria-label="Shot sequence"><label><input type="checkbox" checked={shots.length>0} onChange={e=>setShots(e.target.checked?[{prompt:"",duration:3},{prompt:"",duration:3}]:[])}/> Multi-shot sequence</label>{shots.length>0&&<><p>2–5 shots · 3–15 seconds total · One optional first-frame image</p>{shots.map((shot,i)=><div key={i}><label>Shot {i+1}<textarea aria-label={`Shot ${i+1} prompt`} maxLength={500} value={shot.prompt} onChange={e=>setShots(shots.map((s,j)=>j===i?{...s,prompt:e.target.value}:s))}/></label><label>Seconds<input aria-label={`Shot ${i+1} seconds`} type="number" min={1} max={12} value={shot.duration} onChange={e=>setShots(shots.map((s,j)=>j===i?{...s,duration:Number(e.target.value)}:s))}/></label><button type="button" disabled={shots.length<=2} aria-label={`Remove shot ${i+1}`} onClick={()=>setShots(shots.filter((_,j)=>j!==i))}><X size={14}/></button></div>)}<button type="button" disabled={shots.length>=5} onClick={()=>setShots([...shots,{prompt:"",duration:3}])}>Add shot</button><strong> {shots.reduce((n,s)=>n+s.duration,0)} seconds total</strong></>}</section>}
            <ReferencePanel key={selectedModel.key} config={selectedModel.provider_config.referenceSlots ? selectedModel.provider_config : {...selectedModel.provider_config,referenceSlots:selectedModel.provider_config.inputField ? [{key:"legacy",label:"Image",field:selectedModel.provider_config.inputField,mimeTypes:["image/jpeg","image/png","image/webp"],max:1,maxBytes:10*1024*1024}] : []}} value={references} onChange={setReferences} onUpload={uploadReference} onBusy={setUploading} onError={setNotice} disabled={busy}/>
            {!selectedModel.provider_config.omitPrompt && <textarea aria-label="Creation prompt" onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") generate(); }} placeholder={mediaType === "audio" ? "Paste the script you want spoken…" : `Describe the ${mediaType} you want to create…`} value={prompt} rows={3} />}
            <div className="studio-control-row">
              <button className="studio-mode-control" type="button" onClick={() => setActiveToolKey(null)}>{mediaType === "image" ? <ImageIcon size={15} /> : mediaType === "video" ? <Clapperboard size={15} /> : <AudioLines size={15} />}<span>Tool</span><strong>{activeTool.name}</strong></button>
              <button className="studio-model-control studio-model-trigger" type="button" aria-haspopup="listbox" aria-expanded={modelPickerOpen} onClick={() => setModelPickerOpen((open) => !open)}><WandSparkles size={15} /><span><small>Model</small><strong>{modelVariantLabel(selectedModel, displayParameters)}</strong></span><ChevronDown className={modelPickerOpen ? "is-open" : ""} size={14} /></button>
              {!selectedModel.provider_config.omitPrompt && <label className="studio-select-control studio-style-control"><Palette size={15} /><span>Style</span><select value={creativeStyle} onChange={(event) => setCreativeStyle(event.target.value)} aria-label="Creative style">{styleOptions.map((style) => <option key={style} value={style}>{style}</option>)}</select><ChevronDown size={13} /></label>}
              {parameterEntries.map(([key, schema]) => schema.enum?.length ? <label className="studio-select-control" key={key} title={readableParam(key)}><span>{readableParam(key)}</span><select value={String(parameters[key] ?? schema.enum[0])} onChange={(event) => { const sample = schema.enum?.[0]; const value = typeof sample === "number" ? Number(event.target.value) : typeof sample === "boolean" ? event.target.value === "true" : event.target.value; setParameters((current) => updateModelParameter(key, value, current, selectedModel.parameter_schema)); }} aria-label={readableParam(key)}>{schema.enum.map((value) => <option key={String(value)} value={String(value)}>{displayParamValue(key, value)}</option>)}</select><ChevronDown size={13} /></label> : schema.type === "boolean" ? <button className={`studio-boolean-control ${parameters[key] ? "is-on" : ""}`} key={key} type="button" aria-pressed={Boolean(parameters[key])} onClick={() => setParameters((current) => ({ ...current, [key]: !current[key] }))}>{readableParam(key)} <span>{parameters[key] ? "On" : "Off"}</span></button> : null)}
              <button className="studio-settings-button" type="button" aria-label="More settings" onClick={() => setAdvancedOpen((open) => !open)}><Settings2 size={16} /></button>
              <button className="studio-generate" disabled={busy || uploading} onClick={generate} type="button">{busy ? <LoaderCircle size={15} /> : "Generate"}<span>{quotedCredits} cr</span></button>
            </div>
            {modelPickerOpen && <StudioModelPicker models={visibleModelChoices} onClose={() => setModelPickerOpen(false)} onSearch={setModelSearch} onSelect={selectModel} search={modelSearch} selectedKey={selectedModel.key} />}
            <div className="studio-model-note">{!selectedModel.provider_config.omitPrompt && <button className={promptEnhance ? "is-on" : ""} type="button" onClick={() => setPromptEnhance((value) => !value)}><Sparkles size={11} /> Prompt enhance <i /></button>}<span className="studio-live-quote">{modelVariantLabel(selectedModel, displayParameters)} · {quotedCredits} credits</span><span className="studio-retention-policy"><Clock3 size={11} /> Files expire after 7 days unless kept</span><kbd>⌘ Enter</kbd></div>
          </section>
        </section>}

      {notice && <div className="studio-toast" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15} /></button></div>}
      {checkoutConfirmation && <CreditSuccessDialog confirmation={checkoutConfirmation} onClose={() => setCheckoutConfirmation(null)} />}
      <StudioSupport key={user?.id ?? "guest"} userId={user?.id ?? null} onSignIn={() => setAuthOpen(true)} />
      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onCancel={() => { setAuthOpen(false); setPendingPack(null); try { sessionStorage.removeItem("timeless.pendingPack"); sessionStorage.removeItem("timeless.support.handoff"); } catch {} }} onNotice={setNotice} />}
      {newProjectOpen && <NewProjectDialog onClose={() => setNewProjectOpen(false)} onCreate={createProject} />}
    </main>
  );
}

function CreditSuccessDialog({ confirmation, onClose }: { confirmation: CheckoutConfirmation; onClose: () => void }) {
  return <div className="studio-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="studio-modal studio-credit-success" role="dialog" aria-modal="true" aria-labelledby="studio-credit-success-title"><button className="studio-modal-close" onClick={onClose} type="button" aria-label="Close"><X size={18} /></button><span className="studio-success-icon"><Check size={26} /></span><p className="studio-modal-kicker">PAYMENT CONFIRMED</p><h2 id="studio-credit-success-title">Credits added</h2><p className="studio-modal-copy">+{confirmation.creditsAdded.toLocaleString()} credits are ready to use in your studio.</p><div className="studio-success-balance"><span>New balance</span><strong>{confirmation.balance.toLocaleString()}</strong><small>credits</small></div><button className="studio-modal-primary" type="button" onClick={onClose}>Start creating</button></section></div>;
}

function StudioModelPicker({ models, onClose, onSearch, onSelect, search, selectedKey }: { models: StudioModel[]; onClose: () => void; onSearch: (value: string) => void; onSelect: (key: string) => void; search: string; selectedKey: string }) {
  return <section className="studio-model-picker" aria-label="Choose an AI model">
    <header><div><span>AI MODELS</span><strong>Choose the right engine</strong></div><button type="button" onClick={onClose} aria-label="Close model picker"><X size={15} /></button></header>
    <label><Search size={14} /><input autoFocus value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search live models" /></label>
    <div role="listbox" aria-label="Live AI models">
      {models.map((model) => <button className={model.key === selectedKey ? "is-selected" : ""} type="button" role="option" aria-selected={model.key === selectedKey} key={model.key} onClick={() => onSelect(model.key)}><span><WandSparkles size={16} /></span><span><strong>{model.name}{model.badge && <em>{model.badge}</em>}</strong><small>{model.description}</small></span><b>From {defaultModelCredits(model)} cr</b>{model.key === selectedKey && <Check size={14} />}</button>)}
      {!models.length && <p>No live model matches “{search}”.</p>}
    </div>
    <footer><span><i /> Live through Kie API</span><b>Price updates with every setting.</b></footer>
  </section>;
}

function StudioMegaMenu({ activeType, models, onClose, onModel, onTool }: { activeType: MediaType; models: CatalogModel[]; onClose: () => void; onModel: (model: CatalogModel) => void; onTool: (tool: StudioTool) => void }) {
  const capabilities = activeType === "chat" ? [] : tools.filter((tool) => tool.mediaType === activeType);
  return <section className={`studio-mega-menu ${activeType === "chat" ? "is-chat" : ""}`} aria-label={`${modeLabel(activeType)} menu`}>
    <div className="studio-mega-heading"><div><span>TIMELESS / {modeLabel(activeType).toUpperCase()}</span><strong>{activeType === "chat" ? "Choose your thinking partner" : "Choose a capability or model"}</strong></div><button type="button" onClick={onClose} aria-label="Close menu"><X size={16} /></button></div>
    <div className="studio-mega-grid">
      {activeType !== "chat" && <div className="studio-mega-column studio-mega-capabilities"><p>Capabilities <span>{capabilities.length}</span></p><div>{capabilities.map((tool) => { const Icon = tool.icon; return <button className={tool.available ? "is-live" : "is-soon"} key={tool.key} type="button" onClick={() => onTool(tool)}><span className="studio-mega-icon"><Icon size={17} /></span><span><strong>{tool.name}{tool.badge && <em>{tool.badge}</em>}</strong><small>{tool.description}</small></span><b>{tool.available ? "Live" : "Soon"}</b></button>; })}</div></div>}
      <div className="studio-mega-column studio-mega-models"><p>Models <span>{models.length}</span></p><div>{models.map((model) => <button className={model.modelKey ? "is-live" : "is-soon"} key={model.name} type="button" onClick={() => onModel(model)}><span className="studio-mega-model-mark"><Sparkles size={16} /></span><span><strong>{model.name}{model.badge && <em>{model.badge}</em>}</strong><small>{model.description}</small></span><b>{model.credits ? `From ${model.credits} cr` : "Soon"}</b></button>)}</div></div>
    </div>
    <footer><span><i /> Available now</span><span><i /> In rollout</span><b>Credits are shown only for live models.</b></footer>
  </section>;
}

function ToolLibrary({ mediaType, tools: categoryTools, onMode, onOpen, onRecreate }: { mediaType: GenerativeMediaType; tools: StudioTool[]; onMode: (mode: MediaType) => void; onOpen: (tool: StudioTool) => void; onRecreate: (example: ShowcaseExample) => void }) {
  const copy = { image: ["What should we create?", "Generate, transform, and finish campaign-ready imagery."], video: ["Bring an idea to life", "Create, animate, direct, and finish cinematic video."], audio: ["Make it heard", "Voice, music, dialogue, and clean sound in one studio."] }[mediaType];
  const [showcaseFilter, setShowcaseFilter] = useState("All");
  const showcaseFilters = ["All", "Viral", "Camera", "VFX", "Fashion", "Product", "Cinematic", "Editorial", "Surreal", "Character", "Fantasy"];
  const trendingKeys = ["wind-sculpt", "reality-door", "chrome-impact", "glass-bullet-time", "paparazzi-burst", "fabric-freeze"];
  const showcaseRank = (key: string) => { const rank = trendingKeys.indexOf(key); return rank === -1 ? trendingKeys.length : rank; };
  const visibleExamples = [...showcaseExamples].sort((first, second) => showcaseRank(first.key) - showcaseRank(second.key)).filter((example) => showcaseFilter === "All" || example.category.toLowerCase().includes(showcaseFilter.toLowerCase()));
  const featuredTools = categoryTools.filter((tool) => tool.available).slice(0, 3);
  const toolGrid = <div className="studio-tool-grid">{categoryTools.map((tool) => { const Icon = tool.icon; return <button className={tool.available ? "is-live" : "is-soon"} key={tool.key} type="button" onClick={() => onOpen(tool)}><span className="studio-tool-icon"><Icon size={20} /></span><span><strong>{tool.name}{tool.badge && <em>{tool.badge}</em>}</strong><small>{tool.description}</small></span><ChevronDown className="studio-tool-arrow" size={15} /></button>; })}</div>;

  if (mediaType === "image") return <section className="studio-tool-library is-image studio-explore">
    <header className="studio-explore-header">
      <span className="sr-only">Explore</span>
      <div className="studio-explore-title"><span>TRENDING RECREATIONS</span><h1>Steal the shot. Make it yours.</h1><p>Start from a finished look, then change the subject, product, world, or motion.</p></div>
      <div className="studio-explore-actions"><span><strong>{showcaseExamples.length}</strong> live recreations</span><button type="button" onClick={() => featuredTools[0] && onOpen(featuredTools[0])}><WandSparkles size={16} /> Create from scratch</button></div>
    </header>
    <div className="studio-showcase-filters" aria-label="Filter showcase examples">{showcaseFilters.map((filter) => {
      const count = filter === "All" ? showcaseExamples.length : showcaseExamples.filter((example) => example.category.toLowerCase().includes(filter.toLowerCase())).length;
      return <button aria-pressed={showcaseFilter === filter} className={showcaseFilter === filter ? "is-active" : ""} key={filter} type="button" onClick={() => setShowcaseFilter(filter)}>{filter}<small>{count}</small></button>;
    })}</div>
    <section className="studio-showcase" aria-labelledby="studio-showcase-title">
      <h2 className="sr-only" id="studio-showcase-title">Trending creations to recreate</h2>
      <div className="studio-showcase-grid">{visibleExamples.map((example) => {
        const isVideoRecipe = ["camera-motion", "motion-presets", "video-effects", "image-to-video"].includes(example.toolKey);
        return <article className={`studio-showcase-card is-${example.size || "standard"}`} key={example.key}>
          <Image unoptimized src={example.image} alt={example.alt} width={1536} height={1024} sizes="(max-width: 780px) 100vw, (max-width: 1120px) 50vw, 25vw" />
          {example.badge && <b className={`studio-showcase-badge is-${example.badge.toLowerCase()}`}>{example.badge}</b>}
          <div className="studio-showcase-overlay"><span>{example.category}</span><h3>{example.title}</h3><small>{isVideoRecipe ? <Clapperboard size={12} /> : <ImageIcon size={12} />}{example.model || "Timeless Studio"}</small><button type="button" onClick={() => onRecreate(example)} aria-label={`Recreate ${example.title}`}><WandSparkles size={15} /> Recreate</button></div>
        </article>;
      })}</div>
    </section>
    <details className="studio-all-tools"><summary><span><strong>All image tools</strong><small>Explore {categoryTools.length} creation, editing, and finishing workflows</small></span><ChevronDown size={17} /></summary>{toolGrid}<p className="studio-library-note"><Lightbulb size={13} /> Live tools generate now. Upcoming tools show what is coming next.</p></details>
  </section>;

  return <section className={`studio-tool-library is-${mediaType}`}><div className="studio-library-orb" aria-hidden="true" /><div className="studio-library-heading"><span>{modeLabel(mediaType)}</span><h1>{copy[0]}</h1><p>{copy[1]}</p></div><div className="studio-library-switcher"><button onClick={() => onMode("image")} type="button"><ImageIcon size={15} /> Image</button><button className={mediaType === "video" ? "is-active" : ""} onClick={() => onMode("video")} type="button"><Clapperboard size={15} /> Video</button><button className={mediaType === "audio" ? "is-active" : ""} onClick={() => onMode("audio")} type="button"><AudioLines size={15} /> Sound</button></div>{toolGrid}<p className="studio-library-note"><Lightbulb size={13} /> Live tools generate now. Upcoming tools are visible so the studio roadmap stays clear.</p></section>;
}

function ChatWorkspace({ busy, chatPrompt, chatSearch, messages, onNew, onPrompt, onSearch, onSelectThread, onSend, selectedThreadId, threads, user }: { busy: boolean; chatPrompt: string; chatSearch: string; messages: ChatMessage[]; onNew: () => void; onPrompt: (value: string) => void; onSearch: (value: string) => void; onSelectThread: (id: string) => void; onSend: () => void; selectedThreadId: string | null; threads: ChatThread[]; user: User | null }) {
  return <section className="studio-chat-workspace"><aside className="studio-chat-history"><div><strong>Conversations</strong><button type="button" onClick={onNew}><Plus size={15} /> New chat</button></div><label><Search size={14} /><input value={chatSearch} onChange={(event) => onSearch(event.target.value)} placeholder="Search conversations" /></label><nav>{threads.map((thread) => <button className={thread.id === selectedThreadId ? "is-active" : ""} type="button" key={thread.id} onClick={() => onSelectThread(thread.id)}><MessageSquareText size={14} /><span>{thread.title}</span><small>{new Date(thread.updated_at).toLocaleDateString()}</small></button>)}</nav></aside><div className="studio-chat-main">{!messages.length ? <div className="studio-chat-empty"><span><MessageSquareText size={21} /></span><p>TIMELESS CHAT</p><h1>What can we create together?</h1><small>Plan a campaign, write a script, improve a prompt, or develop your next story with GPT 5.2.</small><div>{["Write a 30-second launch script", "Turn my idea into an image prompt", "Plan five creator posts", "Give this story a stronger opening"].map((idea) => <button key={idea} type="button" onClick={() => onPrompt(idea)}>{idea}</button>)}</div></div> : <div className="studio-chat-messages">{messages.map((message) => <article className={`is-${message.role}`} key={message.id}><span>{message.role === "assistant" ? <Sparkles size={15} /> : (user ? displayName(user).slice(0, 2).toUpperCase() : "YOU")}</span><div><p>{message.content}</p>{message.role === "assistant" && <small>{message.credits_charged} credit · {message.provider_tokens?.toLocaleString() || "—"} tokens</small>}</div></article>)}{busy && <article className="is-assistant is-thinking"><span><Sparkles size={15} /></span><div><LoaderCircle size={17} /> Thinking with GPT 5.2…</div></article>}</div>}<div className="studio-chat-composer"><textarea value={chatPrompt} onChange={(event) => onPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} placeholder="Message Timeless Chat…" rows={2} /><div><button type="button" title="Attachments coming next"><Paperclip size={16} /></button><button className="studio-chat-model" type="button"><WandSparkles size={14} /> GPT 5.2 <ChevronDown size={12} /></button><span>1 credit</span><button className="studio-chat-send" type="button" onClick={onSend} disabled={busy || !chatPrompt.trim()}><Send size={16} /></button></div></div></div></section>;
}

function AuthDialog({ onClose, onCancel, onNotice }: { onClose: () => void; onCancel?: () => void; onNotice: (notice: string) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin"); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || socialInFlight.current) return;
    setSocialError(null);
    setEmailError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error } = await studioSupabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) throw new Error("No session returned");
        onClose();
      } else {
        const { data, error } = await studioSupabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/studio` } });
        if (error) throw error;
        if (!data.session) onNotice("Check your email to finish creating your Timeless account.");
        onClose();
      }
    } catch (error) {
      setEmailError(emailAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const socialInFlight = useRef(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  async function social() {
    if (busy || socialInFlight.current) return;
    socialInFlight.current = true;
    setSocialBusy(true);
    setSocialError(null);
    setEmailError(null);
    try {
      const url = await googleSignInUrl(studioSupabase.auth, window.location.origin);
      window.location.assign(url);
    } catch (error) {
      setSocialError(socialAuthErrorMessage(error));
      socialInFlight.current = false;
      setSocialBusy(false);
    }
  }
  useEffect(() => {
    const resetSocial = () => { socialInFlight.current = false; setSocialBusy(false); };
    window.addEventListener("pageshow", resetSocial);
    return () => window.removeEventListener("pageshow", resetSocial);
  }, []);
  return <div className="studio-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && (onCancel || onClose)()}><section className="studio-modal studio-auth-modal" role="dialog" aria-modal="true" aria-labelledby="studio-auth-title"><button className="studio-modal-close" onClick={onCancel || onClose} type="button" aria-label="Close"><X size={18} /></button><span className="studio-modal-icon"><Sparkles size={20} /></span><p className="studio-modal-kicker">ONE TIMELESS ACCOUNT</p><h2 id="studio-auth-title">{mode === "signin" ? "Welcome back, creator." : "Create your studio."}</h2><p className="studio-modal-copy">Your projects, generations, conversations, and credits stay together across Timeless.</p><div className="studio-social-row"><button type="button" disabled={busy || socialBusy} aria-busy={socialBusy} onClick={social}>{socialBusy ? <><LoaderCircle size={16} aria-hidden="true" /> Connecting to Google…</> : "Continue with Google"}</button></div>{socialError && <p className="studio-auth-error" role="alert">{socialError}</p>}<div className="studio-divider"><span>or use email</span></div><form onSubmit={submit} aria-busy={busy}>{mode === "signup" && <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" /></label>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>{emailError && <p className="studio-auth-error" role="alert">{emailError}</p>}<button className="studio-modal-primary" disabled={busy || socialBusy} type="submit">{busy ? <><LoaderCircle size={16} aria-hidden="true" /> {mode === "signin" ? "Signing in…" : "Creating account…"}</> : mode === "signin" ? "Sign in" : "Create account"}</button></form><button className="studio-auth-switch" disabled={busy || socialBusy} type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setEmailError(null); setSocialError(null); }}>{mode === "signin" ? "New to Timeless? Create an account" : "Already have an account? Sign in"}</button></section></div>;
}

function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return <div className="studio-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="studio-modal studio-project-modal" role="dialog" aria-modal="true" aria-labelledby="studio-project-title"><button className="studio-modal-close" onClick={onClose} type="button" aria-label="Close"><X size={18} /></button><p className="studio-modal-kicker">NEW CREATIVE SPACE</p><h2 id="studio-project-title">Name your project.</h2><form onSubmit={(event) => { event.preventDefault(); onCreate(name); }}><label>Project name<input autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Summer campaign" required /></label><button className="studio-modal-primary" type="submit"><Plus size={16} /> Create project</button></form></section></div>;
}
