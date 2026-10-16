import {useEffect,useRef,useState} from 'react';
import {emptyDocument,validateDocument} from './scratchpad-data.js';

export const CONTENT_KEY='hooper-canvas-content-v1';
export const CONTENT_KINDS=['scratchpad','note','todo','inbox','image'];
export const emptyContent=()=>({schema:1,items:[]});
export function linkUrl(value){
  const url=new URL(/^https?:\/\//i.test(value.trim())?value.trim():`https://${value.trim()}`);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.'))throw Error('请输入完整的 http 或 https 网址');
  return url.href;
}
export function newContent(kind){return {id:crypto.randomUUID(),kind,title:'',...(kind==='scratchpad'?{document:emptyDocument()}:kind==='note'?{text:'',tone:'paper'}:kind==='image'?{src:'',borderless:false}:{entries:[]})}}
const str=(v,max)=>typeof v==='string'&&v.length<=max;
export function validateContent(value){
  if(value?.schema!==1||!Array.isArray(value.items)||value.items.length>1000)throw Error('个人组件内容无效');
  const ids=new Set();
  const items=value.items.map(item=>{
    if(!item||!str(item.id,100)||!item.id||ids.has(item.id)||!CONTENT_KINDS.includes(item.kind)||!str(item.title,100))throw Error('个人组件记录无效');
    ids.add(item.id);const out={id:item.id,kind:item.kind,title:item.title};
    if(item.kind==='scratchpad')return {...out,document:validateDocument(item.document)};
    if(item.kind==='note'){
      if(!str(item.text,30000)||!['paper','blue','green','plain'].includes(item.tone))throw Error('便签内容无效');
      return {...out,text:item.text,tone:item.tone};
    }
    if(item.kind==='image'){
      if(!str(item.src,700000)||item.src&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item.src)||typeof item.borderless!=='boolean')throw Error('图片内容无效');
      return {...out,src:item.src,borderless:item.borderless};
    }
    if(!Array.isArray(item.entries)||item.entries.length>500)throw Error('每个组件最多保存 500 条记录');
    const entries=new Set();
    return {...out,entries:item.entries.map(e=>{
      if(!e||!str(e.id,100)||!e.id||entries.has(e.id)||!str(e.text,2000)||!e.text.trim())throw Error('列表内容无效');
      entries.add(e.id);
      if(item.kind==='todo'){if(typeof e.done!=='boolean')throw Error('待办状态无效');return {id:e.id,text:e.text,done:e.done}}
      if(!str(e.url,4000)||linkUrl(e.url)!==e.url)throw Error('链接无效');
      return {id:e.id,text:e.text,url:e.url};
    })};
  });
  const result={schema:1,items};if(JSON.stringify(result).length>3000000)throw Error('内容空间已满，请导出备份后减少图片大小');
  return result;
}
export default function useContent(){
  const [initial]=useState(()=>{try{const raw=localStorage.getItem(CONTENT_KEY);return {data:raw?validateContent(JSON.parse(raw)):emptyContent(),raw}}catch{return {data:emptyContent(),blocked:true}}});
  const [data,setData]=useState(initial.data),ref=useRef(initial.data),lastRaw=useRef(initial.raw),blocked=useRef(initial.blocked);
  const [error,setError]=useState(initial.blocked?'个人组件记录无法读取，原数据已保留，请先导出浏览器数据或恢复备份。':''),dirty=useRef(false);
  function adopt(next){ref.current=next;setData(next);lastRaw.current=localStorage.getItem(CONTENT_KEY);blocked.current=false;dirty.current=false;setError('')}
  function save(next){
    try{if(blocked.current)throw Error('原记录无法读取，请先恢复备份');if(localStorage.getItem(CONTENT_KEY)!==lastRaw.current)throw Error('另一标签页更新了内容，请先导出当前备份再刷新');const raw=JSON.stringify(validateContent(next));localStorage.setItem(CONTENT_KEY,raw);lastRaw.current=raw;dirty.current=false;setError('');return true}
    catch(e){dirty.current=true;setError(`内容未保存：${e.message}。请重试或导出备份。`);return false}
  }
  function change(mutator){const next=structuredClone(ref.current);mutator(next);try{validateContent(next)}catch(e){setError(e.message);return false}ref.current=next;setData(next);return save(next)}
  function create(kind,copy){const item=copy?{...structuredClone(copy),id:crypto.randomUUID()}:newContent(kind);return change(next=>{next.items.push(item)})?item.id:null}
  function update(id,mutator){return change(next=>{const item=next.items.find(x=>x.id===id);if(item)mutator(item)})}
  useEffect(()=>{const receive=e=>{if(e.key!==CONTENT_KEY)return;if(dirty.current){setError('另一标签页更新了内容，当前未保存的输入仍保留，请先导出备份。');return}try{if(!e.newValue)throw Error();adopt(validateContent(JSON.parse(e.newValue)))}catch{setError('另一标签页的内容无法读取，当前内容已保留。')}};const leave=e=>{if(dirty.current){e.preventDefault();e.returnValue=''}};window.addEventListener('storage',receive);window.addEventListener('beforeunload',leave);return()=>{window.removeEventListener('storage',receive);window.removeEventListener('beforeunload',leave)}},[]);
  return {data,ref,error,create,update,adopt,retry:()=>save(ref.current)};
}
export async function readImage(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('请选择 5 MB 以内的 PNG、JPG 或 WebP 图片');
  const bitmap=await createImageBitmap(file);
  try{const ratio=Math.min(1,1400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const src=canvas.toDataURL('image/webp',.82);if(src.length>700000)throw Error('图片细节较多，请缩小后再上传');return src}finally{bitmap.close()}
}
