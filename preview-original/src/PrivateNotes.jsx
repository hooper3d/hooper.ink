import {cloneElement,useEffect,useRef,useState} from 'react';
import {EditorContent,NodeViewWrapper,ReactNodeViewRenderer,useEditor,useEditorState} from '@tiptap/react';
import {Node,mergeAttributes} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {Image,Modal,Popover,Tooltip} from 'antd';
import model from '../notes-model.cjs';
const {safeLink,validateNote,imagePath}=model;
const icon=name=><i className={`fas fa-${name}`} aria-hidden="true"/>;
async function request(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',...options});
  const data=await response.json();
  if(!response.ok)throw Object.assign(Error(data.error||'暂时无法保存'),{status:response.status});
  return data;
}
function Attachment({node,deleteNode}){
  const {src,alt,size}=node.attrs;
  return <NodeViewWrapper className="note-attachment" contentEditable={false}>
    <Image width={36} height={36} src={src} alt={alt} preview={{mask:false}} draggable={false}/>
    <div><strong title={alt}>{alt}</strong><small>{Math.max(1,Math.ceil(size/1024))} KB</small></div>
    <Tooltip title="保存图片"><a className="icon-button" href={src} download={alt} aria-label={`保存图片 ${alt}`}>{icon('download')}</a></Tooltip>
    <Tooltip title="移除 · 可撤销"><button className="icon-button" aria-label={`移除图片 ${alt}`} onClick={deleteNode}>{icon('xmark')}</button></Tooltip>
  </NodeViewWrapper>;
}
const NoteImage=Node.create({name:'noteImage',group:'block',atom:true,draggable:true,
  addAttributes(){return {src:{default:''},alt:{default:'图片'},size:{default:0}}},
  parseHTML(){return [{tag:'img[data-note-image]',getAttrs:element=>imagePath.test(element.getAttribute('src')||'')?null:false}]},
  renderHTML({HTMLAttributes}){return ['img',mergeAttributes(HTMLAttributes,{'data-note-image':''})]},
  addNodeView(){return ReactNodeViewRenderer(Attachment)}
});
function NotesEditor({data,session,onSessionChange,onDirtyChange,onReload,open}){
  const [status,setStatus]=useState('saved'),[error,setError]=useState(''),[uploads,setUploads]=useState(0),[link,setLink]=useState(null);
  const [modal,modalContext]=Modal.useModal();
  const revision=useRef(data.revision),saved=useRef(JSON.stringify(validateNote(data.document))),pending=useRef(saved.current),saving=useRef(false),blocked=useRef(false),dirty=useRef(false),timer=useRef(null),mounted=useRef(true),controller=useRef(new AbortController()),input=useRef(null),selection=useRef(null),uploading=useRef(0);
  const editor=useEditor({extensions:[StarterKit.configure({heading:{levels:[1,2,3]},link:{openOnClick:false,isAllowedUri:safeLink,HTMLAttributes:{rel:'noopener noreferrer',referrerpolicy:'no-referrer'}}}),TaskList,TaskItem.configure({nested:false,a11y:{checkboxLabel:node=>`待办：${node.textContent||'未命名'}`}}),NoteImage,Placeholder.configure({placeholder:'随手记点什么…'})],content:data.document,
    editorProps:{attributes:{class:'private-note-document',role:'textbox','aria-label':'随手记内容','aria-multiline':'true',spellcheck:'false'},
      handlePaste:(view,event)=>{const files=[...event.clipboardData?.files||[]].filter(file=>file.type.startsWith('image/'));if(!files.length)return false;event.preventDefault();upload(files);return true},
      handleDrop:(view,event,moved)=>{const files=[...event.dataTransfer?.files||[]].filter(file=>file.type.startsWith('image/'));if(!files.length||moved)return false;event.preventDefault();upload(files);return true},
      handleClick:(view,pos,event)=>{const a=event.target.closest('a');if(a&&(event.ctrlKey||event.metaKey)&&safeLink(a.href)){window.open(a.href,'_blank','noopener,noreferrer');return true}return false}},
    onUpdate:({editor})=>queueSave(editor.getJSON())
  });
  const tools=useEditorState({editor,selector:({editor})=>editor?{bold:editor.isActive('bold'),task:editor.isActive('taskList'),link:editor.isActive('link')}:null});
  function markDirty(value){dirty.current=value;onDirtyChange(value||uploading.current>0)}
  function queueSave(document){
    markDirty(true);clearTimeout(timer.current);pending.current=JSON.stringify(document);
    try{pending.current=JSON.stringify(validateNote(document));if(!blocked.current){setError('');setStatus('dirty');timer.current=setTimeout(flush,700)}}catch(e){setError(e.message);setStatus('error')}
  }
  async function flush(){
    clearTimeout(timer.current);if(saving.current||blocked.current||!mounted.current)return;
    try{pending.current=JSON.stringify(validateNote(editor.getJSON()))}catch(e){setError(e.message);setStatus('error');return}
    if(pending.current===saved.current){markDirty(false);setStatus('saved');return}
    const snapshot=pending.current;saving.current=true;setStatus('saving');setError('');
    try{
      const next=await request('/api/notes',{method:'PUT',signal:controller.current.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({revision:revision.current,document:JSON.parse(snapshot)})});
      if(!mounted.current)return;revision.current=next.revision;saved.current=snapshot;
      const more=pending.current!==snapshot;markDirty(more);setStatus(more?'dirty':'saved');if(more)timer.current=setTimeout(flush,700);
    }catch(e){if(!mounted.current)return;if(e.status===401){onSessionChange({configured:true,authenticated:false});return}blocked.current=e.status===409;setError(e.message);setStatus('error')}
    finally{saving.current=false}
  }
  async function upload(files){
    if(uploading.current)return;
    if(blocked.current){setError('便笺已在其他页面更新，请重新载入');return}
    const target=editor.state.selection.from;uploading.current++;setUploads(uploading.current);onDirtyChange(true);setError('');
    try{
      let position=target;
      for(const file of files){
        if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)||!file.size||file.size>8*1024*1024)throw Error('支持 8 MB 内的 PNG、JPEG、GIF、WebP');
        const attrs=await request('/api/note-images',{method:'POST',signal:controller.current.signal,headers:{'Content-Type':file.type,'X-CSRF-Token':session.csrf,'X-File-Name':encodeURIComponent(file.name)},body:file});
        if(!mounted.current)return;
        position=Math.min(position,editor.state.doc.content.size);editor.chain().focus().insertContentAt(position,[{type:'noteImage',attrs},{type:'paragraph'}]).run();position=editor.state.selection.to;
      }
    }catch(e){if(!mounted.current)return;if(e.status===401){onSessionChange({configured:true,authenticated:false});return}setError(e.message)}
    finally{uploading.current--;if(mounted.current){setUploads(uploading.current);onDirtyChange(dirty.current||uploading.current>0)}}
  }
  useEffect(()=>()=>{mounted.current=false;clearTimeout(timer.current);controller.current.abort();onDirtyChange(false)},[onDirtyChange]);
  useEffect(()=>{if(open&&editor)editor.commands.focus()},[open,editor]);
  useEffect(()=>{const warn=event=>{if(dirty.current||uploading.current){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[]);
  function beginLink(){selection.current=editor.state.selection;setLink(editor.getAttributes('link').href||'')}
  function applyLink(event){event.preventDefault();const href=link.trim();if(href&&!safeLink(href)){setError('链接需使用 http 或 https');return}const chain=editor.chain().focus().setTextSelection(selection.current).extendMarkRange('link');if(href){if(selection.current.empty&&!editor.isActive('link'))chain.insertContent({type:'text',text:href,marks:[{type:'link',attrs:{href}}]}).run();else chain.setLink({href}).run()}else chain.unsetLink().run();setLink(null);if(!blocked.current)setError('')}
  function reload(){if(dirty.current||uploads)modal.confirm({title:'重新载入将放弃未保存的修改',okText:'重新载入',cancelText:'取消',onOk:onReload});else onReload()}
  const saveLabel=uploads?'上传中':status==='saving'?'保存中':status==='dirty'?'待保存':status==='error'?'未保存':'已保存';
  return <>{modalContext}<div className="note-status" role="status" aria-label={saveLabel}><Tooltip title={saveLabel}><span>{uploads||status==='saving'?icon('circle-notch'):status==='error'?icon('circle-exclamation'):status==='dirty'?icon('circle'):icon('check')}</span></Tooltip></div>
    <EditorContent editor={editor}/>
    {error&&<div className="note-error" role="alert"><span>{error}</span>{blocked.current?<Tooltip title="重新载入"><button className="icon-button" aria-label="重新载入随手记" onClick={reload}>{icon('arrows-rotate')}</button></Tooltip>:dirty.current&&<button aria-label="重试保存随手记" onClick={flush}>{icon('rotate-right')}</button>}</div>}
    {link!==null&&<form className="note-link-form" onSubmit={applyLink}><input aria-label="链接地址" placeholder="https://" autoFocus value={link} onChange={event=>setLink(event.target.value)} maxLength={4000}/><button className="icon-button" aria-label="确认链接" type="submit">{icon('check')}</button><button className="icon-button" aria-label="取消链接" type="button" onClick={()=>setLink(null)}>{icon('xmark')}</button></form>}
    <div className="note-tools"><div><Tooltip title="加粗"><button className="icon-button" aria-label="加粗" aria-pressed={!!tools?.bold} onMouseDown={event=>event.preventDefault()} onClick={()=>editor.chain().focus().toggleBold().run()}>{icon('bold')}</button></Tooltip><Tooltip title="清单"><button className="icon-button" aria-label="勾选清单" aria-pressed={!!tools?.task} onMouseDown={event=>event.preventDefault()} onClick={()=>editor.chain().focus().toggleTaskList().run()}>{icon('list-check')}</button></Tooltip><Tooltip title="链接"><button className="icon-button" aria-label="编辑链接" aria-pressed={!!tools?.link} onMouseDown={event=>event.preventDefault()} onClick={beginLink}>{icon('link')}</button></Tooltip><Tooltip title="附件"><button className="icon-button" aria-label="添加私人图片" disabled={!!uploads} onClick={()=>input.current?.click()}>{icon('paperclip')}</button></Tooltip></div></div>
    <input ref={input} type="file" className="note-file-input" tabIndex={-1} aria-label="选择私人图片" accept="image/png,image/jpeg,image/gif,image/webp" multiple onChange={event=>{upload([...event.target.files]);event.target.value=''}}/>
  </>;
}
export default function PrivateNotes({session,onSessionChange,onDirtyChange,open,onOpenChange,triggerElement}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[generation,setGeneration]=useState(0);
  const trigger=useRef(null),active=useRef(true),abort=useRef(new AbortController());
  async function load(){setError('');try{const next=await request('/api/notes',{signal:abort.current.signal});if(active.current){setData(next);setGeneration(value=>value+1)}}catch(e){if(!active.current)return;if(e.status===401)onSessionChange({configured:true,authenticated:false});else setError(e.message)}}
  useEffect(()=>{load();return()=>{active.current=false;abort.current.abort()}},[]);
  useEffect(()=>{if(!open)return;const escape=event=>{if(event.key==='Escape'){event.stopPropagation();onOpenChange(false);trigger.current?.focus()}};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true)},[open,onOpenChange]);
  const content=<section className="private-notes" role="dialog" aria-label="私人随手记"><header><strong>随手记 <i className="fas fa-lock" aria-label="仅登录可见"/></strong><button className="icon-button" aria-label="关闭随手记" onClick={()=>{onOpenChange(false);trigger.current?.focus()}}>{icon('xmark')}</button></header>
    {data?<NotesEditor key={generation} data={data} session={session} onSessionChange={onSessionChange} onDirtyChange={onDirtyChange} onReload={load} open={open}/>:<div className="note-loading">{error?<><span>{error}</span><button className="icon-button" aria-label="重试载入随手记" onClick={load}>{icon('rotate-right')}</button></>:icon('circle-notch')}</div>}
  </section>;
  return <Popover open={open} onOpenChange={onOpenChange} trigger="click" placement="top" arrow={false} content={content}>{cloneElement(triggerElement,{ref:node=>{triggerElement.props.ref(node);trigger.current=node},'aria-label':'打开私人随手记','aria-haspopup':'dialog','aria-expanded':open})}</Popover>;
}
