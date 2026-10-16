import {useRef,useState} from 'react';
import {App,Button,Checkbox,Empty,Form,Input,Modal,Popover,Select,Space,Switch,Tooltip} from 'antd';
import {DeleteOutlined,PlusOutlined,PictureOutlined,SkinOutlined,FolderAddOutlined} from '@ant-design/icons';
import {useCanvas} from './Widgets';
import {linkUrl,readImage} from './content';
import {SPECS} from './layout';

export default function PersonalWidget({node}){
  const {content,db,change}=useCanvas(),{message}=App.useApp();
  const item=content.data.items.find(x=>x.id===node.data.source&&x.kind===node.data.kind);
  const [text,setText]=useState(''),[showDone,setShowDone]=useState(false),[busy,setBusy]=useState(false),[filing,setFiling]=useState(null),[form]=Form.useForm(),upload=useRef(null);
  if(!item)return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="内容未找到，可从已保存内容重新添加"/>;
  const update=fn=>content.update(item.id,fn);
  function add(e){e.preventDefault();if(!text.trim())return;try{const entry=item.kind==='todo'?{id:crypto.randomUUID(),text:text.trim(),done:false}:{id:crypto.randomUUID(),text:new URL(linkUrl(text)).hostname,url:linkUrl(text)};if(update(x=>{x.entries.push(entry)}))setText('')}catch(e){message.error(e.message)}}
  function remove(entry){const index=item.entries.findIndex(x=>x.id===entry.id);if(update(x=>{x.entries=x.entries.filter(e=>e.id!==entry.id)}))message.open({key:'widget-entry-undo',duration:10,content:<Space>已移除<Button className="nodrag" type="link" size="small" onClick={()=>{update(x=>{if(!x.entries.some(e=>e.id===entry.id))x.entries.splice(index,0,entry)});message.destroy('widget-entry-undo')}}>撤销</Button></Space>})}
  function startFiling(entry){setFiling(entry);form.setFieldsValue({title:entry.text,cat:db.categories[0]?.id})}
  function fileLink(values){
    if(!db.links.some(x=>x.url===filing.url)&&!change(next=>{next.links.push({id:crypto.randomUUID(),title:values.title.trim(),url:filing.url,desc:'',cat:values.cat,alias:'',icon:'',mark:''})}))return;
    setFiling(null);message.success('已加入导航，原链接仍保留在收集箱');
  }
  async function pickImage(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);try{const src=await readImage(file);update(x=>{x.src=src;if(!x.title)x.title=file.name.replace(/\.[^.]+$/,'').slice(0,100)})}catch(e){message.error(e.message)}finally{setBusy(false)}}
  const entries=item.entries||[],done=entries.filter(e=>e.done).length;
  return <section className={`personal-widget personal-${item.kind} ${item.kind==='note'?`note-${item.tone}`:''}`}>
    <header className="personal-heading"><Input className="nodrag" aria-label={`${SPECS[item.kind].title}标题`} placeholder={SPECS[item.kind].title} value={item.title} variant="borderless" maxLength={100} onChange={e=>update(x=>{x.title=e.target.value})}/>
      {item.kind==='note'&&<Popover trigger="click" title="便签样式" content={<div className="note-tones">{[['paper','纸色'],['blue','浅蓝'],['green','浅绿'],['plain','无底色']].map(([tone,label])=><Button className="nodrag" key={tone} size="small" type={item.tone===tone?'primary':'default'} onClick={()=>update(x=>{x.tone=tone})}>{label}</Button>)}</div>}><Button className="nodrag" type="text" size="small" aria-label="便签样式" icon={<SkinOutlined/>}/></Popover>}
      {item.kind==='todo'&&<span className="personal-count">{done}/{entries.length}</span>}
      {item.kind==='inbox'&&<span className="personal-count">{entries.length}</span>}
      {item.kind==='image'&&<Popover trigger="click" title="图片样式" content={<Space>无边框<Switch checked={item.borderless} onChange={value=>update(x=>{x.borderless=value})}/></Space>}><Button className="nodrag" type="text" size="small" aria-label="图片样式" icon={<SkinOutlined/>}/></Popover>}
    </header>
    {item.kind==='note'&&<Input.TextArea className="nodrag note-text nowheel" aria-label="便签内容" placeholder="随手记点什么…" value={item.text} maxLength={30000} variant="borderless" onChange={e=>update(x=>{x.text=e.target.value})}/>}
    {['todo','inbox'].includes(item.kind)&&<><form className="personal-add" onSubmit={add}><Input className="nodrag" aria-label={item.kind==='todo'?'新增待办':'收集链接'} placeholder={item.kind==='todo'?'下一件要做的事…':'粘贴网址，回车收下'} value={text} maxLength={item.kind==='todo'?2000:4000} onChange={e=>setText(e.target.value)}/><Button className="nodrag" htmlType="submit" aria-label={item.kind==='todo'?'添加待办':'保存链接'} icon={<PlusOutlined/>} disabled={!text.trim()||entries.length>=500}/></form>
      <div className="personal-list nowheel">{!entries.length&&<p className="personal-empty">{item.kind==='todo'?'从一件小事开始。':'先收下，空了再整理。'}</p>}{entries.filter(e=>item.kind!=='todo'||!e.done||showDone).map(entry=><div key={entry.id} className={`personal-entry ${entry.done?'done':''}`}>
        {item.kind==='todo'?<Checkbox className="nodrag" checked={entry.done} onChange={e=>update(x=>{x.entries.find(v=>v.id===entry.id).done=e.target.checked})}>{entry.text}</Checkbox>:<a className="nodrag" href={entry.url} target="_blank" rel="noopener noreferrer"><strong>{entry.text}</strong><small>{entry.url}</small></a>}
        {item.kind==='inbox'&&<Tooltip title="整理到导航"><Button className="nodrag" type="text" size="small" aria-label={`整理 ${entry.text}`} icon={<FolderAddOutlined/>} disabled={!db.categories.length} onClick={()=>startFiling(entry)}/></Tooltip>}<Button type="text" size="small" className="nodrag entry-remove" aria-label={`移除 ${entry.text}`} icon={<DeleteOutlined/>} onClick={()=>remove(entry)}/>
      </div>)}</div>{item.kind==='todo'&&done>0&&<Button className="nodrag completed-toggle" type="text" size="small" onClick={()=>setShowDone(!showDone)}>{showDone?'收起':'显示'}已完成 · {done}</Button>}
    </>}
    {item.kind==='image'&&<><div className="personal-image">{item.src?<img src={item.src} alt={item.title||'画布图片'} draggable={false}/>:<Button className="nodrag" type="text" loading={busy} icon={<PictureOutlined/>} onClick={()=>upload.current?.click()}>选择图片</Button>}</div><div className="image-footer">{item.src?<Space size={4}><Button className="nodrag" size="small" type="text" loading={busy} onClick={()=>upload.current?.click()}>替换图片</Button><Button className="nodrag" size="small" type="text" onClick={()=>{const src=item.src;if(update(x=>{x.src=''}))message.open({key:'image-undo',duration:10,content:<Space>图片已清空<Button className="nodrag" type="link" size="small" onClick={()=>{update(x=>{x.src=src});message.destroy('image-undo')}}>撤销</Button></Space>})}}>清空</Button></Space>:<small>PNG、JPG、WebP · 最大 5 MB</small>}</div><input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickImage}/></>}
    <Modal title="整理到导航" open={!!filing} onCancel={()=>setFiling(null)} onOk={()=>form.submit()} okText="加入导航" cancelText="取消" forceRender><Form form={form} layout="vertical" onFinish={fileLink}><Form.Item name="title" label="网站名称" rules={[{required:true,whitespace:true,message:'填写网站名称'}]}><Input className="nodrag" maxLength={100}/></Form.Item><Form.Item name="cat" label="分类" rules={[{required:true,message:'选择分类'}]}><Select className="nodrag" options={db.categories.map(c=>({value:c.id,label:c.name}))}/></Form.Item></Form></Modal>
  </section>;
}
