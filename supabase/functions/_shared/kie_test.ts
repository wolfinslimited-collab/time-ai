import {
  buildKieCreateBody,
  extractKieResultUrls,
  hasKieTaskTimedOut,
} from "./kie.ts";

Deno.test("Kie body uses server catalog defaults and configured input field", () => {
  const body = buildKieCreateBody({
    clientJobId: "00000000-0000-0000-0000-000000000000",
    model: "nano-banana-2",
    mediaType: "image",
    prompt: "A cinematic portrait",
    parameters: { aspect_ratio: "9:16" },
    inputs: [{
      id: "asset",
      url: "https://example.com/input.png",
      mimeType: "image/png",
    }],
    config: {
      inputField: "image_input",
      defaultInput: { aspect_ratio: "1:1", resolution: "1K" },
    },
  }, "https://example.com/callback");
  assertEquals(body.input, {
    aspect_ratio: "9:16",
    resolution: "1K",
    prompt: "A cinematic portrait",
    image_input: ["https://example.com/input.png"],
  });
});

Deno.test("Kie result parser accepts unified result JSON and rejects http", () => {
  assertEquals(
    extractKieResultUrls(
      '{"resultUrls":["https://example.com/a.png","http://example.com/b.png"]}',
    ),
    ["https://example.com/a.png"],
  );
});

Deno.test("Kie body translates a simple voiceover into Gemini TTS dialogue", () => {
  const body = buildKieCreateBody({
    clientJobId: "00000000-0000-0000-0000-000000000000",
    model: "google/gemini-3-1-flash-tts",
    mediaType: "audio",
    prompt: "Welcome to Timeless Studio.",
    parameters: { voice_name: "Puck", pace: "Natural" },
    config: {
      defaultInput: {
        temperature: 1,
        scene: "A premium creator studio voiceover.",
        sample_context: "Clear, polished narration.",
      },
    },
  }, "https://example.com/callback");
  assertEquals(body.input, {
    temperature: 1,
    scene: "A premium creator studio voiceover.",
    sample_context: "Clear, polished narration.",
    speakers: [{
      speaker_id: "Speaker 1",
      voice_name: "Puck",
      audio_profile: "A warm, confident creative narrator",
      accent: "American (Gen)",
      style: "Deadpan",
      pace: "Natural",
    }],
    dialogue_turns: [{
      speaker_id: "Speaker 1",
      text: "Welcome to Timeless Studio.",
    }],
  });
});

Deno.test("Kie body translates a voiceover into ElevenLabs dialogue", () => {
  const body = buildKieCreateBody({
    clientJobId: "00000000-0000-0000-0000-000000000000",
    model: "elevenlabs/text-to-dialogue-v3",
    mediaType: "audio",
    prompt: "Welcome to Timeless Studio.",
    parameters: { stability: 0.5 },
    config: { defaultInput: { voice: "EkK5I93UQWFDigLMpZcX" } },
  }, "https://example.com/callback");
  assertEquals(body.input, {
    stability: 0.5,
    dialogue: [{
      text: "Welcome to Timeless Studio.",
      voice: "EkK5I93UQWFDigLMpZcX",
    }],
  });
});

Deno.test("Kie task timeout protects reserved Studio credits", () => {
  const now = Date.parse("2026-09-02T12:30:00.000Z");
  assertEquals(
    hasKieTaskTimedOut("2026-09-02T12:09:59.000Z", now),
    true,
  );
  assertEquals(
    hasKieTaskTimedOut("2026-09-02T12:10:01.000Z", now),
    false,
  );
});

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
