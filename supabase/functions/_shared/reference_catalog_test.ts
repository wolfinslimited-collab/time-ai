import {validateStudioParameters} from './studio.ts';
import {referenceError,referencePricing,type ReferenceAsset} from './references.ts';
import {buildKieCreateBody} from './kie.ts';
import {calculateStudioCredits} from './pricing.ts';
const base=new URL('../../../maintenance/kie-reference-audit/',import.meta.url);
const models=JSON.parse(Deno.readTextFileSync(new URL('catalog.json',base)));
const docs=JSON.parse(Deno.readTextFileSync(new URL('reference-contracts.json',base)));
let verified=0;
for(const m of models){
 Deno.test(`${m.name}: current reference endpoint and settings match provider contract`,()=>{
  const d=docs[m.key].input;
  // Kie's Fast schema has a trailing space in reference_video_urls; its examples and live API use the trimmed name.
  const props=Object.fromEntries(Object.entries(d.properties).map(([key,value])=>[key.trim(),value])) as Record<string,any>;
  for(const [key,rule] of Object.entries(m.parameter_schema.properties) as [string,any][]){const source=props[key];if(!source||source.type!==rule.type)throw Error('Undocumented parameter '+key);if(source.enum&&rule.enum?.some((v:unknown)=>!source.enum.includes(v)))throw Error('Unsupported '+key);}
  for(const s of m.provider_config.referenceSlots)if(!props[s.field])throw Error('Undocumented reference '+s.field);
  for(const key of d.required||[])if(key!=='prompt'&&!m.parameter_schema.properties[key]&&!m.provider_config.referenceSlots.some((s:any)=>s.field===key)&&!['multi_prompt','multi_shots'].includes(key))throw Error('Missing required '+key);
 });
 Deno.test(`${m.name}: all exposed setting combinations preserve references and calculate a quote`,()=>{
  let cases:Record<string,unknown>[]=[{}];for(const [key,rule] of Object.entries(m.parameter_schema.properties) as [string,any][])cases=cases.flatMap(c=>(rule.enum||(rule.type==='boolean'?[false,true]:[m.provider_config.defaultInput[key]])).map((v:unknown)=>({...c,[key]:v})));
  const slots=m.provider_config.referenceSlots;
  const groups=slots.some((s:any)=>s.group==='frames')?['references','frames']:['references'];
  for(const group of groups){const refs:ReferenceAsset[]=slots.filter((s:any)=>!s.group||s.group===group).flatMap((s:any)=>Array.from({length:Math.min(s.max,s.mimeTypes[0].startsWith('image/')?2:1)},(_,i)=>({id:s.key+i,slot:s.key,mimeType:s.mimeTypes[0],sizeBytes:10000,width:720,height:1280,fps:30,duration:4,url:'https://test.invalid/'+s.key+i})));
   if(!refs.length)continue;
   for(const original of cases){const p={...original};if(m.provider_config.frameAspectRatio&&refs.some(r=>r.slot==='first'))p.aspect_ratio=m.provider_config.frameAspectRatio;
    if((m.parameter_schema.forbiddenCombinations||[]).some((c:Record<string,unknown>)=>Object.entries(c).every(([k,v])=>p[k]===v)))continue;
    validateStudioParameters(p,m.parameter_schema);
    const err=referenceError(m.provider_config,refs,true,p);if(err==='reference_output_duration_exceeded')continue;if(err)throw Error(err);
    const priced:Record<string,unknown>={...p,...referencePricing(refs)},rules=m.credit_rules;
    if(rules.strategy==='matrix'&&!rules.rates[rules.keys.map((k:string)=>String(priced[k])).join('|')])throw Error('Missing setting price');
    const price=calculateStudioCredits(m.credit_cost,priced,rules);if(!Number.isSafeInteger(price)||price<1)throw Error('Invalid quote');
    const b=buildKieCreateBody({clientJobId:'test',model:m.provider_model_id,mediaType:m.media_type,prompt:'Test reference',parameters:p,inputs:refs as any,config:m.provider_config},'https://test.invalid/callback');
    for(const [k,v] of Object.entries(p))if(b.input[k]!==v)throw Error('Setting lost '+k);
    for(const slot of slots.filter((s:any)=>refs.some(r=>r.slot===s.key)))if(!b.input[slot.field])throw Error('Reference lost '+slot.field);
    if(b.model!==(m.provider_config.imageModel||m.provider_model_id))throw Error('Wrong endpoint');verified++;
   }
  }
 });
}
Deno.test('Reference matrix coverage is nonempty',()=>{if(verified<1000)throw Error('Coverage unexpectedly small');console.log('Verified reference/configuration combinations:',verified);});
