const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./ts-loader.cjs');
const parse=loader()('src/features/content/validation.ts').parseContentInput;
const input={title:'Draft',slug:'draft',type:'movie',status:'announced',year:2026,genreIds:[],isPublished:false};
test('unpublished movie metadata needs neither season, media nor HLS',()=>{const r=parse({...input,seasonNumber:''});assert.equal(r.errors,null);assert.equal(r.data.hlsUrl,null);});
test('published movie still requires a manifest',()=>assert.ok(parse({...input,isPublished:true}).errors.hlsUrl));
test('series root metadata does not require a season',()=>assert.equal(parse({...input,type:'series'}).errors,null));
test('metadata update preserves processing kind under classified section',async()=>{
 const row={id:'id',title:'Draft',slug:'draft',type:'movie',section:'anime',description:'',poster_url:'',banner_url:'',country:'',year:2026,status:'announced',is_published:false};let written;
 const db={};
 db.from=table=>{let one=false;const q={then(resolve){return resolve({data:table==='contents'?(one?row:[row]):[],error:null});}};for(const name of ['select','eq','in','order','delete','insert'])q[name]=()=>q;q.maybeSingle=()=>{one=true;return q;};q.update=data=>{written=data;Object.assign(row,data);return q;};return q;};
 const repo=loader({'@/lib/supabase/admin':{getOptionalAdminClient:()=>db}})('src/features/content/repository.ts');
 await repo.updateContent('draft',{...parse({...input,type:'anime'}).data});assert.equal(written.type,'movie');assert.equal(row.section,'anime');assert.equal(row.is_published,false);
});
test('season relation accepts number and numeric text, rejects empty/fraction/zero',async()=>{
 const route=loader({'@/lib/api/auth':{requireAdmin:async()=>{}},'@/features/content/repository':{createSeason:async(slug,number)=>({slug,seasonNumber:number})}})('src/app/api/contents/[slug]/seasons/route.ts');
 for(const value of [1,2,3,'1','2']){const response=await route.POST(new Request('https://hdqaz.online/api',{method:'POST',body:JSON.stringify({seasonNumber:value})}),{params:Promise.resolve({slug:'series'})});assert.equal(response.status,201);assert.equal((await response.json()).data.seasonNumber,Number(value));}
 for(const value of ['',0,-1,1.5,'1.5']){const response=await route.POST(new Request('https://hdqaz.online/api',{method:'POST',body:JSON.stringify({seasonNumber:value})}),{params:Promise.resolve({slug:'series'})});assert.equal(response.status,400);}
});
test('kind and section accept all six classifications without root season',()=>{for(const kind of ['movie','series'])for(const section of ['default','anime','dorama']){const r=parse({...input,type:section,kind,section});assert.equal(r.errors,null);assert.equal(r.data.type,kind);assert.equal(r.data.section,section);assert.equal(Object.hasOwn(r.data,'seasonNumber'),false);}});
test('explicit movie classification still requires HLS when publishing; invalid classification rejected',()=>{assert.ok(parse({...input,kind:'movie',section:'anime',isPublished:true}).errors.hlsUrl);assert.ok(parse({...input,kind:'evil'}).errors.kind);assert.ok(parse({...input,kind:'movie',section:'evil'}).errors.section);});
test('classified feature does not become episodic with an empty draft HLS',()=>{const {isEpisodicContent}=loader()('src/features/content/format.ts');assert.equal(isEpisodicContent({type:'dorama',storageType:'movie'}),false);assert.equal(isEpisodicContent({type:'anime',storageType:'series'}),true);});
test('existing production underscore slugs remain editable',()=>assert.equal(parse({...input,slug:'korkem_sozder_bagy'}).errors,null));
