// Parse container headers, never trust MIME labels or browser-supplied duration.
export function mediaMetadata(bytes: Uint8Array, mime: string): {width?:number;height?:number;duration?:number;fps?:number} {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (p:number,n:number) => new TextDecoder().decode(bytes.subarray(p,p+n));
  if (mime === 'image/png' && bytes.length > 24 && str(1,3)==='PNG') return {width:v.getUint32(16),height:v.getUint32(20)};
  if (mime === 'image/jpeg' && bytes[0]===255 && bytes[1]===216) {
    let p=2; while(p+9<bytes.length) { if(bytes[p]!==255)break; const marker=bytes[p+1];if(marker===0xD9||marker===0xDA)break;const len=v.getUint16(p+2);if(len<2)break;if([0xc0,0xc1,0xc2,0xc3].includes(marker))return {height:v.getUint16(p+5),width:v.getUint16(p+7)};p+=2+len; }
  }
  if (mime === 'image/webp' && str(0,4)==='RIFF' && str(8,4)==='WEBP') {
    if(str(12,4)==='VP8X')return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
    if(str(12,4)==='VP8 ')return {width:v.getUint16(26,true)&0x3fff,height:v.getUint16(28,true)&0x3fff};
    if(str(12,4)==='VP8L'){const n=v.getUint32(21,true);return {width:1+(n&0x3fff),height:1+((n>>14)&0x3fff)};}
  }
  if(mime==='audio/wav' && str(0,4)==='RIFF' && str(8,4)==='WAVE') {
    let rate=0,size=0;for(let p=12;p+8<=bytes.length;){const n=v.getUint32(p+4,true);if(str(p,4)==='fmt '&&n>=16)rate=v.getUint32(p+16,true);if(str(p,4)==='data')size=n;p+=8+n+(n%2);}if(rate&&size)return {duration:size/rate};
  }
  if(mime==='video/mp4' && str(4,4)==='ftyp') {
    type Box={type:string;p:number;end:number};
    const boxes=(start:number,end:number):Box[]=>{const out:Box[]=[];for(let p=start;p+8<=end;){let n=v.getUint32(p),head=8;if(n===1){if(p+16>end)break;n=Number(v.getBigUint64(p+8));head=16;}if(n===0)n=end-p;if(n<head||p+n>end)break;out.push({type:str(p+4,4),p:p+head,end:p+n});p+=n;}return out;};
    const moov=boxes(0,bytes.length).find(b=>b.type==='moov');if(!moov)throw Error('invalid_reference_media');
    let duration=0,width=0,height=0,fps=0;
    const timing=(p:number)=>{const b=bytes[p]===1;const scale=v.getUint32(p+(b?20:12));const n=b?Number(v.getBigUint64(p+24)):v.getUint32(p+16);return {scale,duration:scale?n/scale:0};};
    for(const b of boxes(moov.p,moov.end)){
      if(b.type==='mvhd')duration=timing(b.p).duration;
      if(b.type!=='trak')continue;
      const children=boxes(b.p,b.end),tkhd=children.find(x=>x.type==='tkhd'),mdia=children.find(x=>x.type==='mdia');if(!tkhd||!mdia)continue;
      const md=boxes(mdia.p,mdia.end),hdlr=md.find(x=>x.type==='hdlr'),mdhd=md.find(x=>x.type==='mdhd');if(!hdlr||str(hdlr.p+8,4)!=='vide')continue;
      width=v.getUint32(tkhd.end-8)/65536;height=v.getUint32(tkhd.end-4)/65536;
      const minf=md.find(x=>x.type==='minf');const stbl=minf&&boxes(minf.p,minf.end).find(x=>x.type==='stbl');const stts=stbl&&boxes(stbl.p,stbl.end).find(x=>x.type==='stts');
      if(stts&&mdhd){let frames=0,ticks=0;const n=v.getUint32(stts.p+4);for(let i=0;i<n&&stts.p+16+i*8<=stts.end;i++){const count=v.getUint32(stts.p+8+i*8),delta=v.getUint32(stts.p+12+i*8);frames+=count;ticks+=count*delta;}const t=timing(mdhd.p);fps=ticks?frames*t.scale/ticks:0;}
    }
    if(duration>0&&width>0&&height>0)return {duration,width,height,fps};
  }
  throw Error('invalid_reference_media');
}
