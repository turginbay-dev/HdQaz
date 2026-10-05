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
