import { requestWaveSpeedChat } from "./wavespeed.ts";
import { partialSupportAnswer } from "./support_stream.ts";
import { parseSupportAnswer, SUPPORT_PROMPT } from "./support.ts";
import { requiredEnv, type StudioContext } from "./studio.ts";

export async function answerSupport(
  admin: StudioContext["admin"],
  message: string,
  history: { role: string; content: string }[],
  guest = false,
  onPartial?: (answer: string) => void,
) {
  const [models, packs, websiteCatalog] = await Promise.all([
    admin.from("studio_models").select(
      "key,name,media_type,credit_cost,credit_rules,parameter_schema,provider_config",
    ).eq("is_active", true),
    admin.from("studio_credit_packs").select(
      "name,credits,price_cents,currency",
    ).eq("is_active", true),
    fetch("https://timelessapp.ai/api/studio/support-catalog", {
      signal: AbortSignal.timeout(6000),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("website_catalog_unavailable");
        const data = await response.json();
        if (!Array.isArray(data.entries)) {
          throw new Error("website_catalog_invalid");
        }
        return data.entries;
      }).catch(() => []),
  ]);
  if (models.error || packs.error) throw new Error("catalog_unavailable");
  const response = await requestWaveSpeedChat(
    requiredEnv("WAVESPEED_API_KEY"), "openai/gpt-5.6-luna", [
          {
            role: "system",
            content: SUPPORT_PROMPT + (guest
              ? "\nThis visitor is NOT signed in. Answer general platform questions freely. For personal account, payment, balance or generation investigation, set escalate=true and ask them to sign in for account help. You cannot create tickets for guests. Never claim to have opened a ticket or accessed their account."
              : "") +
              "\nCurrent catalog: " +
              JSON.stringify({
                activeModels: models.data?.map((
                  { provider_config, ...model },
                ) => ({
                  ...model,
                  defaultSettings: provider_config?.defaultInput ?? {},
                  referenceImageRequired: (provider_config?.minInputs ?? 0) > 0,
                  referenceSlots: provider_config?.referenceSlots?.map((slot: {min?:number}) => ({...slot,min:slot.min ?? 0})),
                  maxCombinedDuration: provider_config?.maxCombinedDuration,
                  referenceQuota: provider_config?.referenceQuota,
                  autoDurationWithVideo: provider_config?.autoDurationWithVideo,
                })),
                websiteListings: websiteCatalog,
                creditPacks: packs.data,
              }),
          },
          ...history.slice(-16).map(({ role, content }) => ({ role, content })),
          { role: "user", content: message },
    ], Boolean(onPartial),
  );
  if (!response.ok) throw new Error(`provider_unavailable_${response.status}`);
  if (onPartial && response.headers.get("content-type")?.includes("text/event-stream")) {
    const reader=response.body!.getReader(), decoder=new TextDecoder();let buffer="", raw="", last="";
    const emit = () => {const answer=partialSupportAnswer(raw);if(answer!==last){last=answer;onPartial(answer);}};
    while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let end;
      while((end=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(!line.startsWith("data:")||line.slice(5).trim()==="[DONE]")continue;
        let event;try{event=JSON.parse(line.slice(5));}catch{continue;}
        if(event.choices?.[0]?.delta?.content){raw+=event.choices[0].delta.content;emit();}
        if(event.error||event.type==="error")throw Error("provider_stream_failed");
      }if(done)break;
    }
    return parseSupportAnswer(raw);
  }
  const result = await response.json();
  const answer = result?.choices?.[0]?.message?.content;
  if (!answer) throw new Error(`provider_reply_${Number(result?.code ?? 0)}`);
  return parseSupportAnswer(answer);
}
