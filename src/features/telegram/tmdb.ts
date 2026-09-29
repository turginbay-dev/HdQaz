import 'server-only';
import { ApiError } from '@/lib/api/errors';
const genres:Record<number,string>={28:'Экшн',12:'Шытырман',16:'Анимация',35:'Комедия',18:'Драма',10751:'Отбасы',14:'Фантастика',27:'Қорқынышты',10749:'Романтика',878:'Фантастика',10759:'Шытырман',10765:'Фантастика'};
const fail=()=>new ApiError(502,'metadata_unavailable','Metadata temporarily unavailable.');
const text=(v:unknown,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';
export function tmdbMap(raw:unknown,kind:'movie'|'series') {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw fail();
 const d=raw as Record<string,unknown>;
 if(!Number.isSafeInteger(d.id)||Number(d.id)<=0)throw fail();
 const image=(v:unknown)=>typeof v==='string'&&/^\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(v)?'https://image.tmdb.org/t/p/w780'+v:'';
 const date=text(d[kind==='movie'?'release_date':'first_air_date'],10);
 const year=/^\d{4}-\d{2}-\d{2}$/.test(date)?Number(date.slice(0,4)):null;
 const title=text(d[kind==='movie'?'title':'name'],250)||text(d[kind==='movie'?'original_title':'original_name'],250);
 if(!title)throw fail();
 const countries=Array.isArray(d.production_countries)?d.production_countries.flatMap(x=>x&&typeof x==='object'?[text(x.iso_3166_1,2)]:[]):Array.isArray(d.origin_country)?d.origin_country.map(x=>text(x,2)):[];
 return {tmdb_id:Number(d.id),title,original_title:text(d[kind==='movie'?'original_title':'original_name'],250),description:text(d.overview,5000),year:year&&year>=1888&&year<=2200?year:null,release_date:date,
 poster_url:image(d.poster_path),banner_url:image(d.backdrop_path),country:countries.filter(x=>/^[A-Z]{2}$/.test(x)).slice(0,10).join(', '),
 genres:Array.isArray(d.genres)?d.genres.flatMap(x=>x&&typeof x==='object'&&typeof x.name==='string'?[genres[Number(x.id)]||text(x.name,80)]:[]).slice(0,20):[],
 duration_minutes:kind==='movie'&&Number.isInteger(d.runtime)&&Number(d.runtime)>0&&Number(d.runtime)<=10080?Number(d.runtime):null};
}
async function get(path:string,params:Record<string,string>) {
 const token=process.env.TMDB_ACCESS_TOKEN;if(!token)throw new ApiError(503,'configuration','Metadata unavailable.');
 try{
  const r=await fetch('https://api.themoviedb.org/3/'+path+'?'+new URLSearchParams(params),{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!r.ok)throw fail();
  const reader=r.body?.getReader();if(!reader)throw fail();let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024){await reader.cancel();throw fail();}chunks.push(value);}}finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch{throw fail();}
}
export async function tmdbSearch(kind:'movie'|'series',query:string){
 const media=kind==='movie'?'movie':'tv';const d=await get('search/'+media,{query,language:'kk-KZ',include_adult:'false'});
 if(!Array.isArray(d.results))throw fail();
 return d.results.filter((r:Record<string,unknown>)=>r.adult!==true).slice(0,6).flatMap((r:unknown)=>{try{return[tmdbMap(r,kind)];}catch{return[];}});
}
export async function tmdbDetails(kind:'movie'|'series',id:number){
 const media=kind==='movie'?'movie':'tv';const kk=tmdbMap(await get(media+'/'+id,{language:'kk-KZ'}),kind);
 if(!kk.description){const fallback=tmdbMap(await get(media+'/'+id,{language:'en-US'}),kind);return {...fallback,...kk,description:kk.description||fallback.description};}
 return kk;
}
