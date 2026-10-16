import {useState} from 'react';
import {App,Button,Dropdown,Form,Input,Modal} from 'antd';
import {CheckOutlined,DownOutlined,SaveOutlined,CopyOutlined,UndoOutlined,ReloadOutlined,ExportOutlined,ImportOutlined,DeleteOutlined,HomeOutlined,EditOutlined,LayoutOutlined} from '@ant-design/icons';
import {activeScheme,isAdjusted,resetNodes} from './layout';

export default function SchemeMenu({layouts,activate,getView,onExport,onImport,compact=false}){
  const {message,modal}=App.useApp(),[dialog,setDialog]=useState(null),[form]=Form.useForm();
  const {scheme,store,commit,gestureActive}=layouts,adjusted=isAdjusted(scheme);
  function notify(text){message.success({content:text,key:'layout-action',duration:3})}
  function save(){if(commit(next=>{const current=activeScheme(next);current.draft.home=current.draft.home||getView();current.saved={nodes:structuredClone(current.draft.nodes),home:current.draft.home}}))notify('方案已保存，可随时恢复到这个版本')}
  function begin(mode){form.resetFields();form.setFieldsValue({name:mode==='rename'?scheme.name:''});setDialog(mode)}
  function submit({name}){
    name=name.trim();
    if(layouts.storeRef.current.schemes.some(s=>s.name===name&&(dialog!=='rename'||s.id!==layouts.storeRef.current.active))){form.setFields([{name:'name',errors:['已经有同名方案']}]);return}
    if(commit(next=>{if(dialog==='rename')activeScheme(next).name=name;else{const draft=structuredClone(activeScheme(next).draft);draft.home=draft.home||getView();const id=crypto.randomUUID();next.schemes.push({id,name,draft,saved:{nodes:structuredClone(draft.nodes),home:draft.home}});next.active=id}})){setDialog(null);activate();notify(dialog==='rename'?'方案已重命名':'新方案已保存')}
  }
  function action({key}){
    if(key.startsWith('scheme:')){if(commit(next=>{next.active=key.slice(7)})){activate()}return}
    if(key==='save')return save();
    if(key==='copy'||key==='rename')return begin(key);
    if(key==='restore'){if(commit(next=>{const current=activeScheme(next);current.draft={...structuredClone(current.saved),viewport:current.saved.home}})){activate();notify('已恢复上次保存的方案，可以撤销')}return}
    if(key==='reset'){if(commit(next=>{const draft=activeScheme(next).draft;draft.nodes=resetNodes(draft.nodes);draft.home=null;draft.viewport=null})){activate();notify('已复位，网站和新增组件均保留，可以撤销')}return}
    if(key==='home'){if(commit(next=>{activeScheme(next).draft.home=getView()}))notify('已将当前视野设为首页');return}
    if(key==='export')return onExport();
    if(key==='import')return onImport();
    if(key==='delete')modal.confirm({title:`删除「${scheme.name}」方案？`,content:'只删除这个布局方案，网站、便签、待办、图片和其他方案都会保留。',okText:'删除方案',cancelText:'取消',okButtonProps:{danger:true},onOk:()=>{if(commit(next=>{next.schemes=next.schemes.filter(s=>s.id!==next.active);next.active=next.schemes[0].id})){activate();notify('方案已删除，可以撤销')}}});
  }
  const items=[...store.schemes.map(s=>({key:`scheme:${s.id}`,label:s.name,icon:s.id===store.active?<CheckOutlined/>:<span style={{width:14,display:'inline-block'}}/>})),{type:'divider'},
    {key:'save',label:'保存当前方案',icon:<SaveOutlined/>},{key:'copy',label:'另存为新方案…',icon:<CopyOutlined/>,disabled:store.schemes.length>=32},{key:'rename',label:'重命名…',icon:<EditOutlined/>},
    {key:'restore',label:'恢复上次保存',icon:<UndoOutlined/>,disabled:scheme.locked||!adjusted},{key:'reset',label:'一键复位',icon:<ReloadOutlined/>,disabled:scheme.locked},{key:'home',label:'将当前视野设为首页',icon:<HomeOutlined/>},{type:'divider'},
    {key:'export',label:'导出完整备份',icon:<ExportOutlined/>},{key:'import',label:'导入备份…',icon:<ImportOutlined/>},{key:'delete',label:'删除当前方案',icon:<DeleteOutlined/>,danger:true,disabled:store.schemes.length===1}];
  return <><Dropdown trigger={['click']} disabled={gestureActive} menu={{items,onClick:action}}><Button type={compact?'text':'default'} className={compact?'rail-button scheme-button':'scheme-button'} aria-label="布局方案">{compact?<LayoutOutlined/>:<span className="scheme-name">{scheme.name}</span>}{adjusted&&<span className="scheme-dirty" title="布局已自动保存；可手动保存为新的恢复点"/>}{!compact&&<DownOutlined/>}</Button></Dropdown><Modal title={dialog==='rename'?'重命名方案':'另存为新方案'} open={!!dialog} onCancel={()=>setDialog(null)} onOk={()=>form.submit()} okText="保存" cancelText="取消" forceRender width={380}><Form form={form} onFinish={submit} layout="vertical"><Form.Item name="name" label="方案名称" rules={[{required:true,whitespace:true,message:'请输入方案名称'}]}><Input maxLength={40} placeholder="例如：日常、创作、工作" onPressEnter={()=>form.submit()}/></Form.Item><p className="manage-note">每个方案保留自己的布局和首页视野，网站和个人组件内容共用。</p></Form></Modal></>;
}
