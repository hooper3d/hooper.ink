import { useEffect, useRef, useState } from 'react';
import { App, Button, Drawer, Empty, Form, Input, Modal, Select, Space, Tabs, Tooltip, Upload } from 'antd';
import { UpOutlined, DownOutlined, EditOutlined, DeleteOutlined, HolderOutlined, UploadOutlined } from '@ant-design/icons';
import { validateData, validUrl } from './model';
import { prepareAvatar } from './avatar';
import SiteIcon from './SiteIcon';

export default function Manager({open,onClose,tab,setTab,db,change,undo}) {
  const {message,modal} = App.useApp();
  const [category,setCategory] = useState('all'), [editor,setEditor] = useState(null), [avatarLoading,setAvatarLoading] = useState(false), [formError,setFormError] = useState('');
  const [form] = Form.useForm(), dragged = useRef(null);
  const activeCategory = db.categories.some(c=>c.id===category)?category:'all';
  const visible = db.links.filter(x=>activeCategory==='all'||x.cat===activeCategory);
  useEffect(()=>{if(editor){form.resetFields();form.setFieldsValue(editor.kind==='category'?{name:editor.item?.name||''}:{title:'',url:'',desc:'',mark:'',alias:'',cat:activeCategory==='all'?db.categories[0]?.id:activeCategory,...editor.item});setFormError('')}},[editor,form]);
  function edit(kind,item=null){if(kind==='link'&&!db.categories.length){message.info('先添加一个分类，再添加网站。');return}setEditor({kind,item})}
  function move(kind,id,direction){change(next=>{const all=kind==='category'?next.categories:next.links;const filtered=kind==='category'?all:all.filter(x=>activeCategory==='all'||x.cat===activeCategory);const neighbor=filtered[filtered.findIndex(x=>x.id===id)+direction];if(!neighbor)return;const a=all.findIndex(x=>x.id===id),b=all.findIndex(x=>x.id===neighbor.id);[all[a],all[b]]=[all[b],all[a]]})}
  function remove(kind,item){if(kind==='category'&&db.links.some(x=>x.cat===item.id)){message.info('请先把分类内的网站移到其他分类，再删除。');return}const before=structuredClone(db);if(change(next=>{if(kind==='link'){next.links=next.links.filter(x=>x.id!==item.id);next.favorites=next.favorites.filter(x=>x!==item.id)}else next.categories=next.categories.filter(x=>x.id!==item.id)}))undo(`已删除「${item.title||item.name}」`,before)}
  function save(values){
    let error='';const ok=change(next=>{
      if(editor.kind==='category'){
        const name=values.name.trim();if(next.categories.some(c=>c.name===name&&c.id!==editor.item?.id))throw Error('已经有同名分类。');
        if(editor.item){const item=next.categories.find(c=>c.id===editor.item.id);if(!item)throw Error('分类已不存在。');item.name=name}else next.categories.push({id:crypto.randomUUID(),name});
      }else{
        const item={id:editor.item?.id||crypto.randomUUID(),title:values.title.trim(),url:validUrl(values.url.trim()),desc:(values.desc||'').trim(),cat:values.cat,alias:(values.alias||'').trim(),mark:(values.mark||'').trim(),icon:editor.item?.icon||''};
        if(editor.item){const index=next.links.findIndex(x=>x.id===item.id);if(index<0)throw Error('网站已不存在。');next.links[index]=item}else next.links.push(item);
      }
    },e=>{error=e.message});
    if(ok){setEditor(null);message.success('已保存到当前浏览器')}else setFormError(error);
  }
  function exportData(){const url=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`hooper-nav-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function importData(file){try{if(file.size>4*1024*1024)throw Error('备份文件不能超过 4 MB。');const next=validateData(JSON.parse(await file.text()));modal.confirm({title:'导入备份',content:<><p>包含 {next.links.length} 个网站、{next.categories.length} 个分类与 {next.favorites.length} 个收藏。</p><p>导入会替换当前浏览器中的导航，可先导出备份。</p></>,okText:'确认导入',cancelText:'取消',onOk:()=>{const before=structuredClone(db);if(!change(()=>next))return Promise.reject(Error('未能保存'));undo('备份已导入',before)}})}catch(e){message.error(e instanceof SyntaxError?'无法读取这份 JSON 备份。':e.message)}return Upload.LIST_IGNORE}
  async function uploadAvatar(file){setAvatarLoading(true);try{const avatar=await prepareAvatar(file);if(change(next=>{next.avatar=avatar}))message.success('头像已更新')}catch(e){message.error(e.message)}finally{setAvatarLoading(false)}return Upload.LIST_IGNORE}
  function action(kind,item,index,count){return <Space size={0}><Button type="text" size="small" aria-label={`上移 ${item.title||item.name}`} icon={<UpOutlined/>} disabled={!index} onClick={()=>move(kind,item.id,-1)}/><Button type="text" size="small" aria-label={`下移 ${item.title||item.name}`} icon={<DownOutlined/>} disabled={index===count-1} onClick={()=>move(kind,item.id,1)}/><Tooltip title="编辑"><Button type="text" size="small" aria-label={`编辑 ${item.title||item.name}`} icon={<EditOutlined/>} onClick={()=>edit(kind,item)}/></Tooltip><Tooltip title="删除"><Button type="text" size="small" danger aria-label={`删除 ${item.title||item.name}`} icon={<DeleteOutlined/>} onClick={()=>remove(kind,item)}/></Tooltip></Space>}
  const contents={
    links:<><div className="manage-toolbar"><Select aria-label="筛选管理分类" value={activeCategory} onChange={setCategory} options={[{value:'all',label:`全部网站（${db.links.length}）`},...db.categories.map(c=>({value:c.id,label:c.name}))]}/><Button type="primary" onClick={()=>edit('link')}>添加网站</Button></div><p className="manage-note">拖动左侧手柄排序，也可以用上下按钮调整。</p>{visible.length?visible.map((item,index)=><div className="manage-row" key={item.id} draggable onDragStart={e=>{dragged.current=item.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',item.id)}} onDragOver={e=>{if(dragged.current)e.preventDefault()}} onDragEnd={()=>dragged.current=null} onDrop={e=>{e.preventDefault();const id=dragged.current;dragged.current=null;if(id&&id!==item.id)change(next=>{const from=next.links.findIndex(x=>x.id===id);if(from<0)return;const [moved]=next.links.splice(from,1),target=next.links.findIndex(x=>x.id===item.id);if(target<0)throw Error('排序目标不存在');next.links.splice(target,0,moved)})}}><HolderOutlined className="drag-handle"/><SiteIcon item={item}/><div className="manage-copy"><strong>{item.title}</strong><small>{db.categories.find(c=>c.id===item.cat)?.name}</small></div>{action('link',item,index,visible.length)}</div>):<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这里还没有网站"/>}</>,
    categories:<><div className="manage-toolbar"><span className="muted">{db.categories.length} 个分类</span><Button type="primary" onClick={()=>edit('category')}>添加分类</Button></div><p className="manage-note">这里的顺序会同步到首页分类栏。</p>{db.categories.map((item,index)=><div className="manage-row" key={item.id}><div className="manage-copy"><strong>{item.name}</strong><small>{db.links.filter(x=>x.cat===item.id).length} 个网站</small></div>{action('category',item,index,db.categories.length)}</div>)}</>,
    appearance:<section className="avatar-settings"><h3>站点头像</h3><div className="avatar-preview"><img src={db.avatar||'assets/avatar.png'} alt="当前站点头像" width="76" height="76"/><Space wrap><Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={uploadAvatar} disabled={avatarLoading}><Button type="primary" icon={<UploadOutlined/>} loading={avatarLoading}>上传图片</Button></Upload><Button disabled={!db.avatar||avatarLoading} onClick={()=>{const before=structuredClone(db);if(change(next=>{next.avatar=''}))undo('已恢复默认头像',before)}}>恢复默认</Button></Space></div><p className="manage-note">支持 PNG、JPG、WebP，最大 5 MB。图片会居中裁为正方形，并同步到标签页图标。</p><p className="manage-note">保存在当前浏览器，导出备份时会一并保存。</p></section>,
    backup:<><section className="backup-section"><h3>导出一份备份</h3><p>包含全部网站、分类、顺序、收藏和头像。换浏览器时也可以带走。</p><Button type="primary" onClick={exportData}>导出备份</Button></section><section className="backup-section"><h3>从备份恢复</h3><p>选择本站导出的 JSON 文件。确认后会替换当前导航。</p><Upload accept="application/json,.json" showUploadList={false} beforeUpload={importData}><Button>选择备份文件</Button></Upload></section><p className="manage-note">当前是本地预览，管理修改不会同步到其他设备，也不会改变线上网站。</p></>
  };
  return <><Drawer title={<><span>管理导航</span><p className="drawer-subtitle">本地预览 · 修改保存在当前浏览器</p></>} open={open} onClose={onClose} size={490} styles={{body:{padding:'0 24px 30px'}}}><Tabs activeKey={tab} onChange={setTab} items={[['links','网站'],['categories','分类'],['appearance','外观'],['backup','备份']].map(([key,label])=>({key,label,children:contents[key]}))}/></Drawer>
    <Modal open={!!editor} forceRender title={editor?.kind==='category'?(editor?.item?'重命名分类':'添加分类'):(editor?.item?'编辑网站':'添加网站')} onCancel={()=>setEditor(null)} onOk={()=>form.submit()} okText="保存" cancelText="取消" width={440}>
      <Form form={form} layout="vertical" onFinish={save} autoComplete="off">
        {editor?.kind==='category'?<Form.Item label="分类名称" name="name" rules={[{required:true,whitespace:true,message:'请输入分类名称'}]}><Input maxLength={40}/></Form.Item>:<>
          <Form.Item label="网站名称" name="title" rules={[{required:true,whitespace:true,message:'请输入网站名称'}]}><Input maxLength={100}/></Form.Item>
          <Form.Item label="网址" name="url" rules={[{required:true,message:'请输入网址'},{validator:(_,value)=>{try{if(value)validUrl(value.trim());return Promise.resolve()}catch(e){return Promise.reject(e)}}}]}><Input placeholder="https://example.com" maxLength={2000}/></Form.Item>
          <Form.Item label="一句说明" name="desc"><Input maxLength={200} placeholder="这个网站有什么用"/></Form.Item>
          <div className="field-pair"><Form.Item label="分类" name="cat" rules={[{required:true,message:'请选择分类'}]}><Select options={db.categories.map(c=>({value:c.id,label:c.name}))}/></Form.Item><Form.Item label="图标文字 / Emoji" name="mark"><Input maxLength={8} placeholder="留空自动获取"/></Form.Item></div>
          <Form.Item label="搜索别名" name="alias"><Input maxLength={100} placeholder="例如 gpt、画图"/></Form.Item>
        </>}{formError&&<p className="form-error" role="alert">{formError}</p>}
      </Form>
    </Modal></>;
}
