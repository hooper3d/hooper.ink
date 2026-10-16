import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ReactFlow} from '@xyflow/react';
import {App,Button,ConfigProvider,Popover,Segmented,Tooltip,theme} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {AppstoreOutlined,FolderOpenOutlined,LockOutlined,SearchOutlined,SkinOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '@xyflow/react/dist/style.css';
import './style.css';
import './canvas/style.css';
import './preview.css';
import useNavigation from './canvas/useNavigation';
import {CanvasContext,WidgetBody} from './canvas/Widgets';
import sample from './preview-content.json';
import hooperLogo from '../assets/hooper.svg';

dayjs.locale('zh-cn');
const VIEW={x:0,y:0,zoom:1};
const THEMES={
  dark:{name:'深石墨',bg:'#141516',surface:'#222426',hover:'#2C2F32',line:'#3D4248',text:'#E6E9ED',muted:'#AAB2BC',accent:'#CED5DF'},
  light:{name:'原站浅色',bg:'#F1F5FB',surface:'#F8FAFD',hover:'#E4ECF7',line:'#C9D5E5',text:'#263750',muted:'#5C6F89',accent:'#356AB1'},
};
const COLOR_LABELS={bg:'画布',surface:'表面',hover:'悬停',line:'边界',text:'正文',muted:'次级文字',accent:'强调'};
function PreviewNode({data}){
  return <article className={`widget widget-${data.kind}`} aria-label={data.label}><div className="widget-body nopan"><WidgetBody node={{data}}/></div></article>;
}
const nodeTypes={widget:PreviewNode};
function arrange(width,height){
  const narrow=width<1400,gap=narrow?40:64;
  const right=Math.max(264,Math.min(340,width*.18)),notes=Math.max(264,Math.min(340,width*.188));
  const left=width-right-notes-gap*2,top=narrow?152:168,bodyY=top+(narrow?24:28);
  const profile=notes,searchX=notes+gap,centerWidth=left;
  const make=(kind,x,y,w,h,label,source='')=>({id:kind,type:'widget',position:{x,y},style:{width:w,height:h,pointerEvents:'all','--column-gap':`${gap}px`,'--body-offset':`${bodyY}px`},data:{kind,label,source},draggable:false,selectable:false,focusable:false});
  return [
    make('profile',0,0,profile,top,'个人名片'),
    make('search',searchX,0,centerWidth,56,'搜索'),
    make('poetry',searchX,80,centerWidth,top-80,'一句诗词'),
    make('weather',left+notes+gap*2,0,right,top,'南京天气'),
    make('scratchpad',0,bodyY,notes,height-bodyY,'随手记','preview-scratchpad'),
    make('collection',notes+gap,bodyY,left,height-bodyY,'网站导航','all'),
    make('calendar',left+notes+gap*2,bodyY,right,height-bodyY,'中国假日日历'),
  ];
}
function Desktop({appearance,setAppearance}){
  const nav=useNavigation(),surface=useRef(null),[size,setSize]=useState(null),[homeRevision,setHomeRevision]=useState(0);
  useEffect(()=>{const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(surface.current);return()=>observer.disconnect()},[]);
  const nodes=size?arrange(size.width,size.height):[];
  const context={...nav,search:e=>{e.preventDefault();surface.current?.querySelector('.canvas-link>a')?.focus()},homeRevision,readOnly:true,editing:false,mobile:false,compactZoom:false,content:{data:sample}};
  const focusSearch=()=>surface.current?.querySelector('input[aria-label="搜索网站"]')?.focus();
  useEffect(()=>{const handler=e=>{const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||document.activeElement?.isContentEditable;if(!typing&&(e.key==='/'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'))){e.preventDefault();focusSearch()}};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler)},[]);
  return <CanvasContext.Provider value={context}><div className="canvas-page one-screen">
    <section className="canvas-workspace" aria-label="Hooper Navigation">
      <header className="preview-header">
        <a className="preview-brand" href="/" aria-label="Hooper Navigation 首页"><span className="site-logo" style={{'--brand-logo':`url(${JSON.stringify(hooperLogo)})`}} aria-hidden="true"/><h1>Hooper Navigation</h1></a>
        <div className="preview-header-tools"><span className="preview-date">{new Intl.DateTimeFormat('zh-CN',{dateStyle:'full',timeZone:'Asia/Shanghai'}).format(new Date())}</span>
          <nav className="preview-actions" aria-label="首页工具">
            <Tooltip title="首页"><Button type="text" aria-label="首页" icon={<AppstoreOutlined/>} onClick={()=>{nav.setQuery('');nav.setMode('local');setHomeRevision(x=>x+1)}}/></Tooltip>
            <Tooltip title="搜索网站 /"><Button type="text" aria-label="全局搜索" icon={<SearchOutlined/>} onClick={focusSearch}/></Tooltip>
            <Tooltip title="打开博客"><Button type="text" aria-label="打开博客" href="https://hooper.ink/blog/" target="_blank" rel="noopener" icon={<FolderOpenOutlined/>}/></Tooltip>
            <Popover trigger="click" placement="bottomRight" title="外观" content={<div className="appearance-panel"><Segmented block aria-label="界面配色" value={appearance} onChange={setAppearance} options={[{label:'深石墨',value:'dark'},{label:'原站浅色',value:'light'}]}/><div className="graphite-palette">{Object.entries(COLOR_LABELS).map(([key,label])=><div key={key}><i style={{background:THEMES[appearance][key]}}/><span>{label}</span><code>{THEMES[appearance][key]}</code></div>)}</div></div>}><Button type="text" aria-label="配色" icon={<SkinOutlined/>}/></Popover>
            <Tooltip title="当前为只读布局预览"><span><Button disabled type="text" aria-label="管理（只读预览）" icon={<LockOutlined/>}/></span></Tooltip>
          </nav>
        </div>
      </header>
      <main className="canvas-surface" ref={surface} aria-label="个人导航画布">
        {size&&<ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} viewport={VIEW} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} nodesFocusable={false} edgesFocusable={false} panOnDrag={false} panOnScroll={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} autoPanOnNodeFocus={false} autoPanOnNodeDrag={false} minZoom={1} maxZoom={1} deleteKeyCode={null} colorMode={appearance}/>}
      </main>
      <footer className="preview-footer"><span>Copyright © 2026 Hooper</span><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">苏ICP备2022029383号-1</a></footer>
    </section>
  </div></CanvasContext.Provider>;
}
function Root(){
  const [appearance,setAppearance]=useState(()=>{try{return localStorage.getItem('hooper-preview-appearance')==='light'?'light':'dark'}catch{return 'dark'}});
  const colors=THEMES[appearance];
  useLayoutEffect(()=>{document.documentElement.dataset.theme=appearance;try{localStorage.setItem('hooper-preview-appearance',appearance)}catch{}},[appearance]);
  return <ConfigProvider locale={zhCN} theme={{algorithm:appearance==='dark'?theme.darkAlgorithm:theme.defaultAlgorithm,token:{motion:false,colorPrimary:colors.accent,colorBgBase:colors.bg,colorBgContainer:colors.surface,colorBgElevated:colors.surface,colorText:colors.text,colorTextSecondary:colors.muted,colorTextLightSolid:appearance==='dark'?colors.bg:colors.surface,colorBorder:colors.line,colorBorderSecondary:colors.line,colorBgTextHover:colors.hover,borderRadius:9,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif'}}}><App><Desktop appearance={appearance} setAppearance={setAppearance}/></App></ConfigProvider>;
}
createRoot(document.getElementById('root')).render(<Root/>);
