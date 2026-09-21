import {studioCorsHeaders} from './studio.ts';
export function partialSupportAnswer(raw:string):string {
  const match=/"answer"\s*:\s*"/.exec(raw);if(!match)return '';
  let out='';for(let i=match.index+match[0].length;i<raw.length;i++){
    const ch=raw[i];if(ch==='"')return out;if(ch!=='\\'){out+=ch;continue;}
    if(i+1>=raw.length)break;const esc=raw[++i];if(esc==='u'){const code=raw.slice(i+1,i+5);if(!/^[\da-f]{4}$/i.test(code))break;out+=String.fromCharCode(parseInt(code,16));i+=4;}else{const map:Record<string,string>={'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','"':'"','\\':'\\','/':'/'};if(!(esc in map))break;out+=map[esc];}
  }return out;
}
export function supportStreamResponse(request:Request,work:(emit:(answer:string)=>void)=>Promise<unknown>){
 const enc=new TextEncoder();let closed=false;
 const stream=new ReadableStream<Uint8Array>({async start(controller){
  const send=(data:unknown)=>{if(!closed)try{controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));}catch{closed=true;}};
  send({type:'start'});const timer=setInterval(()=>send({type:'heartbeat'}),10000);
  try{const data=await work(answer=>send({type:'delta',answer}));send({type:'done',data});}catch{send({type:'error',error:'support_request_failed'});}finally{clearInterval(timer);if(!closed){closed=true;controller.close();}}
 },cancel(){closed=true;}});
 return new Response(stream,{headers:{...studioCorsHeaders(request),'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
}
