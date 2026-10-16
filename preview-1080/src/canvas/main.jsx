import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ReactFlow,Background,BackgroundVariant,ReactFlowProvider} from '@xyflow/react';
import {App,Alert,Button,ConfigProvider,Drawer,Empty,Form,InputNumber,Modal,Popover,Segmented,Select,Space,Tooltip,theme} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {AppstoreOutlined,CheckOutlined,ExpandOutlined,ExportOutlined,FolderOpenOutlined,HomeOutlined,LockOutlined,UnlockOutlined,MinusOutlined,PlusOutlined,RedoOutlined,SearchOutlined,SettingOutlined,SkinOutlined,UndoOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '@xyflow/react/dist/style.css';
import '../style.css';
import './style.css';
import Manager from '../Manager';
import {KEY,validateData} from '../model';
import {activeScheme,LAYOUT_KEY,SPECS,validateLayouts,widget} from './layout';
import useNavigation from './useNavigation';
import useLayouts from './useLayouts';
import {CanvasContext,WidgetNode,WidgetBody,SiteLink,SearchBox,WidgetMenu} from './Widgets';
import SchemeMenu from './SchemeMenu';
import useContent,{CONTENT_KEY,CONTENT_KINDS,validateContent} from './content';
import {LEGACY_KINDS} from './scratchpad-data';
import {mergeScratchpads,migrateStoredScratchpads} from './migrateScratchpads';

dayjs.locale('zh-cn');
const nodeTypes={widget:WidgetNode};
const EMPTY_EDGES=[];
const migrationError=migrateStoredScratchpads();
const ACCENTS={blue:{name:'蓝色',light:'#397ce6',dark:'#79adff'},green:{name:'青绿',light:'#268875',dark:'#69c9b1'},violet:{name:'紫色',light:'#8062bd',dark:'#baa0ef'},amber:{name:'琥珀',light:'#ac7728',dark:'#dfb86a'},gray:{name:'石墨',light:'#626d7e',dark:'#b0bac9'}};
function CanvasPage({dark,setDark,accent,setAccent}){
  const nav=useNavigation(),layouts=useLayouts(),content=useContent(),{message,modal}=App.useApp();
  const [savedSource,setSavedSource]=useState('new');
  const [addOpen,setAddOpen]=useState(false),[kind,setKind]=useState('collection'),[source,setSource]=useState('all');
  const [editId,setEditId]=useState(null),[nodeForm]=Form.useForm(),[zoom,setZoom]=useState(1);
  const [mobile,setMobile]=useState(()=>matchMedia('(max-width:700px)').matches);
  const flow=useRef(null),surface=useRef(null),importInput=useRef(null),quickInput=useRef(null);
  const {store,nodes,scheme}=layouts;
  const editing=!scheme.locked;
  function homeView(){const rect=surface.current?.getBoundingClientRect()||{width:1200,height:800};const zoom=Math.max(.65,Math.min(1,(rect.width-64)/1144,(rect.height-160)/828));return {x:(rect.width-1144*zoom)/2,y:80,zoom}}
  const getView=()=>flow.current?.getViewport()||scheme.draft.viewport||homeView();
  function toggleLock(){
    if(layouts.gestureActive)return;
    const locked=activeScheme(layouts.storeRef.current).locked;
    if(layouts.commit(next=>{const current=activeScheme(next);current.locked=!locked;if(!locked){current.draft.home=getView();current.saved={nodes:structuredClone(current.draft.nodes),home:current.draft.home}}},false))message.success(locked?'已解锁，可以自由摆放':'布局已锁定，当前方案已保存');
  }
  function activate(){const current=activeScheme(layouts.storeRef.current);flow.current?.setViewport(current.draft.viewport||current.draft.home||homeView(),{duration:0})}
  function goHome(){flow.current?.setViewport(activeScheme(layouts.storeRef.current).draft.home||homeView(),{duration:220});if(mobile)surface.current?.scrollTo({top:0,behavior:'smooth'})}
  function saveView(_,viewport){setZoom(viewport.zoom);if(!layouts.gestureActive)layouts.updateDraft(draft=>{draft.viewport=viewport},false)}
  function focusNode(node){flow.current?.setCenter(node.position.x+node.width/2,node.position.y+node.height/2,{zoom:1,duration:220})}
  function addWidget(){if(!editing)return;const view=getView(),rect=surface.current?.getBoundingClientRect()||{width:1100,height:720},spec=SPECS[kind];const x=Math.round(((rect.width/2-view.x)/view.zoom-spec.width/2)/16)*16,y=Math.round(((rect.height/2-view.y)/view.zoom-spec.height/2)/16)*16;let ref=['collection','site'].includes(kind)?source:'';if(CONTENT_KINDS.includes(kind)){ref=savedSource==='new'?content.create(kind):savedSource;if(!ref)return}const node=widget(kind,crypto.randomUUID(),x,y,ref);if(layouts.updateDraft(draft=>{draft.nodes.push(node)})){setAddOpen(false);focusNode(node)}}
  function duplicateNode(id){if(!editing)return;const n=layouts.nodesRef.current.find(x=>x.id===id);if(!n)return;let source=n.data.source;if(CONTENT_KINDS.includes(n.data.kind)){const original=content.ref.current.items.find(x=>x.id===source);if(!original)return;source=content.create(n.data.kind,original);if(!source)return}layouts.updateDraft(draft=>{draft.nodes.push({...structuredClone(draft.nodes.find(x=>x.id===id)),id:crypto.randomUUID(),data:{...n.data,source},position:{x:n.position.x+32,y:n.position.y+32}})})}
  function removeNode(id){if(!editing)return;if(layouts.updateDraft(draft=>{draft.nodes=draft.nodes.filter(n=>n.id!==id)}))message.success('已从当前画布移除，内容仍保留，可撤销或重新添加')}
  function editNode(id){if(!editing)return;const node=layouts.nodesRef.current.find(n=>n.id===id);if(node){nodeForm.setFieldsValue({x:node.position.x,y:node.position.y,width:node.width,height:node.height,source:node.data.source});setEditId(id)}}
  const editTarget=nodes.find(n=>n.id===editId),editSpec=editTarget&&SPECS[editTarget.data.kind];
  function saveNode(values){if(!editing)return;if(layouts.updateDraft(draft=>{const n=draft.nodes.find(n=>n.id===editId);if(!n)throw Error('组件已不存在');n.position={x:values.x,y:values.y};n.width=values.width;n.height=values.height;if(values.source!==undefined)n.data.source=values.source})){setEditId(null)}}
  function sourceOptions(type){return type==='site'?nav.db.links.map(x=>({value:x.id,label:x.title})):[{value:'all',label:'全部网站'},{value:'favorites',label:'常用网站'},...nav.db.categories.map(c=>({value:c.id,label:c.name}))]}
  function locate(item){const match=nodes.find(n=>n.data.kind==='site'&&n.data.source===item.id)||nodes.find(n=>n.data.kind==='collection'&&(n.data.source===item.cat||n.data.source==='all'||n.data.source==='favorites'&&nav.db.favorites.includes(item.id)));if(match){nav.setQuickSearch(false);if(mobile)document.getElementById(`mobile-${match.id}`)?.scrollIntoView({behavior:'smooth'});else focusNode(match)}else message.info('这个网站还没有放到当前画布，可以直接打开，或添加一个入口。')}
  function exportAll(){const raw=JSON.stringify({format:'hooper-canvas-backup',version:2,navigation:nav.db,layouts:layouts.storeRef.current,content:content.ref.current},null,2),url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`hooper-canvas-${dayjs().format('YYYY-MM-DD')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function importAll(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{
      if(file.size>12*1024*1024)throw Error('备份不能超过 12 MB');
      const input=JSON.parse(await file.text());if(input.format!=='hooper-canvas-backup'||![1,2].includes(input.version))throw Error('请选择画布版导出的完整备份');
      const nextDb=validateData(input.navigation),merged=mergeScratchpads(validateLayouts(input.layouts),input.version===2?validateContent(input.content):content.ref.current),nextLayouts=merged.layouts,nextContent=merged.content;
      const references=nextLayouts.schemes.flatMap(s=>[...s.saved.nodes,...s.draft.nodes]).filter(n=>CONTENT_KINDS.includes(n.data.kind));
      if(references.some(n=>!nextContent.items.some(x=>x.id===n.data.source&&x.kind===n.data.kind)))throw Error('备份缺少组件内容，未导入');
      modal.confirm({title:'导入画布备份',content:`包含 ${nextLayouts.schemes.length} 个方案、${nextDb.links.length} 个网站、${nextContent.items.length} 份个人组件内容。确认后会替换当前浏览器的数据，建议先导出备份。`,okText:'确认导入',cancelText:'取消',onOk:()=>{
        const before=localStorage.getItem(KEY),beforeContent=localStorage.getItem(CONTENT_KEY);
        try{
          localStorage.setItem(CONTENT_KEY,JSON.stringify(nextContent));localStorage.setItem(KEY,JSON.stringify(nextDb));
          if(!layouts.replace(nextLayouts))throw Error('方案未能保存');
          content.adopt(nextContent);nav.adopt(nextDb);activate();message.success('方案、网站和个人组件已导入');
        }catch(e){
          try{if(before===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,before);if(beforeContent===null)localStorage.removeItem(CONTENT_KEY);else localStorage.setItem(CONTENT_KEY,beforeContent)}catch{message.error('回滚未完成，请保留备份并刷新检查')}
          message.error(`导入失败：${e.message}`);return Promise.reject(e);
        }
      }});
    }catch(e){message.error(e instanceof SyntaxError?'无法读取这份 JSON 备份':e.message)}
  }
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('hooper-v2-theme',dark?'dark':'light')}catch{}},[dark]);
  useEffect(()=>{const mq=matchMedia('(max-width:700px)'),handler=()=>setMobile(mq.matches);mq.addEventListener('change',handler);return()=>mq.removeEventListener('change',handler)},[]);
  useEffect(()=>{const handler=e=>{if(document.querySelector('.ant-modal-wrap:not([style*="display: none"])')||nav.managerOpen||addOpen)return;const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||document.activeElement?.isContentEditable;if(!typing&&(e.key==='/'||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')){e.preventDefault();nav.setQuickSearch(true)}if(!typing&&editing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)layouts.redo();else layouts.undo()}if(e.key==='Escape')setEditId(null)};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler)},[nav.managerOpen,addOpen,layouts.historyVersion,editing]);
  useEffect(()=>{if(!mobile&&flow.current)activate()},[store.active,mobile]);
  const quickResults=nav.db.links.filter(x=>`${x.title} ${x.desc} ${x.alias}`.toLowerCase().includes(nav.query.trim().toLowerCase()));
  const context={...nav,content,editing,mobile,toggleLock,compactZoom:!mobile&&zoom<.55,beginGesture:layouts.beginGesture,endGesture:layouts.endGesture,gestureActive:layouts.gestureActive,duplicateNode,removeNode,editNode};
  return <CanvasContext.Provider value={context}><div className={`canvas-page ${editing?'arranging':''}`}>
    <aside className="canvas-rail" aria-label="主导航">
      <Tooltip title="Hooper Navigation" placement="right"><button className="rail-logo" aria-label="Hooper Navigation" onClick={goHome}><svg viewBox="0 0 28 28" width="25" height="25" aria-hidden="true"><path d="M5 4h4v9l10-5V4h4v20h-4V13L9 18v6H5z" fill="currentColor"/></svg></button></Tooltip>
      <nav className="rail-navigation" aria-label="画布工具"><Tooltip title="画布首页" placement="right"><Button type="text" className="rail-button active" aria-label="画布首页" icon={<AppstoreOutlined/>} onClick={goHome}/></Tooltip><Tooltip title="搜索网站 /" placement="right"><Button type="text" className="rail-button" aria-label="全局搜索" icon={<SearchOutlined/>} onClick={()=>nav.setQuickSearch(true)}/></Tooltip><Tooltip title="添加组件" placement="right"><Button type="text" className="rail-button" disabled={!editing} aria-label="添加组件到画布" icon={<PlusOutlined/>} onClick={()=>{setAddOpen(true)}}/></Tooltip><span className="rail-divider"/><Tooltip title="网站与分类" placement="right"><Button type="text" className="rail-button" aria-label="管理导航" icon={<FolderOpenOutlined/>} onClick={()=>nav.openManager()}/></Tooltip><Tooltip title={`布局方案 · ${scheme.name}`} placement="right"><span className="rail-schemes"><SchemeMenu compact layouts={layouts} activate={activate} getView={getView} onExport={exportAll} onImport={()=>importInput.current?.click()}/></span></Tooltip></nav>
      <div className="rail-bottom"><Popover trigger="click" placement="rightBottom" title="配色" content={<div className="canvas-appearance"><Segmented block aria-label="明暗模式" value={dark?'dark':'light'} onChange={value=>setDark(value==='dark')} options={[{label:'浅色',value:'light'},{label:'深色',value:'dark'}]}/><div className="accent-options">{Object.entries(ACCENTS).map(([key,color])=><button key={key} aria-label={`${color.name}主题`} aria-pressed={accent===key} className="accent-swatch" style={{background:color[dark?'dark':'light']}} onClick={()=>setAccent(key)}>{accent===key&&<CheckOutlined/>}</button>)}</div></div>}><Button type="text" className="rail-button" aria-label="配色" icon={<SkinOutlined/>}/></Popover><Tooltip title="设置" placement="right"><Button type="text" className="rail-button" aria-label="设置" icon={<SettingOutlined/>} onClick={()=>nav.openManager('appearance')}/></Tooltip><Tooltip title="切换经典版" placement="right"><Button type="text" className="rail-button" aria-label="经典版" href="/" icon={<ExportOutlined/>}/></Tooltip></div>
    </aside>
    <section className="canvas-workspace" aria-label="Hooper Navigation">
    <div className="canvas-title"><AppstoreOutlined/><h1>Hooper Navigation</h1></div><div className="canvas-top-status"><span className="current-scheme">{scheme.name}</span><Tooltip title={layouts.saveError||content.error||'内容与布局自动保存在当前浏览器；可导出完整备份'}><span className={`layout-status ${layouts.saveError||content.error?'error':''}`}>{layouts.saveError||content.error?'保存异常':<><CheckOutlined/><span>已自动保存</span></>}</span></Tooltip></div>
    {(layouts.saveError||content.error)&&<Alert className="canvas-save-alert" type="error" title={layouts.saveError||content.error} showIcon action={content.error&&<Space><Button size="small" onClick={content.retry}>重试保存</Button><Button size="small" onClick={exportAll}>导出备份</Button></Space>}/>}
    {migrationError&&<Alert className="canvas-save-alert" type="warning" title={migrationError} showIcon/>}
    <main className="canvas-surface" ref={surface} aria-label="个人导航画布">
      {mobile?<div className="mobile-widgets">{scheme.draft.nodes.map(n=><article id={`mobile-${n.id}`} key={n.id} className={`mobile-widget widget-${n.data.kind} ${n.data.kind==='note'?`surface-${content.data.items.find(x=>x.id===n.data.source)?.tone||'paper'}`:''} ${content.data.items.find(x=>x.id===n.data.source)?.borderless?'surface-plain':''}`}><WidgetMenu node={n} trigger={['click']}><Button type="text" size="small" className="mobile-widget-menu" aria-label="组件操作">···</Button></WidgetMenu><WidgetBody node={n}/></article>)}</div>:<ReactFlow nodes={nodes.map(n=>({...n,style:{pointerEvents:'all'},draggable:editing,selectable:editing,connectable:false}))} edges={EMPTY_EDGES} nodeTypes={nodeTypes} onNodesChange={layouts.onNodesChange} onNodeDragStart={layouts.beginGesture} onNodeDragStop={layouts.endGesture} onInit={instance=>{flow.current=instance;instance.setViewport(scheme.draft.viewport||scheme.draft.home||homeView())}} onMoveEnd={saveView} onViewportChange={view=>setZoom(view.zoom)} minZoom={.25} maxZoom={2} panOnScroll={false} panOnDrag={[0,1,2]} zoomOnScroll zoomOnPinch zoomOnDoubleClick={false} selectionOnDrag={false} nodesConnectable={false} edgesFocusable={false} nodesFocusable={editing} deleteKeyCode={null} colorMode={dark?'dark':'light'} snapToGrid={false} snapGrid={[16,16]} ariaLabelConfig={{'node.a11yDescription.default':'按方向键移动组件。','controls.zoomIn.ariaLabel':'放大','controls.zoomOut.ariaLabel':'缩小'}}><Background variant={BackgroundVariant.Dots} gap={24} size={1} color={dark?'#344054':'#d3dce8'}/></ReactFlow>}
      {!nodes.length&&<div className="canvas-empty"><Empty description="桌面留白，放上你常用的东西"><Button type="primary" disabled={!editing} onClick={()=>{setAddOpen(true)}}>添加组件</Button></Empty></div>}
    </main>
    <div className="canvas-dock canvas-zoom-dock"><Tooltip title="回到首页视野，不改变布局"><Button type="text" aria-label="回到首页视野" icon={<HomeOutlined/>} onClick={goHome}/></Tooltip>{!mobile&&<><Button type="text" aria-label="缩小画布" icon={<MinusOutlined/>} onClick={()=>flow.current?.zoomOut({duration:150})}/><button className="zoom-label" title="恢复 100%" onClick={()=>flow.current?.zoomTo(1,{duration:150})}>{Math.round(zoom*100)}%</button><Button type="text" aria-label="放大画布" icon={<PlusOutlined/>} onClick={()=>flow.current?.zoomIn({duration:150})}/><Tooltip title="查看全部组件"><Button type="text" aria-label="查看全部组件" icon={<ExpandOutlined/>} onClick={()=>flow.current?.fitView({padding:.12,duration:220,minZoom:.25,maxZoom:1})}/></Tooltip></>}</div>
    <div className="canvas-dock canvas-tool-dock"><Tooltip title={editing?'锁定位置并保存当前方案':'解锁后可继续摆放'}><Button type="text" className="arrange-button" aria-label={editing?'锁定并保存':'解锁布局'} aria-pressed={!editing} disabled={layouts.gestureActive} onClick={toggleLock} icon={editing?<UnlockOutlined/>:<LockOutlined/>}>{editing?'锁定并保存':'已锁定'}</Button></Tooltip><i/><Tooltip title="撤销布局调整"><Button type="text" aria-label="撤销布局调整" disabled={!editing||!layouts.canUndo||layouts.gestureActive} icon={<UndoOutlined/>} onClick={()=>{layouts.undo();activate()}}/></Tooltip><Tooltip title="重做布局调整"><Button type="text" aria-label="重做布局调整" disabled={!editing||!layouts.canRedo||layouts.gestureActive} icon={<RedoOutlined/>} onClick={()=>{layouts.redo();activate()}}/></Tooltip><i/><Tooltip title="添加组件"><Button type="text" disabled={!editing} aria-label="添加组件" icon={<PlusOutlined/>} onClick={()=>{setAddOpen(true)}}/></Tooltip></div>
    <Drawer title="添加组件" open={addOpen} onClose={()=>setAddOpen(false)} size={380}><p className="manage-note">放在当前视野中央，再拖到喜欢的位置。</p><div className="widget-picker">{Object.entries(SPECS).filter(([key])=>!LEGACY_KINDS.includes(key)).map(([key,spec])=><Button key={key} type={kind===key?'primary':'default'} onClick={()=>{setKind(key);setSavedSource('new');setSource(key==='site'?nav.db.links[0]?.id||'':'all')}}>{spec.title}</Button>)}</div>{['collection','site'].includes(kind)&&<Form.Item label={kind==='site'?'选择网站':'集合内容'}><Select style={{width:'100%'}} showSearch optionFilterProp="label" aria-label="组件内容" value={source} onChange={setSource} options={sourceOptions(kind)}/></Form.Item>}{CONTENT_KINDS.includes(kind)&&<Form.Item label="已保存内容"><Select aria-label="已保存内容" value={savedSource} onChange={setSavedSource} options={[{value:'new',label:`新建${SPECS[kind].title}`},...content.data.items.filter(x=>x.kind===kind).map((x,i)=>({value:x.id,label:x.title||(x.text?.slice(0,24))||`${SPECS[kind].title} ${i+1}`}))]}/></Form.Item>}<p className="manage-note">内容自动保存在此浏览器。移出画布后，可从已保存内容再次添加。</p><Button type="primary" block disabled={!editing||kind==='site'&&!nav.db.links.length||nodes.length>=500} onClick={addWidget}>放到画布</Button></Drawer>
    <Modal title="调整组件" open={!!editTarget} onCancel={()=>setEditId(null)} onOk={()=>nodeForm.submit()} okText="应用" cancelText="取消" forceRender width={420}><Form form={nodeForm} layout="vertical" onFinish={saveNode}>{editTarget&&['collection','site'].includes(editTarget.data.kind)&&<Form.Item name="source" label="显示内容"><Select showSearch optionFilterProp="label" options={sourceOptions(editTarget.data.kind)}/></Form.Item>}<div className="field-pair">{[['x','横向位置'],['y','纵向位置'],['width','宽度'],['height','高度']].map(([name,label])=><Form.Item key={name} name={name} label={label} rules={[{required:true,message:'请输入数值'}]}><InputNumber style={{width:'100%'}} precision={0} min={name==='width'?editSpec?.minWidth:name==='height'?editSpec?.minHeight:undefined} max={['width','height'].includes(name)?4000:undefined} step={16}/></Form.Item>)}</div><p className="manage-note">拖动卡片空白处移动，选中后拖动四角改变大小。</p></Form></Modal>
    <Modal title="搜索网站" open={nav.quickSearch} onCancel={()=>nav.setQuickSearch(false)} footer={null} width={620} afterOpenChange={open=>{if(open)quickInput.current?.querySelector('input')?.focus()}}><div ref={quickInput}><SearchBox/></div><div className="quick-results">{quickResults.length?quickResults.map(item=><div className="quick-result" key={item.id}><SiteLink item={item}/><Button size="small" type="text" onClick={()=>locate(item)}>定位</Button></div>):<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的网站"/>}</div></Modal>
    <Manager open={nav.managerOpen} onClose={()=>nav.setManagerOpen(false)} tab={nav.manageTab} setTab={nav.setManageTab} db={nav.db} change={nav.change} undo={nav.undo}/>
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importAll}/>
  </section></div></CanvasContext.Provider>;
}
function Root(){const [dark,setDark]=useState(()=>document.documentElement.dataset.theme==='dark'),[accent,setAccent]=useState(()=>{try{const saved=localStorage.getItem('hooper-canvas-accent-v1');return Object.hasOwn(ACCENTS,saved)?saved:'blue'}catch{return 'blue'}});const primary=ACCENTS[accent][dark?'dark':'light'];useEffect(()=>{document.documentElement.style.setProperty('--blue',primary);document.documentElement.style.setProperty('--blue-light',`color-mix(in srgb, ${primary} ${dark?'17':'9'}%, ${dark?'#182336':'white'})`);try{localStorage.setItem('hooper-canvas-accent-v1',accent)}catch{}},[accent,dark,primary]);return <ConfigProvider locale={zhCN} theme={{algorithm:dark?theme.darkAlgorithm:theme.defaultAlgorithm,token:{colorPrimary:primary,colorBgContainer:dark?'#182336':'#ffffff',colorText:dark?'#d9e3f3':'#263750',colorTextSecondary:dark?'#8b9db6':'#8794a7',colorBorder:dark?'#273750':'#e4ebf4',borderRadius:9,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif'},components:{Button:{controlHeight:34},Modal:{borderRadiusLG:16}}}}><App><ReactFlowProvider><CanvasPage dark={dark} setDark={setDark} accent={accent} setAccent={setAccent}/></ReactFlowProvider></App></ConfigProvider>}
createRoot(document.getElementById('root')).render(<Root/>);
