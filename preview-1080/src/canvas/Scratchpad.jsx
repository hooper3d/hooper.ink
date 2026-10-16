import {useEffect,useRef,useState} from 'react';
import {App,Button,Empty,Form,Input,Modal,Tooltip} from 'antd';
import {BoldOutlined,CheckSquareOutlined,LinkOutlined,PictureOutlined,UndoOutlined,RedoOutlined} from '@ant-design/icons';
import {EditorContent,useEditor,useEditorState} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import ImageAttachment from './ImageAttachment';
import Placeholder from '@tiptap/extension-placeholder';
import {useCanvas} from './Widgets';
import {linkUrl,readImage} from './content';
import {safeLink,validateDocument} from './scratchpad-data';

export default function Scratchpad({node}){
  const {content}=useCanvas();
  const item=content.data.items.find(x=>x.id===node.data.source&&x.kind==='scratchpad');
  return item?<ScratchpadEditor key={item.id} item={item}/>:<Empty description="内容未找到，可从已保存内容重新添加"/>;
}
function ScratchpadEditor({item}){
  const {content,readOnly}=useCanvas(),{message}=App.useApp();
  const [linkOpen,setLinkOpen]=useState(false),[busy,setBusy]=useState(false),[form]=Form.useForm();
  const upload=useRef(null),selection=useRef(null),current=useRef(item),saved=useRef(JSON.stringify(item.document));current.current=item;
  async function insertImage(file,position){
    setBusy(true);
    try{const src=await readImage(file);const chain=editor.chain().focus();if(position!==undefined)chain.setTextSelection(position);chain.setImage({src,alt:file.name.slice(0,100)}).run()}
    catch(e){message.error(e.message)}finally{setBusy(false)}
  }
  const editor=useEditor({
    editable:!readOnly,
    extensions:[StarterKit.configure({heading:{levels:[1,2,3]},link:{openOnClick:readOnly,isAllowedUri:safeLink,HTMLAttributes:{title:'Ctrl / ⌘ + 单击打开链接'}}}),TaskList,TaskItem.configure({nested:true,a11y:{checkboxLabel:node=>`待办：${node.textContent}`}}),ImageAttachment,Placeholder.configure({placeholder:'随手记点什么…'})],
    content:item.document,
    editorProps:{
      attributes:{class:'scratchpad-document',role:'textbox','aria-label':'随手记内容','aria-multiline':'true',spellcheck:'false'},
      handlePaste:(view,event)=>{const file=Array.from(event.clipboardData?.files||[]).find(f=>f.type.startsWith('image/'));if(!file)return false;event.preventDefault();insertImage(file,view.state.selection.from);return true},
      handleDrop:(view,event,moved)=>{const file=Array.from(event.dataTransfer?.files||[]).find(f=>f.type.startsWith('image/'));if(!file||moved)return false;event.preventDefault();insertImage(file,view.posAtCoords({left:event.clientX,top:event.clientY})?.pos??view.state.selection.from);return true},
      handleClick:(view,pos,event)=>{const a=event.target.closest('a');if(a&&(event.ctrlKey||event.metaKey)&&safeLink(a.href)){window.open(a.href,'_blank','noopener,noreferrer');return true}return false},
    },
    onUpdate:({editor})=>{
      if(readOnly)return;
      try{const document=validateDocument(editor.getJSON());saved.current=JSON.stringify(document);content.update(item.id,x=>{x.document=document})}
      catch(e){message.error(e.message);editor.commands.setContent(current.current.document,{emitUpdate:false})}
    },
  });
  const state=useEditorState({editor,selector:({editor})=>editor?{bold:editor.isActive('bold'),task:editor.isActive('taskList'),undo:editor.can().undo(),redo:editor.can().redo()}:null});
  useEffect(()=>{const serialized=JSON.stringify(item.document);if(editor&&serialized!==saved.current){saved.current=serialized;editor.commands.setContent(item.document,{emitUpdate:false})}},[editor,item.document]);
  function beginLink(){
    const {from,to}=editor.state.selection,href=editor.getAttributes('link').href;
    selection.current={from,to};
    form.setFieldsValue({url:href||'',label:editor.state.doc.textBetween(from,to,' ')});setLinkOpen(true);
  }
  function insertLink(values){
    try{const href=linkUrl(values.url),label=values.label?.trim()||new URL(href).hostname;editor.chain().focus().setTextSelection(selection.current).insertContent({type:'text',text:label,marks:[{type:'link',attrs:{href}}]}).run();setLinkOpen(false)}catch(e){message.error(e.message)}
  }
  return <section className="scratchpad-widget">
    <header className="scratchpad-heading"><Input className="nodrag" readOnly={readOnly} aria-label="随手记标题" placeholder="随手记" variant="borderless" value={item.title} maxLength={100} onChange={e=>content.update(item.id,x=>{x.title=e.target.value})}/></header>
    <div className="scratchpad-scroll nodrag nopan nowheel"><EditorContent editor={editor}/></div>
    {!readOnly&&<footer className="scratchpad-toolbar nodrag" onMouseDown={e=>e.preventDefault()}>
      <Tooltip title="加粗"><Button type="text" size="small" aria-label="加粗文字" aria-pressed={state?.bold} className={state?.bold?'active':''} icon={<BoldOutlined/>} disabled={!editor} onClick={()=>editor.chain().focus().toggleBold().run()}/></Tooltip>
      <Tooltip title="待办"><Button type="text" size="small" aria-label="插入待办" aria-pressed={state?.task} className={state?.task?'active':''} icon={<CheckSquareOutlined/>} disabled={!editor} onClick={()=>editor.chain().focus().toggleTaskList().run()}/></Tooltip>
      <Tooltip title="链接"><Button type="text" size="small" aria-label="插入链接" icon={<LinkOutlined/>} disabled={!editor} onClick={beginLink}/></Tooltip>
      <Tooltip title="图片 · 支持粘贴和拖入"><Button type="text" size="small" aria-label="插入图片" icon={<PictureOutlined/>} loading={busy} disabled={!editor||busy} onClick={()=>upload.current?.click()}/></Tooltip>
      <span/>
      <Tooltip title="撤销内容"><Button type="text" size="small" aria-label="撤销随手记内容" icon={<UndoOutlined/>} disabled={!state?.undo} onClick={()=>editor.chain().focus().undo().run()}/></Tooltip>
      <Tooltip title="重做内容"><Button type="text" size="small" aria-label="重做随手记内容" icon={<RedoOutlined/>} disabled={!state?.redo} onClick={()=>editor.chain().focus().redo().run()}/></Tooltip>
    </footer>}
    {readOnly&&<div className="scratchpad-readonly-footer"><span>文字</span><span>链接</span><span>图片附件</span></div>}
    <input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)insertImage(file)}}/>
    <Modal title="插入链接" open={linkOpen} onCancel={()=>setLinkOpen(false)} onOk={()=>form.submit()} okText="插入" cancelText="取消" width={400} forceRender><Form form={form} layout="vertical" onFinish={insertLink}><Form.Item name="url" label="网址" rules={[{required:true,message:'填写网址'}]}><Input placeholder="https://" maxLength={4000}/></Form.Item><Form.Item name="label" label="显示文字"><Input placeholder="留空使用网站域名" maxLength={2000}/></Form.Item></Form></Modal>
  </section>;
}
