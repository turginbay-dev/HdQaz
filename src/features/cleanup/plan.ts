export type Asset = {id:string;kind:'r2'|'image'|'local'|'blocked';path:string;shared?:boolean};
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type Snapshot={content:{id:string;slug:string;title:string;hls_url?:string;poster_url?:string;banner_url?:string};jobs:{id:string;output_manifest_url?:string}[];episodes:{hls_url?:string;thumbnail_url?:string}[];flows:{id:string;source_ref?:string;metadata?:{poster_url?:string;banner_url?:string}}[];references:{owner:string|null;url?:string;source_ref?:string}[]};
export function cleanupPlan(s:Snapshot,origins:string[],storageOrigin:string):Asset[]{
 if(!id.test(s.content.id)||s.jobs.some(j=>!id.test(j.id))||s.flows.some(f=>!id.test(f.id)))throw Error('Invalid cleanup snapshot');
 const assets:Asset[]=[];const seen=new Set<string>();
 const other=s.references.filter(r=>r.owner!==s.content.id);
 function add(kind:Asset['kind'],path:string,shared=false){const key=kind+':'+path;if(!seen.has(key)){seen.add(key);assets.push({id:key,kind,path,...(shared?{shared:true}:{})});}}
 function location(raw:string|undefined){if(!raw)return null;try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||/%|\\|\/\//.test(u.pathname))return null;return u;}catch{return null;}}
 function referenced(prefix:string){return other.some(r=>{if(!r.url)return false;try{const u=new URL(r.url);return decodeURIComponent(u.pathname).startsWith(new URL(prefix).pathname);}catch{return true;}});}
 // Job namespaces are unambiguous even for abandoned/failed attempts with no saved manifest.
 for(const j of s.jobs){const prefix='candidates/'+j.id+'-';add('r2',prefix,origins.some(o=>referenced(o+'/'+prefix)));add('local','job/'+j.id);}
 const manifests=[s.content.hls_url,...s.episodes.map(e=>e.hls_url),...s.jobs.map(j=>j.output_manifest_url)].filter(Boolean) as string[];
 for(const raw of manifests){const u=location(raw);if(!u||!origins.includes(u.origin)){add('blocked','HLS ownership cannot be verified');continue;}
  const path=u.pathname.slice(1);if(s.jobs.some(j=>path.startsWith('candidates/'+j.id+'-')))continue;
  const roots=['movies/','series/','contents/','final/','final/movies/','final/series/'].map(p=>p+s.content.id+'/');const prefix=roots.find(p=>path.startsWith(p));
  if(!prefix){add('blocked',u.origin+u.pathname);continue;}add('r2',prefix,referenced(u.origin+'/'+prefix));
 }
 // Only this project's owned image folders; external/shared media is retained.
 for(const kind of ['posters','banners']){const prefix=kind+'/'+s.content.id+'/';add('image',prefix,referenced(storageOrigin+'/storage/v1/object/public/content-media/'+prefix));}
 for(const f of s.flows){add('local','workflow/'+f.id);for(const kind of ['posters','banners']){const prefix=kind+'/drafts/'+f.id+'/';add('image',prefix,referenced(storageOrigin+'/storage/v1/object/public/content-media/'+prefix));}
  if(f.source_ref&&id.test(f.source_ref))add('local','source/'+f.source_ref,other.some(r=>r.source_ref===f.source_ref));}
 for(const raw of [s.content.poster_url,s.content.banner_url,...s.episodes.map(e=>e.thumbnail_url),...s.flows.flatMap(f=>[f.metadata?.poster_url,f.metadata?.banner_url])]){
  const u=location(raw);if(!u||u.origin!==storageOrigin)continue;
  const path=u.pathname.split('/storage/v1/object/public/content-media/')[1];if(!path)continue;
  // A Supabase image from another owner's folder must not be removed.
  if(!assets.some(a=>a.kind==='image'&&path.startsWith(a.path)))add('blocked','External image retained',true);
 }
 return assets;
}
export type Result={id:string;state:'done'|'shared'|'error';error?:string};
export function validResults(plan:Asset[],value:unknown):value is Result[]{return Array.isArray(value)&&value.length===plan.length&&new Set(value.map(r=>r?.id)).size===plan.length&&value.every(r=>r&&plan.some(a=>a.id===r.id)&&['done','shared','error'].includes(r.state)&&(!r.error||['storage_unavailable','local_busy','unsafe_path','unverified_ownership','executor_interrupted'].includes(r.error))&&!(r.state==='shared'&&!plan.find(a=>a.id===r.id)?.shared)&&!(r.state==='done'&&plan.find(a=>a.id===r.id)?.kind==='blocked'));}
