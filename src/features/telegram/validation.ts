import { ApiError } from '@/lib/api/errors';
import { uuid } from '@/features/processing/validation';
export const invalid=():never=>{throw new ApiError(400,'invalid_input','Invalid bot input.');};
export function integer(v:unknown,min=0,max=9007199254740991){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)return invalid();return v;}
export function short(v:unknown,max:number){if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x08\x0b-\x1f]/.test(v))return invalid();return v.trim();}
export function metadata(v:unknown):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v))return invalid();const d=v as Record<string,unknown>;const out:Record<string,unknown>={};
 const strings:Record<string,number>={title:250,original_title:250,description:5000,country:100,episode_title:250,episode_description:5000,release_date:10};
 for(const [k,value]of Object.entries(d)){
  if(value===null||value==='')continue;
  if(k in strings)out[k]=short(value,strings[k]);
  else if(['poster_url','banner_url'].includes(k)){const s=short(value,500);if(!/^https:\/\/image\.tmdb\.org\/t\/p\/(w500|w780|original)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(s))return invalid();out[k]=s;}
  else if(['existing_content_id','dubber_id'].includes(k))out[k]=uuid(value);
  else if(['tmdb_id','year','duration_minutes','season_number','episode_number'].includes(k))out[k]=integer(value,k==='year'?1888:1,k==='year'?2200:k==='tmdb_id'?2147483647:10080);
  else if(k==='is_premium'){if(typeof value!=='boolean')return invalid();out[k]=value;}
  else if(k==='genres'){if(!Array.isArray(value)||value.length>20)return invalid();out[k]=value.map(x=>short(x,80));}
  else return invalid();
 }
 return out;
}
export async function jsonBody(request:Request){
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return invalid();const reader=request.body?.getReader();if(!reader)return invalid();let n=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>16384){await reader.cancel();return invalid();}chunks.push(value);}}finally{reader.releaseLock();}
 try{const d=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!d||typeof d!=='object'||Array.isArray(d))return invalid();return d as Record<string,unknown>;}catch{return invalid();}
}
