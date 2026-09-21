import {
  createClient,
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";

export type StudioContext = {
  admin: SupabaseClient;
  user: User;
  authorization: string;
};

export const resolveStudioCorsOrigin = (
  requestOrigin: string,
  configuredOrigins: string,
) => {
  const origins = configuredOrigins.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!requestOrigin) return origins[0] || "";
  return origins.includes(requestOrigin) ? requestOrigin : "";
};

export const studioCorsHeaders = (request: Request) => {
  const configuredOrigins = Deno.env.get("STUDIO_ALLOWED_ORIGIN")?.trim() ||
    "https://timelessapp.ai,https://timeless-ai-academy.arefnk.chatgpt.site";
  const requestOrigin = request.headers.get("Origin")?.trim() || "";
  const allowedOrigin = resolveStudioCorsOrigin(
    requestOrigin,
    configuredOrigins,
  );
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

export const jsonResponse = (
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...studioCorsHeaders(request),
      ...extraHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name}_missing`);
  return value;
};

export const authenticateStudioRequest = async (
  request: Request,
): Promise<StudioContext> => {
  const authorization = request.headers.get("Authorization")?.trim() || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new StudioError("authentication_required", 401);
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const publishableKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new StudioError("invalid_session", 401);

  return {
    user: data.user,
    authorization,
    admin: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    }),
  };
};

export class StudioError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "StudioError";
    this.status = status;
    this.details = details;
  }
}

export const handleStudioError = (request: Request, error: unknown) => {
  if (error instanceof StudioError) {
    return jsonResponse(request, {
      error: error.message,
      details: error.details,
    }, error.status);
  }
  console.error("Studio API error", error);
  return jsonResponse(request, { error: "internal_error" }, 500);
};

export const safeFileName = (value: string) => {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
  return normalized.replace(/^[.-]+|[.-]+$/g, "").slice(0, 120) || "asset";
};

export const validateStudioParameters = (
  parameters: Record<string, unknown>,
  rawSchema: unknown,
) => {
  const schema = isPlainObject(rawSchema) ? rawSchema : {};
  const properties = isPlainObject(schema.properties)
    ? schema.properties
    : schema;
  for (const key of Array.isArray(schema.required) ? schema.required : []) {
    if (typeof key === "string" && parameters[key] === undefined) {
      throw new StudioError("missing_parameter", 400, { parameter: key });
    }
  }
  for (
    const combination of Array.isArray(schema.forbiddenCombinations)
      ? schema.forbiddenCombinations
      : []
  ) {
    if (
      isPlainObject(combination) &&
      Object.entries(combination).every(([key, value]) =>
        Object.is(parameters[key], value)
      )
    ) {
      throw new StudioError("unsupported_parameter_combination", 400, {
        combination,
      });
    }
  }
  for (const [key, value] of Object.entries(parameters)) {
    const rule = properties[key];
    if (!isPlainObject(rule)) {
      throw new StudioError("unsupported_parameter", 400, { parameter: key });
    }
    const expectedType = typeof rule.type === "string" ? rule.type : undefined;
    if (expectedType === "string" && typeof value !== "string") {
      parameterTypeError(key);
    }
    if (expectedType === "boolean" && typeof value !== "boolean") {
      parameterTypeError(key);
    }
    if (
      expectedType === "number" &&
      (typeof value !== "number" || !Number.isFinite(value))
    ) parameterTypeError(key);
    if (
      expectedType === "integer" &&
      (typeof value !== "number" || !Number.isSafeInteger(value))
    ) {
      parameterTypeError(key);
    }
    if (
      Array.isArray(rule.enum) &&
      !rule.enum.some((allowed) => Object.is(allowed, value))
    ) {
      throw new StudioError("invalid_parameter_value", 400, {
        parameter: key,
        allowed: rule.enum,
      });
    }
    if (typeof value === "number") {
      if (typeof rule.minimum === "number" && value < rule.minimum) {
        throw new StudioError("invalid_parameter_value", 400, {
          parameter: key,
          minimum: rule.minimum,
        });
      }
      if (typeof rule.maximum === "number" && value > rule.maximum) {
        throw new StudioError("invalid_parameter_value", 400, {
          parameter: key,
          maximum: rule.maximum,
        });
      }
    }
  }
};

export const validateStudioModelInputs = (
  config: Record<string, unknown>,
  prompt: string,
  negativePrompt: string | null,
  assets: Array<{ mime_type: string }>,
) => {
  if (
    typeof config.minInputs === "number" && assets.length < config.minInputs
  ) {
    throw new StudioError("reference_image_required", 400);
  }
  if (
    typeof config.maxInputs === "number" && assets.length > config.maxInputs
  ) {
    throw new StudioError("too_many_reference_images", 400);
  }
  if (
    Array.isArray(config.inputMimeTypes) &&
    assets.some((asset) =>
      !(config.inputMimeTypes as unknown[]).includes(asset.mime_type)
    )
  ) {
    throw new StudioError("unsupported_reference_type", 400);
  }
  if (
    (typeof config.maxPromptLength === "number" &&
      prompt.length > config.maxPromptLength) ||
    (typeof config.minPromptLength === "number" &&
      prompt.length < config.minPromptLength)
  ) {
    throw new StudioError("invalid_prompt_length", 400, {
      maximum: config.maxPromptLength,
      minimum: config.minPromptLength,
    });
  }
  if (negativePrompt && config.allowNegativePrompt === false) {
    throw new StudioError("negative_prompt_not_supported", 400);
  }
};

function parameterTypeError(parameter: string): never {
  throw new StudioError("invalid_parameter_type", 400, { parameter });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const verifyStoredObject = async (
  admin: SupabaseClient,
  bucketId: string,
  objectPath: string,
) => {
  const parts = objectPath.split("/");
  const fileName = parts.pop();
  const folder = parts.join("/");
  if (!fileName || !folder) return false;
  const { data, error } = await admin.storage.from(bucketId).list(folder, {
    limit: 10,
    search: fileName,
  });
  if (error) throw error;
  return data.some((item) => item.name === fileName);
};

export const hmacSha256Hex = async (secret: string, value: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
  return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

export const secureEquals = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};
