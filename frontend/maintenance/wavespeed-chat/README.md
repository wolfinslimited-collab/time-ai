# WaveSpeed chat migration — September 5, 2026

Production Supabase project: xmxsqmxuiksldqhtugvv. Deployed studio-chat, studio-support and studio-support-public. The supplied key is stored only as WAVESPEED_API_KEY in Supabase secrets, never in browser code or this repository.

Creative chat retains GPT-5.2 (WaveSpeed ID openai/gpt-5.2). Support retains GPT-5.6 Luna (openai/gpt-5.6-luna) and streams Chat Completions deltas. Endpoint: https://llm.wavespeed.ai/v1/chat/completions. Verified documentation: https://wavespeed.ai/docs/llm-service-quick-start and https://wavespeed.ai/docs/supported-llm-models.

A minimal request works. An initial request with optional reasoning and a small max_tokens setting returned upstream HTTP 400; those optional overrides are not sent. The timeout is 45 seconds. Authentication, project ownership, history, one-credit charging, and the existing failure-refund path are preserved. Media continues through the existing Kie adapter.

Direct smoke tests succeeded for GPT-5.2 (2.15 seconds) and Luna (6.18 seconds); a streamed Luna request returned 17 events in 4.42 seconds. These are single-request checks, not a speed guarantee. WaveSpeed's public GPT-5.2 rates are $1.75/million input and $14/million output tokens; the pre-existing one-credit chat price is unchanged and is outside the image/video 30% margin floor.

User test: two labeled grant credits were added to the owner's account, then consumed by a Moonlight campaign prompt and a context-recall follow-up. An initial attempt hit project_not_found because the admin read policy exposes all projects to that account. Personal Studio project, thread and generation queries now explicitly filter user_id. Chat refreshes the wallet balance after a successful response.

The .ts.txt files are review copies of the deployed Edge Function changes. Authoritative source remains in the parent project's supabase/functions tree.
