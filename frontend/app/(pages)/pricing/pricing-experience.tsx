"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { studioSupabase } from "../studio/supabase";
import { studioCatalogPricing } from "../studio/catalog-pricing";
import { calculateStudioCredits } from "../studio/pricing";
import { pricingModels } from "./model-data";
import { trackMetaEvent } from "../../meta-pixel";

const initialPacks = [
  {key:"spark",name:"Spark",credits:1000,price_cents:999,currency:"usd",badge:"",description:"Find your next great idea."},
  {key:"creator",name:"Creator",credits:3500,price_cents:2999,currency:"usd",badge:"Most popular",description:"Make creating a daily habit."},
  {key:"production",name:"Production",credits:10000,price_cents:7999,currency:"usd",badge:"Best value",description:"Give every ambitious idea room."},
];
const brands = [
  {key:"higgsfield",name:"Higgsfield",logo:"higgsfield.png",href:"https://higgsfield.ai/pricing",entry:"$15 / month",detail:"Starter · 200 monthly credits",terms:"Plus: $49 monthly / 1,000 credits. Ultra: $129 / 3,000. Annual plans and limited-time unlimited offers can reduce effective costs.",scope:"Image, video & audio"},
  {key:"openart",name:"OpenArt",logo:"openart.ico",href:"https://openart.ai/pricing",entry:"$14 / month",detail:"Starter · 4,000 monthly credits",terms:"Starter is $13 per month equivalent with annual billing. Per-model usage varies; the public plan page gives broad output estimates.",scope:"Image, video & audio"},
  {key:"capcut",name:"CapCut",logo:"capcut.ico",href:"https://www.capcut.com/help/new-capcut-subscription-pricing",entry:"Regional pricing",detail:"Editing suite + AI credits",terms:"Plan pricing varies by region and platform. The upgraded Pro offer includes 1,200 AI credits; each feature has its own credit cost.",scope:"Video editing & AI tools"},
  {key:"runway",name:"Runway",logo:"runway.svg",href:"https://runway.com/pricing",entry:"$15 / month",detail:"Standard · 625 monthly credits",terms:"$12 per month equivalent with annual billing. Standard credits reset monthly; purchased add-on credits do not expire.",scope:"Image, video & audio"},
];
const money = (value:number, digits=2) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const niceVariant = (v:string) => v.replace(/\|false/g," · silent").replace(/\|true/g," · with audio").replace(/^std/,"720p standard").replace(/^pro/,"1080p pro").replace("fixed","Standard");
// Published Higgsfield rates. Treat as reference quotes where audio/quality is unspecified.
function higgsfieldReference(key:string,variant:string) {
  if(key==="nano-banana-2-1k") return {credits:2,unit:"image",note:"Nano Banana 2; resolution not specified in the public rate row."};
  if(key==="flux-2-flex-1k") return {credits:3,unit:"image",note:"FLUX.2 Flex; resolution not specified in the public rate row."};
  if(key==="kling-3-video") return {credits:variant.startsWith("4K")?30:variant.startsWith("pro")?8:7,unit:"5s video",note:"Matching resolution; audio setting not specified in the public rate row."};
  if(key==="wan-3-video") return {credits:variant==="1080P"?27.5:variant==="720P"?12.5:6.25,unit:"5s video",note:"Wan 3.0 at the selected resolution; audio setting not specified."};
  if(key==="seedance-1-5-pro-720p-8s") return {credits:variant.startsWith("1080p")?7:variant.startsWith("720p")?3:1,unit:"5s video",note:"Listed as Seedance 1.5; audio setting not specified. Timeless durations differ."};
  return null;
}
export default function PricingExperience({ variant: landingVariant = "default" }: { variant?: "default" | "higgsfield" }) {
  const [packs,setPacks]=useState(initialPacks);
  const [prices,setPrices]=useState(studioCatalogPricing);
  const [packKey,setPackKey]=useState("production");
  const [modelKey,setModelKey]=useState(pricingModels[0].key);
  const [variant,setVariant]=useState("1K");
  const [duration,setDuration]=useState("8");
  const [hfPlan,setHfPlan]=useState("plus-monthly");
  const [quantity,setQuantity]=useState(100);
  useEffect(()=>{
    let live=true;
    void studioSupabase.from("studio_credit_packs").select("key,name,credits,price_cents,currency,badge,description").eq("is_active",true).order("sort_order").then(({data})=>{if(live && data?.length)setPacks(data);});
    void studioSupabase.auth.getSession().then(async ({data:{session}})=>{
      if(!session)return;
      const {data}=await studioSupabase.from("studio_models").select("key,credit_cost,credit_rules").eq("is_active",true);
      if(live && data?.length)setPrices(Object.fromEntries(data.map(m=>[m.key,{credit_cost:m.credit_cost,credit_rules:m.credit_rules}])));
    });
    return ()=>{live=false;};
  },[]);
  useEffect(() => {
    trackMetaEvent("ViewContent", {
      content_category: "Studio credits",
      content_name: landingVariant === "higgsfield" ? "Higgsfield comparison pricing" : "Studio pricing",
      content_type: "product_group",
      currency: "USD",
    });
  }, [landingVariant]);
  const pack=packs.find(p=>p.key===packKey)||packs[0];
  const model=pricingModels.find(m=>m.key===modelKey)||pricingModels[0];
  const price=prices[model.key]||studioCatalogPricing[model.key];
  const rules=price.credit_rules;
  const variants=Object.keys(rules.rates||{fixed:1});
  const selectedVariant=variants.includes(variant)?variant:variants[0];
  const selectedDuration=model.durations.map(String).includes(duration)?duration:String(model.durations[0]);
  const params:Record<string,unknown>={...model.defaults};
  rules.keys?.forEach((k,i)=>{params[k]=selectedVariant.split("|")[i];});
  if(rules.multiplierKey)params[rules.multiplierKey]=selectedDuration;
  const credits=calculateStudioCredits(price.credit_cost,params,rules);
  const usdPerCredit=pack.price_cents/100/pack.credits;
  const hf=higgsfieldReference(model.key,selectedVariant);
  const hfUnit=hfPlan==="plus-monthly"?49/1000:hfPlan==="ultra-monthly"?129/3000:hfPlan==="plus-annual"?39/1000:99/3000;
  const defaultCredits=(key:string)=>{const m=pricingModels.find(m=>m.key===key)!;const p=prices[key]||studioCatalogPricing[key];return calculateStudioCredits(p.credit_cost,m.defaults,p.credit_rules);};
  const buy=(key:string)=>`/studio?buy=${encodeURIComponent(key)}`;
  return <main className="credit-page min-h-screen font-sans text-stone-100">
    <nav className="credit-nav credit-shell flex h-24 items-center justify-between border-b border-white/10 max-md:h-20" aria-label="Pricing navigation">
      <Link className="brand inline-flex items-center gap-3 text-lg tracking-widest max-md:text-sm" href="/studio"><img className="brand-mark size-9 rounded-lg" src="/timeless-icon.png" alt=""/><span>TIMELESS<small className="mt-1.5 block text-xs tracking-widest text-neutral-400">STUDIO</small></span></Link>
      <div className="flex items-center gap-7 text-sm"><a href="#compare">Compare models</a><a href="#packs">Credit packs</a><Link className="credit-nav-back inline-flex items-center gap-2.5 rounded-full border border-white/10 px-4 py-2.5 max-md:px-3 max-md:py-2 max-md:text-xs" href="/studio">Back to Studio <ArrowUpRight size={16}/></Link></div>
    </nav>
    <header className={`credit-hero credit-shell text-center py-20 pb-11 max-md:pt-12 max-md:pb-8 ${landingVariant === "higgsfield" ? "credit-hero-conquest" : ""}`}>
      <p className="credit-eyebrow font-mono text-xs font-normal tracking-widest text-rose-300"><span/> {landingVariant === "higgsfield" ? "SELECT MODELS COST UP TO 50% LESS" : "CREATIVE FREEDOM. ONE BALANCE."}</p>
      <h1 className="my-6 text-6xl font-normal leading-tight tracking-tight max-md:text-6xl lg:text-7xl xl:text-8xl">{landingVariant === "higgsfield" ? <>Keep the model.<br/><em>Lose the monthly lock-in.</em></> : <>More making.<br/><em>Less monthly.</em></>}</h1>
      <p className="text-lg leading-relaxed text-neutral-400 max-md:text-base">{landingVariant === "higgsfield" ? <>Compare selected AI model costs with Higgsfield, then buy only the credits you need.<br className="credit-desktop"/> No subscription. No monthly reset. Your exact generation price is shown before you create.</> : <>Your next campaign, film, or wild idea starts here.<br className="credit-desktop"/> Powerful AI models. Small, transparent prices. No subscription required.</>}</p>
      <div className="credit-hero-proof mt-7 flex flex-wrap justify-center gap-6.5 text-sm text-neutral-300 max-md:gap-3 max-md:text-xs"><span className="inline-flex items-center gap-1.5"><Check size={16}/> One-time payment</span><span className="inline-flex items-center gap-1.5"><Check size={16}/> No monthly reset</span><span className="inline-flex items-center gap-1.5"><Check size={16}/> Choose your model</span></div>
    </header>
    <section id="packs" className="credit-shell credit-packs grid grid-cols-1 gap-4.5 scroll-mt-8 sm:grid-cols-3 max-md:mx-auto max-md:max-w-md max-md:gap-5.5" aria-label="Buy credit packs">
      {packs.map((p,i)=><article className={`credit-pack ${p.key==="creator"?"credit-popular":""}`} key={p.key}>
        <div className="credit-pack-name"><h2>{p.name}</h2>{p.badge&&<span>{p.badge}</span>}</div>
        <img className="credit-pack-art" src={`/pricing/${["spark","creator","production"].includes(p.key)?p.key:"spark"}.svg`} alt={`${p.name} abstract gradient vector artwork`} width="360" height="250"/>
        <p className="credit-pack-tagline">{initialPacks.find(x=>x.key===p.key)?.description||p.description}</p>
        <div className="credit-pack-price">{money(p.price_cents/100)}<span>one time</span></div>
        <p className="credit-pack-balance"><strong>{p.credits.toLocaleString("en-US")}</strong> credits</p>
        <Link className={`credit-buy ${i===0?"credit-buy-quiet":""}`} href={buy(p.key)}>Choose {p.name}<ArrowUpRight size={18}/></Link>
        <ul><li><Check size={15}/> Up to {Math.floor(p.credits/defaultCredits("nano-banana-2-1k")).toLocaleString("en-US")} Nano Banana 2 images</li><li><Check size={15}/> Or {Math.floor(p.credits/defaultCredits("seedance-1-5-pro-720p-8s")).toLocaleString("en-US")} Seedance video clips</li><li><Check size={15}/> Mix models with one balance</li></ul>
        <small>Image: 1K. Video: 720p, 8s, silent. Estimates use the entire pack for one model.</small>
      </article>)}
    </section>
    <p className="credit-secure"><ShieldCheck size={16}/> Secure one-time checkout powered by Stripe. No recurring Studio subscription.</p>
    <section className="credit-shell credit-value" aria-label="Why creators choose Timeless">
      <div><span>01 / FREEDOM</span><h3>Buy when inspiration hits.</h3><p>No monthly reset. Your purchased balance is ready for your next creative session.</p></div>
      <div><span>02 / MOMENTUM</span><h3>Less setup. More creating.</h3><p>Move between image and video models in one workspace, with the credit cost shown before you generate.</p></div>
      <div><span>03 / CONTROL</span><h3>Make every credit count.</h3><p>Start with smaller drafts, then increase resolution or add audio when your idea is ready.</p></div>
    </section>
    <section id="compare" className="credit-shell credit-comparison">
      <div className="credit-section-heading"><div><p className="credit-eyebrow">THE REAL COST OF CREATING</p><h2>Compare the output.<br/><em>Not just the credit count.</em></h2></div><p>Different platforms give credits different values. Pick a model and see what your money makes.</p></div>
      <div className="credit-calculator">
        <div className="credit-controls">
          <label>Model<select value={model.key} onChange={e=>{setModelKey(e.target.value);setVariant("");}}>{pricingModels.map(m=><option key={m.key} value={m.key}>{m.name}</option>)}</select></label>
          <label>Quality & audio<select value={selectedVariant} onChange={e=>setVariant(e.target.value)}>{variants.map(v=><option value={v} key={v}>{niceVariant(v)}</option>)}</select></label>
          {model.kind==="video"&&<label>Duration<select value={selectedDuration} onChange={e=>setDuration(e.target.value)}>{model.durations.map(d=><option key={d} value={d}>{d} seconds</option>)}</select></label>}
          <label>Your pack<select value={pack.key} onChange={e=>setPackKey(e.target.value)}>{packs.map(p=><option value={p.key} key={p.key}>{p.name} · {money(p.price_cents/100)}</option>)}</select></label>
        </div>
        <div className="credit-result" aria-live="polite"><div><p>TIMELESS / {model.kind.toUpperCase()}</p><strong>{money(credits*usdPerCredit,3)}</strong><span>effective cost per {model.kind} · {credits} credits</span></div><div><p>WITH YOUR {pack.name.toUpperCase()} PACK</p><strong>{Math.floor(pack.credits/credits).toLocaleString("en-US")}</strong><span>{model.kind}s at these settings</span></div><Link href={buy(pack.key)} className="credit-buy">Get {pack.name}<ArrowRight size={18}/></Link></div>
        <div className="credit-usage"><label>Plan your usage <input type="number" min="1" max="10000" value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(10000,Math.floor(Number(e.target.value))||1)))}/> outputs</label><p><strong>{(credits*quantity).toLocaleString("en-US")} credits</strong> · {money(credits*quantity*usdPerCredit)} worth of your selected balance</p></div>
        <p className="credit-fine">Effective cost allocates your pack price across its credits; outputs are not sold individually. Taxes excluded. Reference catalog updated September 5, 2026; signed-in pricing refreshes from Studio. The final generation quote is shown in Studio.</p>
      </div>
      <div className="credit-compare-top"><h3>Alongside other creative platforms</h3><label>Higgsfield reference plan<select value={hfPlan} onChange={e=>setHfPlan(e.target.value)}><option value="plus-monthly">Plus · $49 monthly</option><option value="ultra-monthly">Ultra · $129 monthly</option><option value="plus-annual">Plus · $39/mo billed annually</option><option value="ultra-annual">Ultra · $99/mo billed annually</option></select></label></div>
      <div className="credit-brand-grid">{brands.map(b=><article key={b.key}>
        <a className="credit-brand-title" href={b.href} target="_blank" rel="noreferrer"><img src={`/pricing/${b.logo}`} alt={`${b.name} logo`} width="28" height="28"/><h4>{b.name}</h4><ArrowUpRight size={14}/></a>
        {b.key==="higgsfield"&&hf?<><strong className="credit-peer-price">{money(hf.credits*hfUnit,3)}<small> / {hf.unit}</small></strong><p>{hf.credits} platform credits. {hf.note}</p></>:<><strong className="credit-peer-status">Check model quote</strong><p>A matching {model.name} rate with these settings was not verified on the public pricing page.</p></>}
        <div className="credit-brand-plan"><b>{b.entry}</b><small>{b.detail}</small></div><p>{b.terms}</p><a className="credit-source-link" href={b.href} target="_blank" rel="noreferrer">View official pricing ↗</a>
      </article>)}</div>
      <p className="credit-fine">Competitor references checked September 5, 2026. A reference price is not an identical-output guarantee: model versions, audio, resolution, duration, promotions and bundled features can differ. Annual rates require annual commitment. Unverified rates are left unpriced, not treated as unavailable. Some subscriptions can cost less at high usage. Generation speed varies by model, settings and provider load; no cross-platform speed benchmark is claimed. Logos identify their respective brands; no affiliation or endorsement.</p>
    </section>
    <section className="credit-shell credit-rate-section">
      <div className="credit-section-heading"><div><p className="credit-eyebrow">EVERY LIVE GENERATION MODEL</p><h2>A price for every idea.</h2></div><p>Default settings shown below. Explore all quality and duration options in the calculator above.</p></div>
      <div className="credit-table-scroll"><table className="credit-rate-table"><thead><tr><th>Model / default output</th><th>Credits</th><th>{pack.name} cost / output</th><th>Outputs / pack</th></tr></thead><tbody>{pricingModels.map(m=>{const cr=defaultCredits(m.key);return <tr key={m.key}><th><button onClick={()=>{setModelKey(m.key);setVariant("");document.getElementById("compare")?.scrollIntoView({behavior:"smooth"});}}>{m.name}<ArrowUpRight size={13}/></button><small>{String(m.defaults.resolution||m.defaults.quality||m.defaults.mode||"Standard")}{m.kind==="video"?` · ${m.defaults.duration}s · ${m.defaults.generate_audio||m.defaults.sound||m.defaults.audio?"audio":"silent"}`:" · image"}</small></th><td>{cr}</td><td>{money(cr*usdPerCredit,3)}</td><td>{Math.floor(pack.credits/cr).toLocaleString("en-US")}</td></tr>;})}</tbody></table></div>
      <p className="credit-fine">GPT 5.2 chat uses 1 credit per message. Sound tools are in rollout and are not included in these generation estimates.</p>
    </section>
    <section className="credit-shell credit-faq"><div><p className="credit-eyebrow">BEFORE YOUR FIRST GENERATION</p><h2>Good questions.<br/>Clear answers.</h2></div><div>
      {[['Is this a subscription?','No. Spark, Creator and Production are one-time purchases. There is no recurring charge or monthly reset of your purchased Studio balance.'],['Can I mix models in one pack?','Yes. Spend the same balance across available image, video and chat tools. Higher resolutions, longer videos and audio settings can use more credits.'],['What happens after I buy?','Sign in to your Timeless account, complete secure Stripe checkout, and return to Studio. Your balance updates after payment is confirmed.'],['What if a generation fails?','Eligible technical failures automatically restore the credits charged for that generation. See the Refund Policy for purchase refund terms.'],['How long are my files saved?','Generated files expire after seven days unless you choose to keep them in your Studio library. Download or keep the outputs you want to preserve.'],['Is Timeless always the cheapest or fastest?','Costs depend on your model and usage. Timeless offers low one-time entry pricing and no monthly commitment. Competitor subscriptions or promotions can be cheaper for some workflows. Completion times vary with model, settings and demand.']].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}
    </div></section>
    <section className="credit-shell credit-final"><Zap size={24}/><p className="credit-eyebrow">YOUR NEXT IDEA IS WAITING</p><h2>Give it a little spark.</h2><p>Start with {money(packs[0].price_cents/100)}. See where it takes you.</p><a className="credit-buy" href="#packs">Choose your credits<ArrowUpRight size={18}/></a></section>
    <footer className="credit-shell credit-footer"><p>© 2026 Timeless Studio · Prices in USD; applicable taxes may be added at checkout.<br/>Timeless Studio web payments are securely processed by Stripe.</p><div><Link href="/refund">Refund Policy</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/studio">Studio</Link></div></footer>
  </main>;
}
