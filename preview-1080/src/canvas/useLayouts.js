import {useEffect,useRef,useState} from 'react';
import {App} from 'antd';
import {applyNodeChanges} from '@xyflow/react';
import {LAYOUT_KEY,activeScheme,cleanNodes,initialLayouts,validateLayouts} from './layout';

export default function useLayouts(){
  const {message}=App.useApp();
  const [initial]=useState(()=>{let raw=null;try{raw=localStorage.getItem(LAYOUT_KEY);return {store:raw?validateLayouts(JSON.parse(raw)):initialLayouts(),raw}}catch{return {store:initialLayouts(),raw,error:true}}});
  const [store,setStore]=useState(initial.store),storeRef=useRef(initial.store);
  const [nodes,setNodes]=useState(activeScheme(initial.store).draft.nodes),nodesRef=useRef(nodes);
  const [saveError,setSaveError]=useState(initial.error?'方案记录未能读取，原记录仍保留在浏览器。':''),[gestureActive,setGestureActive]=useState(false);
  const [historyVersion,setHistoryVersion]=useState(0),past=useRef([]),future=useRef([]),gesture=useRef(false);
  const lastRaw=useRef(initial.raw),unreadable=useRef(initial.error?initial.raw:null);
  function install(next){storeRef.current=next;setStore(next);const selected=new Set(nodesRef.current.filter(n=>n.selected).map(n=>n.id));nodesRef.current=activeScheme(next).draft.nodes.map(n=>({...n,selected:selected.has(n.id)}));setNodes(nodesRef.current)}
  function commit(mutator,history=true){
    const before=storeRef.current,copy=structuredClone(before);
    try{
      const raw=localStorage.getItem(LAYOUT_KEY);
      if(raw!==lastRaw.current)throw Error('另一标签页已更新方案，请刷新后继续。');
      const next=validateLayouts(mutator(copy)||copy),serialized=JSON.stringify(next);
      if(unreadable.current!==null){localStorage.setItem(`${LAYOUT_KEY}-recovery`,unreadable.current);unreadable.current=null}
      localStorage.setItem(LAYOUT_KEY,serialized);lastRaw.current=serialized;
      if(history){past.current=[...past.current.slice(-29),before];future.current=[];setHistoryVersion(v=>v+1)}install(next);setSaveError('');return true;
    }catch(e){const text=`未能保存方案：${e.message}`;setSaveError(text);message.error(text);return false}
  }
  function updateDraft(mutator,history=true){return commit(next=>mutator(activeScheme(next).draft),history)}
  function commitNodes(){const value=cleanNodes(nodesRef.current);if(JSON.stringify(value)!==JSON.stringify(activeScheme(storeRef.current).draft.nodes)){if(!updateDraft(draft=>{draft.nodes=value}))install(storeRef.current)}}
  function beginGesture(){gesture.current=true;setGestureActive(true)}
  function endGesture(){setTimeout(()=>{commitNodes();gesture.current=false;setGestureActive(false)},0)}
  function onNodesChange(changes){
    nodesRef.current=applyNodeChanges(changes,nodesRef.current);setNodes(nodesRef.current);
    if(!gesture.current&&changes.some(c=>c.type==='position'&&c.dragging!==true))commitNodes();
  }
  function travel(direction){const from=direction==='undo'?past:future,to=direction==='undo'?future:past;if(!from.current.length)return;const target=from.current.at(-1),current=storeRef.current;if(commit(()=>target,false)){from.current.pop();to.current.push(current);setHistoryVersion(v=>v+1)}}
  function replace(next){return commit(()=>next)}
  useEffect(()=>{const receive=e=>{if(e.key!==LAYOUT_KEY||!e.newValue||gesture.current)return;try{const next=validateLayouts(JSON.parse(e.newValue));lastRaw.current=e.newValue;past.current=[];future.current=[];install(next);setHistoryVersion(v=>v+1);setSaveError('')}catch{setSaveError('另一标签页的方案无法读取，当前布局已保留。')}};window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive)},[]);
  return {store,storeRef,nodes,nodesRef,scheme:activeScheme(store),saveError,commit,updateDraft,beginGesture,endGesture,onNodesChange,gestureActive,replace,undo:()=>travel('undo'),redo:()=>travel('redo'),canUndo:past.current.length>0,canRedo:future.current.length>0,historyVersion};
}
