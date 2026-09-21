# Timeless AI Studio — backend handoff

## Outcome

`https://timelessapp.ai/studio` will be a signed-in AI image/video workspace. The existing Timeless Supabase project is the system of record and provides:

- authentication and user sessions;
- PostgreSQL metadata, projects, model catalog, generation jobs and credits;
- private input/output object storage;
- realtime generation status updates;
- short-lived upload and download URLs;
- server-side AI-provider submission and signed webhook handling.

The browser must never contain a Supabase service-role key or an AI-provider key.

## Ownership split

### Backend package supplied here

- Migration: `supabase/migrations/202608210001_ai_studio.sql`
- Upload API: `supabase/functions/studio-upload-url/index.ts`
- Job API: `supabase/functions/studio-create-generation/index.ts`
- Asset download API: `supabase/functions/studio-asset-url/index.ts`
- Provider webhook: `supabase/functions/studio-provider-webhook/index.ts`
- Shared authentication/security code: `supabase/functions/_shared/studio.ts`
- Environment template: `supabase/functions/.env.studio.example`

### Studio frontend developer

- build the `/studio` pages and components;
- use Supabase Auth with the existing publishable URL/key;
- create, read and rename `studio_projects` through the authenticated Supabase client;
- use only the functions below for uploads, job creation and asset URLs;
- subscribe to the current user's `studio_generations` rows for progress;
- present the active `studio_models` returned by Supabase;
- show the read-only `studio_credit_wallets.balance` value;
- never write generation status, model pricing, assets, wallets or ledger rows directly.

### Provider-adapter developer

- connect actual providers (for example image/video model vendors) behind one server endpoint;
- translate the provider-neutral request into each vendor's request format;
- upload completed output to the supplied signed `PUT` URL;
- send signed progress/completion/failure webhooks;
- keep all vendor API keys on the adapter server.

This adapter can be a small service on Cloud Run, Fly.io, Render or another always-on/serverless platform. The browser never calls it directly.

## Architecture

```text
timelessapp.ai/studio
        |
        | Supabase user JWT
        v
Supabase Auth + Database + Edge Functions
        |                         |
        | signed upload URLs      | server-only API key
        v                         v
Private Supabase Storage    Provider adapter -> AI vendors
        ^                         |
        | signed output PUT       | HMAC-signed status webhook
        +-------------------------+
```

Long-running AI work does not run inside an Edge Function. The Edge Function validates and charges the request, then the provider adapter performs the long-running orchestration.

## Database contract

| Table | Frontend access | Purpose |
| --- | --- | --- |
| `studio_models` | Read active rows | Model picker, capability and trusted credit price |
| `studio_projects` | Owner create/read/rename | User workspaces/projects |
| `studio_generations` | Owner read | Prompt, parameters, progress and terminal state |
| `studio_assets` | Owner read | Metadata for private inputs/outputs |
| `studio_generation_inputs` | Owner read | Ordered input references for a job |
| `studio_credit_wallets` | Owner read | Current Studio credit balance |
| `studio_credit_ledger` | Owner read | Purchases, grants, charges and refunds |

All user tables have Row Level Security. Service-only functions atomically reserve credits when a generation is created and refund the same charge once if submission or generation fails.

The model catalog is deliberately empty after migration. Before launch, an owner must add enabled models with their real provider identifiers and prices. Example:

```sql
insert into public.studio_models
  (key, name, provider, provider_model_id, media_type, credit_cost, parameter_schema, is_active, sort_order)
values
  (
    'vendor-image-v1',
    'Image V1',
    'configured-adapter',
    'actual-provider-model-id',
    'image',
    4,
    '{"type":"object","additionalProperties":false,"properties":{"aspectRatio":{"type":"string","enum":["1:1","16:9","9:16"]},"seed":{"type":"integer","minimum":0,"maximum":2147483647}}}'::jsonb,
    true,
    10
  );
```

Do not trust a credit cost or arbitrary provider parameter supplied by the browser. `studio-create-generation` loads the server-controlled price and validates every parameter against the selected model's `parameter_schema`.

For v1, every differently priced duration/resolution tier should be a separate model-catalog row. Do not expose a parameter that changes provider cost unless the server price for that model already covers its maximum allowed value.

## Storage contract

All buckets are private and have no browser write policy.

| Bucket | Maximum object | Allowed content |
| --- | ---: | --- |
| `studio-inputs` | 100 MB | JPEG, PNG, WebP, MP4, QuickTime |
| `studio-outputs` | 2 GB | JPEG, PNG, WebP, MP4 |
| `studio-thumbnails` | 10 MB | JPEG, PNG, WebP |

Object paths are server-generated and user-scoped:

```text
studio-inputs/{userId}/{projectId}/{assetId}/{safeFileName}
studio-outputs/{userId}/{projectId}/{generationId}/result-0.{png|mp4}
```

Input upload sequence:

1. Browser calls `studio-upload-url` with metadata.
2. Browser uploads bytes directly to the returned signed URL using `PUT` and the declared `Content-Type`.
3. Browser includes the returned asset ID in `studio-create-generation`.
4. The server verifies that the object exists before submitting the job.

Download/display sequence:

1. Browser reads an owned `studio_assets` row.
2. Browser calls `studio-asset-url` with its asset ID.
3. Browser uses the short-lived URL returned by the function.

Do not persist signed URLs in the database; persist only bucket and object path.

## Frontend API

Base URL:

```text
https://{SUPABASE_PROJECT_REF}.supabase.co/functions/v1
```

Every frontend request includes:

```http
Authorization: Bearer {supabase_access_token}
Content-Type: application/json
```

### 1. Request an input upload

`POST /studio-upload-url`

```json
{
  "projectId": "uuid",
  "fileName": "reference.png",
  "mimeType": "image/png",
  "sizeBytes": 2483021
}
```

Success: `201 Created`

```json
{
  "asset": {
    "id": "uuid",
    "projectId": "uuid",
    "mimeType": "image/png",
    "sizeBytes": 2483021,
    "status": "pending_upload"
  },
  "upload": {
    "method": "PUT",
    "url": "short-lived-signed-url",
    "token": "upload-token",
    "headers": { "Content-Type": "image/png" }
  }
}
```

### 2. Create a generation

`POST /studio-create-generation`

```json
{
  "projectId": "uuid",
  "modelKey": "vendor-image-v1",
  "prompt": "A cinematic portrait in warm window light",
  "negativePrompt": "text, watermark",
  "parameters": {
    "aspectRatio": "9:16",
    "seed": 1234
  },
  "inputAssetIds": ["uuid"],
  "idempotencyKey": "one-random-uuid-per-generate-click"
}
```

Success: `202 Accepted`. Repeating the same request with the same user/idempotency key returns the original job without another charge. Insufficient credit returns `402` with `{"error":"insufficient_credits"}`.

The server allows at most three active generations per user and ten creation attempts per minute. Limit responses use HTTP `429`.

Generation states:

```text
created -> queued -> processing -> succeeded
                            \----> failed (refunded)
                            \----> canceled (refunded)
```

### 3. Request a private asset URL

`POST /studio-asset-url`

```json
{
  "assetId": "uuid",
  "expiresIn": 900
}
```

The expiry is clamped to 60–3600 seconds.

### Realtime subscription

Subscribe to changes on `public.studio_generations` and filter by `user_id=eq.{currentUserId}`. RLS remains authoritative. On a change, update the matching job card; after `succeeded`, query its `studio_assets` output row and request a signed asset URL.

## Provider-adapter API

Supabase calls the URL stored in `STUDIO_PROVIDER_SUBMIT_URL`:

```http
POST /v1/generations
Authorization: Bearer {STUDIO_PROVIDER_API_KEY}
Content-Type: application/json
```

Representative request:

```json
{
  "clientJobId": "uuid",
  "provider": "configured-adapter",
  "model": "actual-provider-model-id",
  "mediaType": "image",
  "prompt": "...",
  "negativePrompt": "...",
  "parameters": {},
  "inputs": [
    { "id": "uuid", "url": "signed-get-url", "mimeType": "image/png" }
  ],
  "output": {
    "assetId": "uuid",
    "method": "PUT",
    "url": "signed-put-url",
    "token": "upload-token",
    "headers": { "Content-Type": "image/png" }
  },
  "webhookUrl": "https://{project}.supabase.co/functions/v1/studio-provider-webhook"
}
```

The adapter must respond synchronously with `2xx` and:

```json
{ "jobId": "provider-job-id" }
```

For success, the adapter first uploads the final file to `output.url`, then calls the webhook. Signed upload URLs are intentionally short-lived, so the adapter should copy vendor results promptly. If a vendor can exceed that period, the adapter should request a fresh server-side output URL in a future adapter-only endpoint rather than expose storage credentials.

### Signed webhook

`POST /studio-provider-webhook`

The adapter computes HMAC-SHA256 over the exact raw JSON request body with `STUDIO_PROVIDER_WEBHOOK_SECRET` and sends the lowercase hexadecimal digest:

```http
x-studio-signature: {hex-hmac}
```

Progress:

```json
{
  "clientJobId": "uuid",
  "providerJobId": "provider-job-id",
  "status": "processing",
  "progress": 45
}
```

Success, only after output upload:

```json
{
  "clientJobId": "uuid",
  "providerJobId": "provider-job-id",
  "status": "succeeded",
  "progress": 100
}
```

Failure:

```json
{
  "clientJobId": "uuid",
  "providerJobId": "provider-job-id",
  "status": "failed",
  "error": {
    "code": "provider_content_policy",
    "message": "The provider rejected this prompt."
  }
}
```

Provider webhooks are idempotent. Repeated terminal notifications do not double-refund.

## Setup and deployment

1. Link the workspace to the existing Timeless Supabase project.
2. Apply the database/storage migration with `supabase db push`.
3. Confirm the hosted project's global Storage upload limit is at least 2 GB; bucket-specific limits cannot exceed the project limit.
4. Configure the five Studio secrets shown in `.env.studio.example` using the Supabase secret manager. Never commit actual values.
5. Deploy all four `studio-*` functions.
6. Add the real model catalog rows only after the provider adapter supports them.
7. Grant beta/test credits server-side before testing with the service-only `studio_add_credits(user_id, amount, 'grant', unique_reference)` function. The production purchase webhook uses the same function with `purchase`; repeated references are idempotent.
8. Configure Supabase Auth redirect allow-list entries for `https://timelessapp.ai/studio` and the local developer origin.
9. Run the acceptance tests below before connecting a paid provider.

Suggested function deploy commands:

```sh
supabase functions deploy studio-upload-url
supabase functions deploy studio-create-generation
supabase functions deploy studio-asset-url
supabase functions deploy studio-provider-webhook --no-verify-jwt
```

## Acceptance checklist

- User A cannot read User B's project, generation, asset, wallet or ledger rows.
- User A cannot request a signed URL for User B's asset ID.
- Browser code contains only the Supabase URL and publishable key.
- Unsupported MIME types and oversized inputs are rejected before an upload URL is issued.
- Missing input uploads are rejected before credits are charged.
- Repeating an idempotency key creates one job and one charge.
- Insufficient credits never submit a provider job.
- Provider submission failure produces one refund.
- Invalid webhook signatures return `401` and make no database change.
- A success webhook is rejected until the expected output exists in private storage.
- Output URLs expire and raw storage objects are not public.
- Realtime updates are visible only to the authenticated owner.

## Product decisions still needed before public launch

- the first image/video provider(s) and exact models;
- credit prices and whether new accounts receive a trial grant;
- Stripe/web checkout products and tax handling for web credit purchases;
- moderation rules and blocked-content policy;
- maximum video duration/resolution per plan;
- whether Timeless VIP and Studio plans are separate or bundled.

These are configuration/product decisions. They do not require changing the frontend API shape above.

Retention is now fixed: generation binaries expire after seven days unless the
owner explicitly keeps an output. Incomplete uploads expire after one day.
