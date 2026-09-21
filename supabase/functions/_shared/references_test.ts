import {referenceError,referencePricing,referenceFields,type ReferenceAsset} from './references.ts';
import {mediaMetadata} from './media_metadata.ts';
import {buildKieCreateBody} from './kie.ts';
import {calculateStudioCredits} from './pricing.ts';
const models=JSON.parse(Deno.readTextFileSync(new URL('../../../maintenance/kie-reference-audit/catalog.json',import.meta.url)));
const get=(key:string)=>models.find((m:{key:string})=>m.key===key);
function equal(a:unknown,b:unknown){if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`);}
const img=(id:string,slot='images'):ReferenceAsset=>({id,slot,mimeType:'image/png',sizeBytes:1000,width:768,height:768,url:'https://test.invalid/'+id+'.png'});
const vid=(id:string,duration=4):ReferenceAsset=>({id,slot:'videos',mimeType:'video/mp4',sizeBytes:10000,width:720,height:1280,fps:30,duration,url:'https://test.invalid/'+id+'.mp4'});
for(const m of models){Deno.test(`${m.name}: reference order, limits, MIME and byte-size guards`,()=>{
 for(const slot of m.provider_config.referenceSlots){
  const a=slot.mimeTypes[0].startsWith('video/')?vid('a'):slot.mimeTypes[0].startsWith('audio/')?{...vid('a'),mimeType:'audio/wav'}:img('a',slot.key);a.slot=slot.key;
  const fields=referenceFields(m.provider_config,[a]);if(!(slot.field in fields))throw Error('missing field');
  equal(referenceError(m.provider_config,[{...a,mimeType:'text/html'}],false),'unsupported_reference_type');
  equal(referenceError(m.provider_config,[{...a,sizeBytes:slot.maxBytes+1}],false),'reference_file_too_large');
  const tooMany=Array.from({length:slot.max+1},(_,i)=>({...a,id:String(i)}));if(!referenceError(m.provider_config,tooMany,false))throw Error('count limit not enforced');
 }
});}
Deno.test('Seedance multimodal fields remain separate and frame modes conflict',()=>{
 const c=get('seedance-2-5').provider_config,refs=[img('b'),img('a'),vid('v')];equal(referenceError(c,refs),null);
 const f=referenceFields(c,refs);equal(f.reference_image_urls,['https://test.invalid/b.png','https://test.invalid/a.png']);equal(f.reference_video_urls,['https://test.invalid/v.mp4']);equal(referenceError(c,[...refs,img('first','first')]),'conflicting_reference_modes');equal(referenceError(c,[img('last','last')]),'first_frame_required');
 equal(referenceError(c,[vid('a',20),vid('b',20)]),'reference_total_duration_exceeded');equal(referenceError(c,[{...vid('a'),fps:12}]),'invalid_reference_fps');
});
Deno.test('Gemini enforces weighted quota and precise trim bounds',()=>{
 const c=get('gemini-omni-flash-1-1').provider_config,refs=[...Array.from({length:5},(_,i)=>img(String(i))),{...vid('v',20),start:2,end:8}];equal(referenceError(c,refs),null);equal(referenceError(c,[...refs,img('extra')]),'too_many_reference_slots');equal(referenceError(c,[{...vid('v',20),start:2,end:13}]),'invalid_reference_trim');equal(referenceFields(c,refs).video_list,[{url:'https://test.invalid/v.mp4',start:2,ends:8}]);
});
Deno.test('References change quotes without accepting browser billing values',()=>{
 const seed=get('seedance-2-5'),p={...seed.provider_config.defaultInput,...referencePricing([vid('v',4)])};equal(calculateStudioCredits(seed.credit_cost,p,seed.credit_rules),122);
 const flash=get('gemini-omni-flash-1-1');equal(calculateStudioCredits(flash.credit_cost,{...flash.provider_config.defaultInput,...referencePricing([vid('v')])},flash.credit_rules),151);
 const h3=get('minimax-h3-reference');equal(calculateStudioCredits(h3.credit_cost,{duration:4,resolution:'768P',...referencePricing([img('a'),img('b')])},h3.credit_rules),36);
});
Deno.test('Image generation routes references to the documented editing endpoint',()=>{
 for(const m of models.filter((m:{media_type:string})=>m.media_type==='image')){
  const b=buildKieCreateBody({clientJobId:'test',model:m.provider_model_id,mediaType:'image',prompt:'Combine these images',parameters:m.provider_config.defaultInput,inputs:[img('one'),img('two')] as any,config:m.provider_config},'https://test.invalid/callback');equal(b.model,m.provider_config.imageModel);const field=m.provider_config.referenceSlots[0].field;equal(b.input[field],['https://test.invalid/one.png','https://test.invalid/two.png']);
 }
});
Deno.test('Media parser rejects mislabeled files and reads actual PNG dimensions',()=>{
 const b=new Uint8Array(25);b.set([137,80,78,71]);const v=new DataView(b.buffer);v.setUint32(16,768);v.setUint32(20,1024);equal(mediaMetadata(b,'image/png'),{width:768,height:1024});let rejected=false;try{mediaMetadata(new TextEncoder().encode('<html>bad</html>'),'video/mp4');}catch{rejected=true;}equal(rejected,true);
});

Deno.test('Every exposed video-reference quality has a verified price',()=>{for(const m of models){if(m.credit_rules.inputVideoRates){for(const quality of m.parameter_schema.properties.resolution.enum){if(!(m.credit_rules.inputVideoRates[quality]>0))throw Error(m.key+': missing '+quality);}}}});

Deno.test('Wan rejects excessive combined duration and accepts multiple videos within bounds',()=>{
 const c=get('wan-3-video').provider_config;
 equal(referenceError(c,[vid('a',8),vid('b',7)],true,{duration:15}),null);
 equal(referenceError(c,[vid('a',8),vid('b',7)],true,{duration:16}),'reference_output_duration_exceeded');
 equal(referenceError(c,[vid('a',8),vid('b',8)],true,{duration:5}),'reference_total_duration_exceeded');
});
Deno.test('Lip sync requires both video and WAV and bills rounded audio duration',()=>{
 const m=get('video-lip-sync'),audio={...vid('voice',3.308),slot:'audio',mimeType:'audio/wav'};
 equal(referenceError(m.provider_config,[vid('face'),audio]),null);
 equal(referenceError(m.provider_config,[vid('face')]),'reference_required');
 equal(calculateStudioCredits(m.credit_cost,{...m.provider_config.defaultInput,...referencePricing([vid('face'),audio])},m.credit_rules),29);
});
import {shotSequenceError} from './references.ts';
Deno.test('Shot sequences reject invalid prompts, fractional duration, overflow and extra images',()=>{
 const good=[{prompt:'Wide shot',duration:3},{prompt:'Close-up',duration:3}];
 equal(shotSequenceError(true,good,1),null);equal(shotSequenceError(false,good,0),'invalid_shots');
 for(const bad of [null,[],[good[0]],Array(6).fill(good[0]),[{prompt:' ',duration:3},good[1]],[{prompt:'A',duration:1.5},good[1]]])equal(shotSequenceError(true,bad,0),'invalid_shots');
 equal(shotSequenceError(true,good,2),'invalid_shot_duration_or_references');equal(shotSequenceError(true,good.map(s=>({...s,duration:10})),0),'invalid_shot_duration_or_references');
});
Deno.test('GPT Image 1.5 exposes only provider-supported portrait and landscape ratios',()=>{
 const m=get('gpt-image-1-5');equal(m.parameter_schema.properties.aspect_ratio.enum,['1:1','2:3','3:2']);
});
