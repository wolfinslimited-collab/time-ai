"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,LoaderCircle,Plus,X} from 'lucide-react';
import {referenceError,type ReferenceAsset,type ReferenceConfig,type ReferenceSlot} from '../../lib/studio/references';
import {mediaMetadata} from '../../lib/studio/media-metadata';
export type UploadedReference = ReferenceAsset & {name:string;preview:string};
export const referenceMessage = (code:string) => ({
  duplicate_reference:'This file is already attached.',reference_required:'Add the required reference files first.',first_frame_required:'Add a first frame before using a last frame.',
  unsupported_reference_type:'Choose a supported file type for this reference.',invalid_reference_slot:'This reference is not supported by the selected model.',
  reference_file_too_large:'The reference exceeds this model’s file-size limit.',invalid_reference_media:'This file could not be read. Try a PNG, JPG, WebP, or standard MP4 file.',
  invalid_reference_duration:'The video length is outside the limit shown below.',invalid_reference_dimensions:'The reference dimensions do not meet this model’s limits.',invalid_reference_fps:'Use a reference video with 24–60 frames per second.',
  invalid_reference_trim:'Choose a valid clip within the video and the maximum clip length.',conflicting_reference_modes:'Use reference files or first/last frames in one generation.',
  too_many_reference_slots:'There are too many reference slots. A video uses two image slots.',too_many_references:'You have reached this model’s reference limit.',reference_output_duration_exceeded:'Reference videos plus the output must total 30 seconds or less.',reference_total_duration_exceeded:'The combined video duration exceeds this model’s limit.',
} as Record<string,string>)[code] || code;
export function ReferencePanel({config,value,onChange,onUpload,onBusy,onError,disabled}:{config:ReferenceConfig;value:UploadedReference[];onChange:(v:UploadedReference[])=>void;onUpload:(file:File)=>Promise<string>;onBusy:(v:boolean)=>void;onError:(s:string)=>void;disabled:boolean}) {
 const [mode,setMode]=useState<'references'|'frames'>('references');const [uploading,setUploading]=useState('');const alive=useRef(true);const urls=useRef<string[]>([]);const picker=useRef<HTMLInputElement>(null);const selectedSlot=useRef<ReferenceSlot|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;urls.current.forEach(URL.revokeObjectURL);onBusy(false);};},[]);
 const slots=config.referenceSlots || [];if(!slots.length)return null;
 const modes=slots.some(s=>s.group==='frames')&&slots.some(s=>s.group==='references');
 async function add(files:FileList|null){const slot=selectedSlot.current;if(!files||!slot)return;setUploading(slot.key);onBusy(true);let next=[...value];
  try{for(const file of Array.from(files)){
   if(!slot.mimeTypes.includes(file.type))throw Error('unsupported_reference_type');if(file.size>(slot.maxBytes||10*1024*1024))throw Error('reference_file_too_large');
   const data=mediaMetadata(new Uint8Array(await file.arrayBuffer()),file.type);const ref:UploadedReference={id:crypto.randomUUID(),slot:slot.key,mimeType:file.type,sizeBytes:file.size,...data,name:file.name,preview:'',...(slot.encoding==='video_list'?{start:0,end:Math.min(data.duration!,slot.maxClipDuration||10)}:{})};
   const error=referenceError(config,[...next,ref],false);if(error)throw Error(error);
   const id=await onUpload(file);if(!alive.current)return;const preview=URL.createObjectURL(file);urls.current.push(preview);next=[...next,{...ref,id,preview}];onChange(next);
  }}catch(e){if(alive.current)onError(referenceMessage(e instanceof Error?e.message:String(e)));}finally{if(alive.current)setUploading('');onBusy(false);}
 }
 function remove(id:string){onChange(value.filter(r=>r.id!==id));}
 function move(id:string,d:number){const i=value.findIndex(r=>r.id===id),slot=value[i]?.slot;const others=value.map((r,j)=>r.slot===slot?j:-1).filter(j=>j>=0);const dest=others[others.indexOf(i)+d];if(dest===undefined)return;const next=[...value];[next[i],next[dest]]=[next[dest],next[i]];onChange(next);}
 return <section className="studio-references" aria-label="Reference files">
  <header><strong>References</strong>{modes&&<div className="studio-reference-modes">{(['references','frames'] as const).map(m=><button type="button" disabled={disabled||!!uploading} aria-pressed={mode===m} key={m} onClick={()=>{setMode(m);onChange([]);}}>{m==='frames'?'First & last frames':'Images & videos'}</button>)}</div>}</header>
  <input ref={picker} type="file" className="studio-file-input" onChange={e=>{void add(e.target.files);e.currentTarget.value='';}} />
  {slots.filter(s=>!modes||s.group===mode||!s.group).map(slot=>{const refs=value.filter(r=>r.slot===slot.key);return <div key={slot.key} className="studio-reference-group">
   <div className="studio-reference-label"><label>{slot.label}{slot.min?' · Required':''} <span>{refs.length}/{slot.max}</span></label><button type="button" disabled={disabled||!!uploading||refs.length>=slot.max} aria-label={`Add ${slot.label.toLowerCase()}`} onClick={()=>{selectedSlot.current=slot;if(picker.current){picker.current.accept=slot.mimeTypes.join(',');picker.current.multiple=slot.max>1;picker.current.click();}}}>{uploading===slot.key?<LoaderCircle size={14}/>:<Plus size={14}/>} Add</button></div>
   <p>{slot.mimeTypes.includes('video/mp4')?`MP4 · ${slot.minDuration ?? 0}–${slot.maxDuration ?? 30}s each${slot.totalDuration?` · ${slot.totalDuration}s combined`:''}`:slot.mimeTypes.includes('audio/wav')?'WAV · 1–30s':'JPG, PNG, WebP'} · Up to {Math.round((slot.maxBytes||10485760)/1048576)} MB each{slot.minSide?` · ${slot.minSide}–${slot.maxSide} px per side`:''}{slot.minPixels?' · 0.41–0.93 megapixels':''}</p>
   <div className="studio-reference-files">{refs.map((r,i)=><article className="studio-reference-file" key={r.id}>
    {r.mimeType.startsWith('video/')?<video src={r.preview} controls preload="metadata"/>:r.mimeType.startsWith('image/')?<img src={r.preview} alt={`${slot.label} ${i+1}: ${r.name}`}/>:<audio src={r.preview} controls/>}
    <div><strong>{i+1}. {r.name}</strong><small>{r.width?`${r.width} × ${r.height}`:''}{r.duration?` · ${r.duration.toFixed(2)}s`:''}</small></div>
    <div className="studio-reference-actions"><button type="button" disabled={i===0||disabled} onClick={()=>move(r.id,-1)} aria-label={`Move ${r.name} earlier`}><ArrowLeft size={13}/></button><button type="button" disabled={i===refs.length-1||disabled} onClick={()=>move(r.id,1)} aria-label={`Move ${r.name} later`}><ArrowRight size={13}/></button><button type="button" disabled={disabled} onClick={()=>remove(r.id)} aria-label={`Remove ${r.name}`}><X size={14}/></button></div>
    {slot.encoding==='video_list'&&<div className="studio-reference-trim">{(['start','end'] as const).map(k=><label key={k}>{k==='start'?'Clip start':'Clip end'}<input aria-label={`${k==='start'?'Clip start':'Clip end'} ${r.name}`} type="number" min={0} max={r.duration} step={.1} value={r[k]??0} onChange={e=>onChange(value.map(a=>a.id===r.id?{...a,[k]:Number(e.target.value)}:a))}/></label>)}<span>Maximum {slot.maxClipDuration}s clip</span></div>}
   </article>)}</div>
  </div>})}
  {value.some(r=>r.mimeType.startsWith('video/'))&&config.autoDurationWithVideo&&<p className="studio-reference-notice">With a video reference, the model chooses the output length. The quote switches to the video-reference price.</p>}
  {config.frameAspectRatio&&value.some(r=>r.slot==='first')&&<p className="studio-reference-notice">Output shape follows the first frame.</p>}
  {config.referenceQuota&&<p className="studio-reference-notice">Up to {config.referenceQuota} slots. Each image uses 1; each video uses 2.</p>}
 </section>;
}
