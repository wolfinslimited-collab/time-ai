import { sanitizeChatAnswer, TIMELESS_CHAT_SYSTEM_PROMPT } from "./chat.ts";

Deno.test("sanitizeChatAnswer removes provider writing wrappers", () => {
  assertEquals(
    sanitizeChatAnswer(':::writing{variant="standard"}\nA clean answer.\n:::'),
    "A clean answer.",
  );
});

Deno.test("sanitizeChatAnswer preserves ordinary Markdown", () => {
  assertEquals(
    sanitizeChatAnswer("## Idea\n\nA strong opening."),
    "## Idea\n\nA strong opening.",
  );
});

Deno.test("chat system prompt explicitly requests wrapper-free Markdown", () => {
  if (
    !TIMELESS_CHAT_SYSTEM_PROMPT.includes("Markdown") ||
    !TIMELESS_CHAT_SYSTEM_PROMPT.includes(":::writing")
  ) {
    throw new Error("Chat system prompt is missing formatting guidance");
  }
});

function assertEquals(actual: unknown, expected: unknown) {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
