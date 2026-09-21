// The key stays inside Edge Functions. Keep media generation on the Kie adapter.
export const WAVESPEED_CHAT_URL = "https://llm.wavespeed.ai/v1/chat/completions";
export type ChatEntry = { role: string; content: string };
export function requestWaveSpeedChat(
  apiKey: string,
  model: string,
  messages: ChatEntry[],
  stream = false,
  fetcher: typeof fetch = fetch,
) {
  return fetcher(WAVESPEED_CHAT_URL, {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    // Optional reasoning fields vary by upstream model. This minimal contract
    // was verified for GPT-5.2 and GPT-5.6 Luna on WaveSpeed.
    body: JSON.stringify({ model, messages, stream }),
  });
}
