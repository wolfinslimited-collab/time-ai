import { requestWaveSpeedChat, WAVESPEED_CHAT_URL } from "./wavespeed.ts";
Deno.test("WaveSpeed sends conversation history using the chat-completions contract", async () => {
  const messages = [{role:"system",content:"Be concise."},{role:"user",content:"Name a campaign."},{role:"assistant",content:"Moonlight"},{role:"user",content:"Give it a tagline."}];
  const fake: typeof fetch = async (url,init) => {
    if(url !== WAVESPEED_CHAT_URL) throw Error("Wrong provider");
    const body=JSON.parse(String((init as {body?: unknown})?.body));
    if(body.model!=="openai/gpt-5.2" || JSON.stringify(body.messages)!==JSON.stringify(messages) || body.stream!==false) throw Error("Conversation altered");
    if("reasoning" in body || "reasoning_effort" in body) throw Error("Unsupported reasoning override");
    if(new Headers((init as {headers?: HeadersInit})?.headers).get("Authorization")!=="Bearer fake-test-key")throw Error("Missing auth");
    return new Response(JSON.stringify({choices:[{message:{content:"A little light."}}]}));
  };
  const response=await requestWaveSpeedChat("fake-test-key","openai/gpt-5.2",messages,false,fake);
  if((await response.json()).choices[0].message.content!=="A little light.")throw Error("Reply missing");
});
Deno.test("support requests streaming and provider failures stay failures", async () => {
  const fake: typeof fetch = async (_url,init) => {
    if(JSON.parse(String((init as {body?: unknown})?.body)).stream!==true)throw Error("Streaming disabled");
    return new Response("unavailable",{status:503});
  };
  const response=await requestWaveSpeedChat("fake","openai/gpt-5.6-luna",[],true,fake);
  if(response.ok || response.status!==503)throw Error("Failure was hidden");
});
