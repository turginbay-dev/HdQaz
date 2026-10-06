const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./ts-loader.cjs')();
const { resumableSeconds } = load('src/lib/watch-progress.ts');
const { movieMatchesSearch, movieSearchRank, normalizeSearchValue } = load('src/features/movies/search.ts');
const movie = {title:'Интерстеллар', originalTitle:'Interstellar', description:'', slug:'interstellar', type:'movie', year:2014, runtime:'', rating:'', badges:[], genres:[], catalogs:[], languages:[]};
test('search exact, partial, Latin, year, punctuation, Cyrillic and typo', () => {
  for (const q of ['Интерстеллар','ИНТЕР',' Interstellar ','интерстелар','2014','Интерстеллар!']) assert.equal(movieMatchesSearch(movie,q),true,q);
  assert.equal(movieMatchesSearch(movie,'zzzzqqq'),false);
  assert.ok(movieSearchRank(movie,'интер') < movieSearchRank({...movie,title:'Жұлдыз Интер', originalTitle:''},'интер'));
  assert.equal(normalizeSearchValue('  ҚАЗАҚ—Ёлка  '),'қазақ елка');
});
test('episode/season/movie progress keys remain independent', () => {
  const store = new Map([['watch-progress:episode:s1-e1',JSON.stringify({seconds:3000,completed:false})],['watch-progress:episode:s1-e2',JSON.stringify({seconds:720,completed:false})],['watch-progress:movie:a',JSON.stringify({seconds:2400,completed:false})]]);
  for(const [key,seconds] of [['episode:s1-e1',3000],['episode:s1-e2',720],['episode:s2-e1',0],['episode:s1-e3',0],['movie:a',2400],['movie:b',0]]) assert.equal(resumableSeconds(store.get('watch-progress:'+key)??null,4000),seconds);
});
test('completed, start-over, too-short and malformed progress never resumes', () => {
  for(const raw of ['null','{}','bad','{"seconds":"50","completed":false}',JSON.stringify({seconds:3600,completed:false}),JSON.stringify({seconds:1200,completed:true}),JSON.stringify({seconds:0,completed:false}),JSON.stringify({seconds:29,completed:false})]) assert.equal(resumableSeconds(raw,4000),0,raw);
  assert.equal(resumableSeconds(null,4000,3000),3000);
});
function playerHarness() {
  const fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript');
  const effects=[],changes=[],timers=[],requests=[],store=new Map(),handlers={};
  const video={currentTime:0,duration:4000,paused:true,readyState:4,buffered:{length:0},removeAttribute(){},load(){},play(){this.paused=false;return Promise.resolve()},canPlayType(){return ''}};
  let refs=0;
  const react={useRef(value){refs++;return {current:refs===5?video:value}},useState(value){return [value,next=>changes.push(next)]},useEffect(fn){effects.push(fn)}};
  class HlsMock {static isSupported(){return true} static Events={MEDIA_ATTACHED:'attached',MANIFEST_PARSED:'parsed',LEVEL_SWITCHED:'level',ERROR:'error'}; static ErrorTypes={NETWORK_ERROR:'network',MEDIA_ERROR:'media'}; levels=[];startLoad(){this.starts=(this.starts||0)+1} stopLoad(){} recoverMediaError(){} on(event,fn){handlers[event]=fn} off(){} loadSource(){} attachMedia(){} destroy(){}}
  const code=ts.transpileModule(fs.readFileSync('src/components/player/hls-player.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
  const exports={};
  vm.runInNewContext(code,{exports,console:{info(){},error(){}},window:{setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){}},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},navigator:{},fetch:(...args)=>{requests.push(args);return Promise.resolve({})},require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};if(name==='hls.js')return {default:HlsMock};if(name==='@/lib/watch-progress')return {resumableSeconds};if(name==='@/lib/cn')return {cn:(...args)=>args.filter(Boolean).join(' ')};if(name==='@/lib/movie-taxonomy')return {formatMovieLanguages:()=>''};return new Proxy({},{get:()=>()=>null})}});
  const tree=exports.HlsPlayer({progressKey:'watch-progress:episode:one',src:'https://cdn.hdqaz.online/test/master.m3u8',poster:'',languages:[]});
  function find(node,type){if(!node)return null;if(Array.isArray(node)){for(const x of node){const f=find(x,type);if(f)return f}return null}if(node.type===type)return node;return find(node.props?.children,type)}
  effects[0]();
  return {handlers,changes,timers,video,store,requests,props:find(tree,'video').props};
}
test('player delays failure, bounds recovery and exposes friendly error',()=>{
 const h=playerHarness();
 assert.equal(h.changes.filter(x=>typeof x==='string').length,0);
 h.handlers.error('error',{fatal:true,type:'network',details:'403'});
 h.handlers.error('error',{fatal:true,type:'network',details:'403'});
 assert.equal(h.changes.filter(x=>typeof x==='string').length,0);
 h.handlers.error('error',{fatal:true,type:'network',details:'403'});
 assert.equal(h.changes.filter(x=>typeof x==='string').at(-1),'Видео әзірге қолжетімсіз. Біраздан кейін қайта көріңіз.');
});
test('player saves seeked episode position locally without root-series API write',()=>{
 const h=playerHarness();h.props.onLoadedMetadata();h.video.currentTime=600;h.props.onSeeked();
 assert.equal(JSON.parse(h.store.get('watch-progress:episode:one')).seconds,600);
 assert.equal(h.requests.length,0);
 h.video.currentTime=3700;h.props.onTimeUpdate();
 assert.equal(JSON.parse(h.store.get('watch-progress:episode:one')).completed,true);
});
