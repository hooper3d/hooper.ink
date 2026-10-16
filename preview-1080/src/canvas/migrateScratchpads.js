import {CONTENT_KEY,validateContent} from './content.js';
import {LAYOUT_KEY,validateLayouts,widget} from './layout.js';
import {LEGACY_KINDS,legacyDocument} from './scratchpad-data.js';

export function mergeScratchpads(layouts,content){
  const nextLayouts=structuredClone(layouts),nextContent=structuredClone(content),groups=new Map();
  let changed=false;
  for(const scheme of nextLayouts.schemes)for(const snapshot of [scheme.draft,scheme.saved]){
    const old=snapshot.nodes.filter(n=>LEGACY_KINDS.includes(n.data.kind));
    if(!old.length)continue;
    const sources=[...new Set(old.map(n=>n.data.source))],key=[...sources].sort().join('|');
    let source=groups.get(key);
    if(!source){
      const originals=sources.map(id=>content.items.find(item=>item.id===id));
      if(originals.some(item=>!item))throw Error('旧组件内容缺失，暂未合并');
      source=crypto.randomUUID();
      nextContent.items.push({id:source,kind:'scratchpad',title:'',document:legacyDocument(originals)});groups.set(key,source);
    }
    const anchor=old.find(n=>n.data.kind==='note')||old[0];
    const merged=widget('scratchpad',anchor.id,anchor.position.x,anchor.position.y,source);
    snapshot.nodes=snapshot.nodes.flatMap(n=>n.id===anchor.id?[merged]:LEGACY_KINDS.includes(n.data.kind)?[]:[n]);
    changed=true;
  }
  return {layouts:validateLayouts(nextLayouts),content:validateContent(nextContent),changed};
}

export function migrateStoredScratchpads(){
  let beforeContent,beforeLayouts,wrote=false;
  try{
    beforeLayouts=localStorage.getItem(LAYOUT_KEY);beforeContent=localStorage.getItem(CONTENT_KEY);
    if(!beforeLayouts||!beforeContent)return '';
    const result=mergeScratchpads(validateLayouts(JSON.parse(beforeLayouts)),validateContent(JSON.parse(beforeContent)));
    if(!result.changed)return '';
    const backupKey='hooper-canvas-before-scratchpad-v1';
    if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,JSON.stringify({layouts:JSON.parse(beforeLayouts),content:JSON.parse(beforeContent)}));
    localStorage.setItem(CONTENT_KEY,JSON.stringify(result.content));wrote=true;
    localStorage.setItem(LAYOUT_KEY,JSON.stringify(result.layouts));return '';
  }catch(e){
    if(wrote){localStorage.setItem(CONTENT_KEY,beforeContent);localStorage.setItem(LAYOUT_KEY,beforeLayouts)}
    return `随手记暂未合并：${e.message}。原组件和内容仍保留。`;
  }
}
