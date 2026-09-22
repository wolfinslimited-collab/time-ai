import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validParameterOptions, updateModelParameter } from '../app/(pages)/studio/video-settings.ts';
import { calculateStudioCredits } from '../app/(pages)/studio/pricing.ts';
const models=JSON.parse(readFileSync(new URL('../app/(pages)/studio/video-models.json',import.meta.url)));
test('Hailuo prevents 1080p/10s and resets duration when quality changes',()=>{
 const model=models.find(m=>m.key==='hailuo-2-3-pro');
 assert.deepEqual(validParameterOptions('duration',['6','10'],{resolution:'1080P'},model.parameter_schema.forbiddenCombinations),['6']);
 const next=updateModelParameter('resolution','1080P',{resolution:'768P',duration:'10'},model.parameter_schema);
 assert.equal(next.duration,'6');assert.equal(next.resolution,'1080P');
 assert.equal(calculateStudioCredits(model.credit_cost,next,model.credit_rules),72);
});
test('Seedance portrait and high-quality quote retain numeric duration and boolean audio',()=>{
 const m=models.find(m=>m.key==='seedance-2-5');let p=m.provider_config.defaultInput;
 for(const [k,v] of [['aspect_ratio','9:16'],['duration',8],['resolution','1080p'],['generate_audio',false]])p=updateModelParameter(k,v,p,m.parameter_schema);
 assert.equal(p.duration,8);assert.equal(p.generate_audio,false);assert.equal(p.aspect_ratio,'9:16');
 assert.equal(calculateStudioCredits(m.credit_cost,p,m.credit_rules),815);
});
test('each new model has a complete valid default quote and bounded reference requirements',()=>{
 for(const m of models){assert.ok(calculateStudioCredits(m.credit_cost,m.provider_config.defaultInput,m.credit_rules)>0);if(m.provider_config.referenceSlots){assert.ok(m.provider_config.maxInputs>0);for(const slot of m.provider_config.referenceSlots){assert.ok(slot.max>=1&&slot.max<=30);assert.ok(slot.mimeTypes.length);}}else assert.equal(m.provider_config.maxInputs,m.provider_config.inputField?1:0);}
});
