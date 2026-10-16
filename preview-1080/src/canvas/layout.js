export const LAYOUT_KEY = 'hooper-canvas-layouts-v1';
export const SPECS = {
  scratchpad: {title:'随手记',width:440,height:560,minWidth:300,minHeight:280},
  note: {title:'便签',width:320,height:288,minWidth:240,minHeight:200},
  todo: {title:'待办',width:344,height:368,minWidth:280,minHeight:240},
  inbox: {title:'链接收集箱',width:384,height:368,minWidth:300,minHeight:240},
  image: {title:'图片',width:344,height:288,minWidth:220,minHeight:180},
  profile: {title:'个人名片',width:248,height:160,minWidth:220,minHeight:144},
  poetry: {title:'一句诗词',width:592,height:112,minWidth:300,minHeight:104},
  search: {title:'搜索',width:592,height:104,minWidth:320,minHeight:100},
  weather: {title:'南京天气',width:256,height:160,minWidth:220,minHeight:148},
  collection: {title:'网站集合',width:560,height:400,minWidth:280,minHeight:220},
  calendar: {title:'中国假日日历',width:344,height:556,minWidth:320,minHeight:460},
  site: {title:'网站入口',width:256,height:112,minWidth:220,minHeight:100},
};
export function widget(kind, id, x, y, source='', size={}) {
  return {id,type:'widget',position:{x,y},width:SPECS[kind].width,height:SPECS[kind].height,data:{kind,source},...size};
}
export function defaultNodes() {
  return [widget('profile','home-profile',0,0),widget('poetry','home-poetry',272,0),
    widget('search','home-search',272,136),widget('weather','home-weather',888,0),
    widget('collection','home-links',0,272,'all',{width:776,height:556}),
    widget('calendar','home-calendar',800,272)];
}
export function initialLayouts() {
  const saved={nodes:defaultNodes(),home:null};
  return {schema:1,active:'daily',schemes:[{id:'daily',name:'日常',locked:false,saved:structuredClone(saved),draft:{...structuredClone(saved),viewport:null}}]};
}
export function cleanNodes(nodes) {
  return nodes.map(n=>({id:n.id,type:'widget',position:{...n.position},width:n.width,height:n.height,data:{kind:n.data.kind,source:n.data.source||''}}));
}
const finite=value=>typeof value==='number'&&Number.isFinite(value);
function view(value) {
  if(value===null)return null;
  if(!value||!finite(value.x)||!finite(value.y)||!finite(value.zoom)||value.zoom<.25||value.zoom>2)throw Error('方案中的视野数据无效。');
  return {x:value.x,y:value.y,zoom:value.zoom};
}
function snapshot(value,draft=false) {
  if(!value||!Array.isArray(value.nodes)||value.nodes.length>500)throw Error('每个方案最多支持 500 个组件。');
  const ids=new Set();
  const nodes=value.nodes.map(n=>{
    const spec=SPECS[n?.data?.kind];
    if(!spec||typeof n.id!=='string'||!n.id||n.id.length>100||ids.has(n.id)||typeof n.data.source!=='string'||n.data.source.length>100||!finite(n.position?.x)||!finite(n.position?.y)||!finite(n.width)||!finite(n.height)||n.width<spec.minWidth||n.height<spec.minHeight||n.width>4000||n.height>4000)throw Error('方案中的组件数据无效。');
    ids.add(n.id);return cleanNodes([n])[0];
  });
  return {nodes,home:view(value.home),...(draft?{viewport:view(value.viewport)}:{})};
}
export function validateLayouts(value) {
  if(!value||value.schema!==1||!Array.isArray(value.schemes)||!value.schemes.length||value.schemes.length>32)throw Error('方案备份无效，最多支持 32 个方案。');
  const ids=new Set(),names=new Set();
  const schemes=value.schemes.map(s=>{
    if(typeof s.id!=='string'||!s.id||s.id.length>100||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>40||names.has(s.name.trim()))throw Error('方案名称或标识为空或重复。');
    ids.add(s.id);names.add(s.name.trim());
    if(s.locked!==undefined&&typeof s.locked!=='boolean')throw Error('方案锁定状态无效。');
    return {id:s.id,name:s.name.trim(),locked:s.locked===true,saved:snapshot(s.saved),draft:snapshot(s.draft,true)};
  });
  if(!ids.has(value.active))throw Error('当前方案不存在。');
  return {schema:1,active:value.active,schemes};
}
export const activeScheme = store => store.schemes.find(s=>s.id===store.active);
export const isAdjusted = scheme => JSON.stringify({nodes:scheme.draft.nodes,home:scheme.draft.home})!==JSON.stringify(scheme.saved);
export function resetNodes(nodes) {
  const defaults=defaultNodes(), used=new Set();
  const restored=defaults.map(n=>{
    const existing=nodes.find(x=>!used.has(x.id)&&x.data.kind===n.data.kind&&x.data.source===n.data.source);
    if(existing){used.add(existing.id);return {...n,id:existing.id}}return {...n,id:crypto.randomUUID()};
  });
  let y=860,rowHeight=0,x=0;
  for(const n of nodes.filter(n=>!used.has(n.id))){
    if(x&&x+n.width>1144){x=0;y+=rowHeight+24;rowHeight=0}
    restored.push({...n,position:{x,y}});x+=n.width+24;rowHeight=Math.max(rowHeight,n.height);
  }
  return restored;
}
