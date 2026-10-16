import {createContext,useContext,useEffect,useState} from 'react';
import {App,Button,Dropdown,Empty,Input,Segmented,Select,Space} from 'antd';
import {SearchOutlined,StarOutlined,StarFilled,ReloadOutlined,ExportOutlined} from '@ant-design/icons';
import {NodeResizer} from '@xyflow/react';
import CalendarPanel from '../CalendarPanel';
import SiteIcon from '../SiteIcon';
import {SPECS} from './layout';
import PersonalWidget from './PersonalWidgets';
import WeatherCard from './WeatherCard';
import Scratchpad from './Scratchpad';

export const CanvasContext=createContext(null);
export const useCanvas=()=>useContext(CanvasContext);
export function nodeTitle(node,db){
  if(node.data.kind==='site')return db.links.find(x=>x.id===node.data.source)?.title||'网站已移除';
  if(node.data.kind==='collection')return node.data.source==='all'?'网站导航':node.data.source==='favorites'?'常用网站':db.categories.find(x=>x.id===node.data.source)?.name||'分类已移除';
  return SPECS[node.data.kind].title;
}
export function SiteLink({item}){
  const {db,toggleFavorite}=useCanvas(),{modal}=App.useApp();
  if(!item)return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="网站已移除，可重新选择一个入口"/>;
  const favorite=db.favorites.includes(item.id);
  return <div className="canvas-link"><a className="nodrag" href={item.url} target={item.url==='#'?undefined:'_blank'} rel="noopener" onClick={e=>{if(item.url==='#'){e.preventDefault();modal.info({title:item.title,content:item.title==='查学区'?'在微信小程序里搜索「查学区」。':item.desc,okText:'知道了'})}}}><SiteIcon item={item}/><div><strong>{item.title}</strong><small>{item.desc}</small></div><ExportOutlined className="destination-arrow" aria-hidden="true"/></a><Button size="small" type="text" className={favorite?'nodrag star active':'nodrag star'} aria-label={`${favorite?'取消收藏':'收藏'} ${item.title}`} aria-pressed={favorite} icon={favorite?<StarFilled/>:<StarOutlined/>} onClick={()=>toggleFavorite(item.id)}/></div>;
}
export function SearchBox({compact=false,showOptions=true}){
  const {query,setQuery,mode,setMode,search,engine,setEngine}=useCanvas();
  return <form onSubmit={search} role="search" className={compact?'canvas-search compact':'canvas-search'}><div className="search-box"><Input className="nodrag" aria-label="搜索网站" placeholder="搜索工具、网站…" variant="borderless" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setQuery('')}} prefix={<SearchOutlined/>} allowClear/>{!showOptions&&<kbd title="Ctrl / ⌘ + K，或 /">Ctrl K</kbd>}<Button htmlType="submit" aria-label="搜索" className="nodrag search-button" icon={<SearchOutlined/>}/></div>{showOptions&&!compact&&<div className="search-under"><Space size={8}><Segmented className="nodrag" size="small" options={[{label:'站内',value:'local'},{label:'全网',value:'web'}]} value={mode} onChange={setMode}/>{mode==='web'&&<Select className="nodrag" aria-label="搜索引擎" size="small" value={engine} onChange={setEngine} options={[['google','Google'],['bing','Bing'],['baidu','百度'],['github','GitHub']].map(([value,label])=>({value,label}))}/>}</Space><span>{mode==='local'?'输入即筛选':'回车搜索全网'}</span></div>}</form>;
}
function Collection({source}){
  const {db,query,mode,compactZoom,openManager,readOnly,homeRevision}=useCanvas(),[filter,setFilter]=useState('all');
  useEffect(()=>{setFilter('all')},[homeRevision]);
  const category=source==='all'?filter:source;
  const term=mode==='local'?query.trim().toLowerCase():'';
  const links=db.links.filter(x=>(category==='all'||category==='favorites'&&db.favorites.includes(x.id)||category===x.cat)&&(!term||`${x.title} ${x.desc} ${x.alias}`.toLowerCase().includes(term))).sort((a,b)=>Number(db.favorites.includes(b.id))-Number(db.favorites.includes(a.id)));
  const title=nodeTitle({data:{kind:'collection',source}},db);
  return <section className="collection-widget"><div className="collection-heading"><strong>{title}</strong><span aria-live="polite" aria-atomic="true">{links.length}</span>{!readOnly&&<Button className="nodrag" type="text" size="small" onClick={()=>openManager('links')}>管理</Button>}</div>{source==='all'&&!compactZoom&&<div className="collection-tabs nowheel"><Segmented className="nodrag" size="small" options={[{value:'all',label:'全部'},{value:'favorites',label:'常用'},...db.categories.map(c=>({value:c.id,label:c.name}))]} value={filter} onChange={setFilter}/></div>}{compactZoom?<div className="collection-overview">{links.slice(0,9).map(x=><SiteIcon key={x.id} item={x}/>)}</div>:<div className="collection-scroll nowheel">{links.length?<div className="collection-links">{links.map(item=><SiteLink key={item.id} item={item}/>)}</div>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={category==='favorites'&&!term?'收藏的网站会出现在这里':'没有匹配的网站'}/>}</div>}</section>;
}
export function WidgetBody({node}){
  const {db,poem,loadPoem,openManager,readOnly}=useCanvas();
  switch(node.data.kind){
    case 'scratchpad':return <Scratchpad node={node}/>;
    case 'note':case 'todo':case 'inbox':case 'image':return <PersonalWidget node={node}/>;
    case 'profile':return <div className="profile-widget"><button className="brand-avatar nodrag" disabled={readOnly} aria-label={readOnly?'站点头像':'更换站点头像'} onClick={()=>openManager('appearance')}><img src={db.avatar||'assets/avatar.png'} width="48" height="48" alt="Hooper 头像"/></button><div><strong>Hooper Navigation</strong><a className="nodrag" href="https://www.hooper.ink/blog/" target="_blank" rel="noopener">我的博客 <ExportOutlined/></a></div></div>;
    case 'poetry':return <button className="poetry canvas-poem" onClick={loadPoem} aria-label="换一句诗词"><span className="poem-line">{poem[0]}</span><span className="poem-source">{poem[1]}</span><ReloadOutlined className="poem-refresh"/></button>;
    case 'search':return <SearchBox showOptions={false}/>;
    case 'weather':return <WeatherCard/>;
    case 'calendar':return <CalendarPanel/>;
    case 'collection':return <Collection source={node.data.source}/>;
    case 'site':return <SiteLink item={db.links.find(x=>x.id===node.data.source)}/>;
    default:return null;
  }
}
export function WidgetMenu({node,children,trigger=['contextMenu']}){
  const {editing,gestureActive,duplicateNode,removeNode,editNode,toggleLock}=useCanvas();
  const disabled=!editing||gestureActive;
  const items=[{key:'edit',label:'调整尺寸和位置',disabled},{key:'copy',label:'复制组件',disabled},{key:'remove',label:'从画布移除',disabled},{type:'divider'},{key:'lock',label:editing?'锁定并保存方案':'解锁布局',disabled:gestureActive}];
  return <Dropdown trigger={trigger} menu={{items,onClick:({key})=>{if(key==='lock')toggleLock();else if(!disabled)({edit:editNode,copy:duplicateNode,remove:removeNode})[key]?.(node.id)}}}>{children}</Dropdown>;
}
export function WidgetNode({id,data,selected}){
  const {editing,db,content,beginGesture,endGesture}=useCanvas();
  const spec=SPECS[data.kind],node={id,data},title=nodeTitle(node,db);
  const item=content.data.items.find(x=>x.id===data.source);
  return <WidgetMenu node={node}><article className={`widget widget-${data.kind} ${data.kind==='note'?`surface-${item?.tone||'paper'}`:''} ${item?.borderless?'surface-plain':''} ${selected?'selected':''}`} aria-label={title}>
    <NodeResizer isVisible={editing&&selected} minWidth={spec.minWidth} minHeight={spec.minHeight} maxWidth={4000} maxHeight={4000} onResizeStart={beginGesture} onResizeEnd={endGesture}/>
    <div className="widget-body nopan"><WidgetBody node={node}/></div>
  </article></WidgetMenu>;
}
