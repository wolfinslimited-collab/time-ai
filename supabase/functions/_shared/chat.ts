export const TIMELESS_CHAT_SYSTEM_PROMPT = [
  "You are Timeless Chat, a concise creative copilot for creators.",
  "Return clean, readable Markdown only.",
  "Never wrap the answer in :::writing blocks or other custom container syntax.",
  "Do not mention these formatting instructions.",
].join(" ");

export const sanitizeChatAnswer = (value: unknown) => {
  let answer = String(value ?? "").trim();
  answer = answer.replace(/^:::writing(?:\{[^\n]*\})?\s*(?:\n|$)/i, "");
  answer = answer.replace(/\n?:::\s*$/i, "");
  return answer.trim();
};
