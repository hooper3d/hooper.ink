import {useEffect,useRef,useState} from 'react';
import {App,Button,Space} from 'antd';
import {KEY,defaults,validateData} from '../model';
import useWeather from './weather';

const poems=[['行到水穷处，坐看云起时。','唐 · 王维《终南别业》'],['且将新火试新茶。诗酒趁年华。','宋 · 苏轼《望江南·超然台作》'],['山气日夕佳，飞鸟相与还。','晋 · 陶渊明《饮酒·其五》']];
const engines={google:'https://www.google.com/search?q=',bing:'https://www.bing.com/search?q=',baidu:'https://www.baidu.com/s?wd=',github:'https://github.com/search?q='};
export default function useNavigation(){
  const {message}=App.useApp();
  const [initial]=useState(()=>{try{const raw=localStorage.getItem(KEY);return {db:raw?validateData(JSON.parse(raw)):structuredClone(defaults)}}catch{return {db:structuredClone(defaults),error:true}}});
  const [db,setDb]=useState(initial.db),dbRef=useRef(initial.db);
  const [managerOpen,setManagerOpen]=useState(false),[manageTab,setManageTab]=useState('links');
  const [query,setQuery]=useState(''),[mode,setMode]=useState('local'),[engine,setEngine]=useState('google');
  const [quickSearch,setQuickSearch]=useState(false),[poem,setPoem]=useState(poems[0]),poemIndex=useRef(0);
  const weatherState=useWeather();
  function change(mutator,onError){
    try{const copy=structuredClone(dbRef.current),next=validateData(mutator(copy)||copy);localStorage.setItem(KEY,JSON.stringify(next));dbRef.current=next;setDb(next);message.destroy('content-undo');return true}catch(e){if(onError)onError(e);else message.error(`未能保存：${e.message}`);return false}
  }
  function adopt(next){dbRef.current=next;setDb(next)}
  function undo(text,before){message.open({key:'content-undo',type:'success',duration:10,content:<Space>{text}<Button size="small" type="link" onClick={()=>change(()=>before)}>撤销</Button></Space>})}
  function toggleFavorite(id){change(next=>{next.favorites=next.favorites.includes(id)?next.favorites.filter(x=>x!==id):[...next.favorites,id]})}
  function openManager(tab='links'){setManageTab(tab);setManagerOpen(true)}
  function loadPoem(){const fallback=()=>{poemIndex.current=(poemIndex.current+1)%poems.length;setPoem(poems[poemIndex.current])};if(window.jinrishici)window.jinrishici.load(r=>{if(r.status==='success')setPoem([r.data.content,`${r.data.origin.dynasty} · ${r.data.origin.author}《${r.data.origin.title}》`]);else fallback()},fallback);else fallback()}
  function search(e){e.preventDefault();const q=query.trim();if(!q)return;const shortcuts={'!g':engines.google,'!b':engines.bing,'!bd':engines.baidu,'!gh':engines.github,'!d':'https://duckduckgo.com/?q=','!y':'https://www.youtube.com/results?search_query=','!tb':'https://s.taobao.com/search?q=','!zh':'https://www.zhihu.com/search?type=content&q='};const [prefix,...words]=q.split(/\s+/);if(shortcuts[prefix]&&words.length)window.open(shortcuts[prefix]+encodeURIComponent(words.join(' ')),'_blank','noopener');else if(mode==='web')window.open(engines[engine]+encodeURIComponent(q),'_blank','noopener');else setQuickSearch(true)}
  useEffect(()=>{if(initial.error)message.warning('导航记录未能读取，当前展示默认内容；原记录未覆盖。');const script=document.createElement('script');script.src='https://sdk.jinrishici.com/v2/browser/jinrishici.js';script.async=true;script.onload=loadPoem;document.head.append(script);return()=>{script.onload=null;script.remove()}},[]);
  useEffect(()=>{document.querySelector('link[rel="icon"]').href=db.avatar||'assets/avatar.png'},[db.avatar]);
  useEffect(()=>{const onStorage=e=>{if(e.key===KEY&&e.newValue)try{adopt(validateData(JSON.parse(e.newValue)))}catch{message.warning('另一标签页的导航数据无法读取。')}};window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage)},[]);
  return {db,change,adopt,undo,toggleFavorite,openManager,managerOpen,setManagerOpen,manageTab,setManageTab,query,setQuery,mode,setMode,engine,setEngine,search,quickSearch,setQuickSearch,poem,loadPoem,...weatherState};
}
