import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Drawer,Dropdown,Empty,Form,Input,Modal,Select,Space,Switch,Tabs,Tooltip,Upload} from 'antd';
import model from '../navigation-model.cjs';
import {todayKey} from '../../preview-1080/src/holidays';
const {validateNavigation,validUrl}=model;
const icon=name=><i className={`fas fa-${name}`} aria-hidden="true"/>;
async function request(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data=await response.json();
  if(!response.ok)throw Object.assign(Error(data.error||'暂时无法保存'),{status:response.status});
  return data;
}
export default function NavigationManager({session,onSessionChange:setSession,privateDirty=false}){
  const [login,setLogin]=useState(false),[open,setOpen]=useState(false),[tab,setTab]=useState('links');
  const [accountOpen,setAccountOpen]=useState(false);
  const [base,setBase]=useState(null),[draft,setDraft]=useState(null),[history,setHistory]=useState([]),[filter,setFilter]=useState('all');
  const [editor,setEditor]=useState(null),[error,setError]=useState(''),[formError,setFormError]=useState(''),[busy,setBusy]=useState(false);
  const [credentials]=Form.useForm(),[form]=Form.useForm();
  const [modal,modalContext]=Modal.useModal();
  const drag=useRef(null);
  const dirty=!!draft&&JSON.stringify(draft)!==JSON.stringify(base);
  useEffect(()=>{let active=true;const refresh=()=>request('/api/session').then(state=>{if(active)setSession(state)}).catch(()=>{});refresh();const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh)}},[setSession]);
  useEffect(()=>{document.body.classList.toggle('manager-open',open||login||!!editor);return()=>document.body.classList.remove('manager-open')},[open,login,editor]);
  useEffect(()=>{if(!dirty)return;const warn=event=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
  async function load(){const data=await request('/api/navigation');setBase(data);setDraft(structuredClone(data));setHistory([]);setError('');return data}
  async function begin(){
    setBusy(true);setError('');
    try{const state=await request('/api/session');setSession(state);if(state.authenticated){if(!draft)await load();setOpen(true)}else{setLogin(true)}}catch(e){setError(e.message);setLogin(true)}finally{setBusy(false)}
  }
  async function authenticate(values){
    setBusy(true);setError('');
    try{
      const state=await request(session?.configured?'/api/login':'/api/setup',{method:'POST',body:JSON.stringify({password:values.password,setupToken:session?.setupToken})});
      setSession(state);credentials.resetFields();setLogin(false);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  function change(update){const next=structuredClone(draft);update(next);setHistory(previous=>[...previous.slice(-19),structuredClone(draft)]);setDraft(next);setError('')}
  function edit(kind,item){
    if(kind==='link'&&!draft.categories.length){setError('请先添加分类');return}
    setFormError('');setEditor({kind,item});
    form.setFieldsValue(kind==='category'?{name:item?.name||''}:{title:'',url:'',desc:'',alias:'',mark:'',iconUrl:'',cat:activeFilter==='all'?draft.categories[0]?.id:activeFilter,new:false,hidden:draft.links.filter(link=>!link.hidden).length>=24,...item});
  }
  function saveEditor(values){
    try{
      const next=structuredClone(draft);
      if(editor.kind==='category'){
        const item={id:editor.item?.id||crypto.randomUUID(),name:values.name.trim()};
        if(editor.item)next.categories=next.categories.map(category=>category.id===item.id?item:category);else next.categories.push(item);
      }else{
        const item={...editor.item,id:editor.item?.id||crypto.randomUUID(),title:values.title.trim(),url:validUrl(values.url.trim()),desc:values.desc||'',cat:values.cat,alias:values.alias||'',mark:values.mark||'',iconUrl:values.iconUrl||'',icon:editor.item?.icon||'fa-link',tile:editor.item?.tile||'#617A99',new:!!values.new,hidden:!!values.hidden};
        if(editor.item)next.links=next.links.map(link=>link.id===item.id?item:link);else next.links.push(item);
      }
      validateNavigation(next);change(data=>Object.assign(data,next));setEditor(null);setOpen(true);
    }catch(e){setFormError(e.message)}
  }
  function remove(kind,item){
    if(kind==='category'&&draft.links.some(link=>link.cat===item.id)){setError('请先移动分类内的网站');return}
    change(next=>{if(kind==='category')next.categories=next.categories.filter(category=>category.id!==item.id);else next.links=next.links.filter(link=>link.id!==item.id)});
  }
  function move(kind,id,direction){
    change(next=>{const all=kind==='category'?next.categories:next.links,visible=kind==='category'||activeFilter==='all'?all:all.filter(link=>link.cat===activeFilter),neighbor=visible[visible.findIndex(item=>item.id===id)+direction];if(!neighbor)return;const a=all.findIndex(item=>item.id===id),b=all.findIndex(item=>item.id===neighbor.id);[all[a],all[b]]=[all[b],all[a]]});
  }
  async function publish(){
    setBusy(true);setError('');
    try{const valid=validateNavigation(draft);const saved=await request('/api/navigation',{method:'PUT',headers:{'X-CSRF-Token':session.csrf},body:JSON.stringify({...valid,revision:base.revision})});setBase(saved);setDraft(structuredClone(saved));setHistory([]);document.dispatchEvent(new CustomEvent('navigationchange',{detail:saved}))}
    catch(e){setError(e.message);if(e.status===401){setSession({configured:true,authenticated:false});setLogin(true)}}finally{setBusy(false)}
  }
  async function logout(){
    if(privateDirty){modal.confirm({title:'随手记尚未保存，仍然退出？',okText:'退出',cancelText:'取消',onOk:performLogout});return}
    return performLogout();
  }
  async function performLogout(){
    setBusy(true);try{const state=await request('/api/logout',{method:'POST',headers:{'X-CSRF-Token':session.csrf},body:'{}'});setSession(state);setOpen(false)}catch(e){modal.error({title:'退出失败',content:e.message,okText:'关闭'})}finally{setBusy(false)}
  }
  function exportData(){const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download=`hooper-navigation-${todayKey()}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function importData(file){try{if(file.size>256*1024)throw Error('备份文件过大');const valid=validateNavigation(JSON.parse(await file.text()));change(next=>Object.assign(next,valid))}catch(e){setError(e instanceof SyntaxError?'JSON 格式无效':e.message)}return Upload.LIST_IGNORE}
  function actions(kind,item,index,length){return <Space size={0}><Button type="text" size="small" aria-label={`上移 ${item.title||item.name}`} icon={icon('arrow-up')} disabled={busy||index===0} onClick={()=>move(kind,item.id,-1)}/><Button type="text" size="small" aria-label={`下移 ${item.title||item.name}`} icon={icon('arrow-down')} disabled={busy||index===length-1} onClick={()=>move(kind,item.id,1)}/><Button type="text" size="small" aria-label={`编辑 ${item.title||item.name}`} icon={icon('pen')} disabled={busy} onClick={()=>edit(kind,item)}/><Button type="text" size="small" danger aria-label={`删除 ${item.title||item.name}`} icon={icon('trash-can')} disabled={busy} onClick={()=>remove(kind,item)}/></Space>}
  const activeFilter=draft?.categories.some(category=>category.id===filter)?filter:'all';
  const visible=draft?.links.filter(item=>activeFilter==='all'||item.cat===activeFilter)||[];
  const list=draft&&<><div className="manager-toolbar">{tab==='links'?<Select aria-label="筛选管理分类" value={activeFilter} onChange={setFilter} options={[{value:'all',label:`全部 · ${draft.links.length}`},...draft.categories.map(item=>({value:item.id,label:item.name}))]}/>:<span className="manager-category-count">{draft.categories.length}</span>}<Button type="primary" icon={icon('plus')} disabled={busy} onClick={()=>edit(tab==='links'?'link':'category')}>新增</Button></div>
    {error&&<Alert type="error" showIcon title={error} className="manager-error"/>}
    {tab==='links'?(visible.length?visible.map((item,index)=><div className={`manager-row ${item.hidden?'is-hidden':''}`} key={item.id} onDragOver={event=>{if(drag.current)event.preventDefault()}} onDrop={event=>{event.preventDefault();const id=drag.current;drag.current=null;if(id&&id!==item.id)change(next=>{const from=next.links.findIndex(link=>link.id===id);if(from<0)return;const [moved]=next.links.splice(from,1),to=next.links.findIndex(link=>link.id===item.id);next.links.splice(to,0,moved)})}}><span className="manager-handle" draggable={!busy} role="img" aria-label="拖动排序" title="拖动排序" onDragStart={event=>{drag.current=item.id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',item.id)}} onDragEnd={()=>drag.current=null}>{icon('grip-vertical')}</span><div className="manager-copy"><strong>{item.title}</strong><small>{item.url}</small></div>{item.hidden&&<i className="far fa-eye-slash" title="未在首页显示" aria-label="未在首页显示"/>}{actions('link',item,index,visible.length)}</div>):<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无网站"/>):draft.categories.map((item,index)=><div className="manager-row" key={item.id}><div className="manager-copy"><strong>{item.name}</strong><small>{draft.links.filter(link=>link.cat===item.id).length}</small></div>{actions('category',item,index,draft.categories.length)}</div>)}</>;
  return <>{modalContext}{session?.authenticated?<Dropdown trigger={['click']} open={accountOpen} onOpenChange={setAccountOpen} placement="bottomRight" menu={{items:[{key:'manage',label:'导航管理',icon:icon('sliders'),disabled:busy},...(!session.localPreview?[{type:'divider'},{key:'logout',label:'退出登录',icon:icon('right-from-bracket'),disabled:busy}]:[])],onClick:({key})=>{setAccountOpen(false);if(key==='manage')begin();else logout()}}}><button type="button" className="icon-button manager-trigger account-trigger" aria-label="账户菜单" aria-haspopup="menu" aria-expanded={accountOpen} disabled={busy&&!open}><img src="./assets/avatar-horse-thumb.png" alt="Hooper 头像" width="28" height="28"/>{dirty&&!open&&<span className="manager-trigger-dirty"/>}</button></Dropdown>:<button type="button" className="login-trigger" disabled={!session||busy} onClick={begin}>登录</button>}
    <Modal mask={{closable:false}} open={login} title={session?.configured?'登录':'设置管理密码'} onCancel={()=>{setLogin(false);credentials.resetFields();setError('')}} onOk={()=>credentials.submit()} okText={session?.configured?'登录':'设置'} cancelText="取消" confirmLoading={busy} width={360} destroyOnHidden>
      <Form form={credentials} layout="vertical" onFinish={authenticate} autoComplete="on">
        <Form.Item label="密码" name="password" rules={[{required:true,message:'请输入密码'},...(!session?.configured?[{min:10,max:128,message:'需为 10–128 位'}]:[])]}><Input.Password autoComplete={session?.configured?'current-password':'new-password'} placeholder={session?.configured?'':'至少 10 位'} maxLength={128}/></Form.Item>
        {!session?.configured&&<Form.Item label="确认密码" name="confirm" dependencies={['password']} rules={[{required:true,message:'请再次输入密码'},({getFieldValue})=>({validator:(_,value)=>value===getFieldValue('password')?Promise.resolve():Promise.reject(Error('两次密码不一致'))})]}><Input.Password autoComplete="new-password" maxLength={128}/></Form.Item>}
        {error&&<Alert type="error" showIcon title={error}/>}
      </Form>
    </Modal>
    <Drawer mask={{closable:!editor&&!login}} title={<span>导航管理{dirty&&<span className="manager-dirty" title="未保存" aria-label="未保存"/>}</span>} open={open} onClose={()=>setOpen(false)} size={560} className="navigation-manager" extra={!session?.localPreview&&<Tooltip title="退出登录"><Button type="text" aria-label="退出登录" disabled={busy} icon={icon('right-from-bracket')} onClick={logout}/></Tooltip>} footer={draft&&<div className="manager-footer"><Space size={2}><Tooltip title="撤销"><Button type="text" aria-label="撤销修改" disabled={!history.length||busy} icon={icon('rotate-left')} onClick={()=>{setDraft(history.at(-1));setHistory(history.slice(0,-1));setError('')}}/></Tooltip><Tooltip title="重新载入"><Button type="text" aria-label="重新载入导航" disabled={busy} icon={icon('rotate-right')} onClick={()=>{if(!dirty)load().catch(e=>setError(e.message));else modal.confirm({title:'放弃未保存的修改？',okText:'重新载入',cancelText:'取消',onOk:load})}}/></Tooltip><Tooltip title="导出备份"><Button type="text" aria-label="导出导航备份" disabled={busy} icon={icon('download')} onClick={exportData}/></Tooltip><Upload accept="application/json,.json" showUploadList={false} beforeUpload={importData} disabled={busy}><Tooltip title="导入备份"><Button type="text" aria-label="导入导航备份" disabled={busy} icon={icon('upload')}/></Tooltip></Upload></Space><Button type="primary" loading={busy} disabled={!dirty} onClick={publish}>保存</Button></div>} styles={{body:{padding:'0 20px 20px'}}}>
      <Tabs activeKey={tab} onChange={setTab} items={[{key:'links',label:'网站'},{key:'categories',label:'分类'}]}/>{list}
    </Drawer>
    <Modal zIndex={1100} mask={{closable:false}} open={!!editor} title={editor?.kind==='category'?'分类':editor?.item?'编辑网站':'新增网站'} onCancel={()=>setEditor(null)} onOk={()=>form.submit()} okText="完成" cancelText="取消" width={540} forceRender>
      <Form form={form} layout="vertical" onFinish={saveEditor} autoComplete="off">
        {editor?.kind==='category'?<Form.Item label="名称" name="name" rules={[{required:true,whitespace:true,message:'请输入名称'}]}><Input maxLength={20}/></Form.Item>:<>
          <div className="manager-fields"><Form.Item label="名称" name="title" rules={[{required:true,whitespace:true,message:'请输入名称'}]}><Input maxLength={100}/></Form.Item><Form.Item label="分类" name="cat" rules={[{required:true,message:'请选择分类'}]}><Select options={draft?.categories.map(item=>({value:item.id,label:item.name}))||[]}/></Form.Item></div>
          <Form.Item label="网址" name="url" rules={[{required:true,message:'请输入网址'},{validator:(_,value)=>{try{if(value)validUrl(value.trim());return Promise.resolve()}catch(e){return Promise.reject(e)}}}]}><Input placeholder="https://" maxLength={2000}/></Form.Item>
          <Form.Item label="说明" name="desc"><Input maxLength={200}/></Form.Item>
          <div className="manager-fields"><Form.Item label="图标网址" name="iconUrl"><Input placeholder="自动获取" maxLength={2000}/></Form.Item><Form.Item label="图标文字" name="mark"><Input maxLength={8}/></Form.Item></div>
          <Form.Item label="搜索别名" name="alias"><Input maxLength={100}/></Form.Item>
          <div className="manager-switches"><Form.Item label="隐藏" name="hidden" valuePropName="checked"><Switch/></Form.Item><Form.Item label="新增标记" name="new" valuePropName="checked"><Switch/></Form.Item></div>
        </>}
        {formError&&<Alert type="error" showIcon title={formError}/>}
      </Form>
    </Modal>
  </>;
}
