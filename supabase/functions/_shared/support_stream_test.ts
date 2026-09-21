import {partialSupportAnswer} from './support_stream.ts';
const check=(a:unknown,b:unknown)=>{if(a!==b)throw Error(`${a} != ${b}`)};
Deno.test('Support streams only the answer string across partial JSON escapes',()=>{
 check(partialSupportAnswer('{"answer":"Hello'),'Hello');
 check(partialSupportAnswer('{"answer":"Hi\\nworld\\u00'), 'Hi\nworld');
 check(partialSupportAnswer('{"answer":"Hi\\nworld\\u00e9","escalate":false}'),'Hi\nworldé');
 check(partialSupportAnswer('{"escalate":false,"answer":"Done"}'),'Done');
 check(partialSupportAnswer('{"esc'),'');
});
