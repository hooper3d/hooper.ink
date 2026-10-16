export const LEGACY_KINDS=['note','todo','inbox','image'];
export const emptyDocument=()=>({type:'doc',content:[{type:'paragraph'}]});
export function safeLink(value){
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password}catch{return false}
}
export function validateDocument(doc){
  let count=0,textLength=0;
  const types=['doc','paragraph','text','hardBreak','heading','bulletList','orderedList','listItem','taskList','taskItem','blockquote','codeBlock','horizontalRule','image'];
  function visit(n,depth=0){
    if(!n||!types.includes(n.type)||++count>5000||depth>16)throw Error('随手记内容无效或过长');
    const out={type:n.type};
    if(n.type==='text'){
      if(typeof n.text!=='string'||!n.text)throw Error('随手记文字无效');
      textLength+=n.text.length;if(textLength>100000)throw Error('随手记文字最多 10 万字');out.text=n.text;
    }
    if(n.type==='image'){
      const src=n.attrs?.src;
      if(typeof src!=='string'||src.length>700000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src))throw Error('图片需使用本地上传或粘贴');
      out.attrs={src,alt:typeof n.attrs.alt==='string'?n.attrs.alt.slice(0,100):null,title:null};
    }
    if(n.type==='taskItem'){if(typeof n.attrs?.checked!=='boolean')throw Error('待办状态无效');out.attrs={checked:n.attrs.checked}}
    if(n.type==='heading'){if(![1,2,3].includes(n.attrs?.level))throw Error('标题级别无效');out.attrs={level:n.attrs.level}}
    if(n.type==='orderedList')out.attrs={start:Number.isInteger(n.attrs?.start)&&n.attrs.start>0?n.attrs.start:1};
    if(n.type==='codeBlock')out.attrs={language:null};
    if(n.marks){
      if(!Array.isArray(n.marks)||n.marks.length>8)throw Error('文字格式无效');
      out.marks=n.marks.map(m=>{
        if(!['bold','italic','strike','code','underline','link'].includes(m.type))throw Error('文字格式无效');
        if(m.type!=='link')return {type:m.type};
        if(typeof m.attrs?.href!=='string'||m.attrs.href.length>4000||!safeLink(m.attrs.href))throw Error('链接需使用 http 或 https');
        return {type:'link',attrs:{href:m.attrs.href,target:'_blank',rel:'noopener noreferrer',class:null}};
      });
    }
    if(n.content!==undefined){
      if(!Array.isArray(n.content))throw Error('随手记内容无效');
      const blocks=['paragraph','heading','bulletList','orderedList','taskList','blockquote','codeBlock','horizontalRule','image'];
      const allowed=n.type==='doc'||n.type==='blockquote'||['listItem','taskItem'].includes(n.type)?blocks:n.type==='taskList'?['taskItem']:['bulletList','orderedList'].includes(n.type)?['listItem']:n.type==='codeBlock'?['text']:['paragraph','heading'].includes(n.type)?['text','hardBreak']:[];
      if(n.content.some(child=>!allowed.includes(child?.type)))throw Error('随手记结构无效');
      if(['listItem','taskItem'].includes(n.type)&&n.content[0]?.type!=='paragraph')throw Error('列表结构无效');
      out.content=n.content.map(c=>visit(c,depth+1));
    }
    if(['doc','bulletList','orderedList','taskList','listItem','taskItem','blockquote'].includes(n.type)&&!out.content?.length)throw Error('随手记结构无效');
    return out;
  }
  if(doc?.type!=='doc')throw Error('随手记文档无效');
  const out=visit(doc);if(JSON.stringify(out).length>2000000)throw Error('这份随手记过大，请减少图片');return out;
}
const paragraph=(text,marks)=>({type:'paragraph',...(text?{content:[{type:'text',text,...(marks?{marks}:{})}]}:{})});
export function legacyDocument(items){
  const content=[];
  for(const item of items){
    if(item.kind!=='image'&&item.title)content.push(paragraph(item.title,[{type:'bold'}]));
    if(item.kind==='note')content.push(...item.text.split('\n').map(line=>paragraph(line)));
    if(item.kind==='todo'&&item.entries.length)content.push({type:'taskList',content:item.entries.map(e=>({type:'taskItem',attrs:{checked:e.done},content:[paragraph(e.text)]}))});
    if(item.kind==='inbox')for(const e of item.entries)content.push(paragraph(e.text,[{type:'link',attrs:{href:e.url}}]));
    if(item.kind==='image'&&item.src)content.push({type:'image',attrs:{src:item.src,alt:item.title||'图片'}});
  }
  content.push(paragraph(''));
  return validateDocument({type:'doc',content});
}
