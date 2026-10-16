import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, Button, Card, ConfigProvider, Empty, Input, Popover, Segmented, Select, Space, Tooltip, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { CalendarOutlined, MoonOutlined, SunOutlined, SearchOutlined, SlidersOutlined, StarOutlined, StarFilled, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { KEY, defaults, validateData } from './model';
import { todayKey } from './holidays';
import CalendarPanel from './CalendarPanel';
import Manager from './Manager';
import SiteIcon from './SiteIcon';
import './style.css';

dayjs.locale('zh-cn');
const engines={google:'https://www.google.com/search?q=',bing:'https://www.bing.com/search?q=',baidu:'https://www.baidu.com/s?wd=',github:'https://github.com/search?q='};
const poems=[['行到水穷处，坐看云起时。','唐 · 王维《终南别业》'],['且将新火试新茶。诗酒趁年华。','宋 · 苏轼《望江南·超然台作》'],['山气日夕佳，飞鸟相与还。','晋 · 陶渊明《饮酒·其五》']];

function Navigation({dark,setDark}) {
  const {message,modal}=AntApp.useApp();
  const [initial]=useState(()=>{try{const saved=localStorage.getItem(KEY);return{db:saved?validateData(JSON.parse(saved)):structuredClone(defaults)}}catch{return{db:structuredClone(defaults),error:'本地记录未能读取，当前展示原始导航。原记录未覆盖。'}}});
  const [db,setDb]=useState(initial.db), dbRef=useRef(initial.db);
  const [category,setCategory]=useState('all'),[query,setQuery]=useState(''),[mode,setMode]=useState('local'),[engine,setEngine]=useState('google');
  const [managerOpen,setManagerOpen]=useState(false),[manageTab,setManageTab]=useState('links');
  const [calendarOpen,setCalendarOpen]=useState(false),[weatherOpen,setWeatherOpen]=useState(false),[today,setToday]=useState(todayKey);
  const [weather,setWeather]=useState(null),[weatherError,setWeatherError]=useState(false),[poem,setPoem]=useState(poems[0]);
  const inputRef=useRef(null),poemIndex=useRef(0);
  const avatar=db.avatar||'assets/avatar.png';
  function change(mutator,onError) {
    try{const copy=structuredClone(dbRef.current),result=mutator(copy),next=validateData(result||copy);try{localStorage.setItem(KEY,JSON.stringify(next))}catch{throw Error('无法保存，请检查浏览器存储设置，或导出备份。')}dbRef.current=next;setDb(next);message.destroy('undo');return true}catch(e){if(onError)onError(e);else message.error(e.message);return false}
  }
  function undo(text,before){message.open({key:'undo',type:'success',duration:10,content:<Space>{text}<Button type="link" size="small" onClick={()=>change(()=>before)}>撤销</Button></Space>})}
  function toggleFavorite(id){return change(next=>{if(!next.links.some(x=>x.id===id))throw Error('网站不存在');next.favorites=next.favorites.includes(id)?next.favorites.filter(x=>x!==id):[...next.favorites,id]})}
  function loadPoem(){const fallback=()=>{poemIndex.current=(poemIndex.current+1)%poems.length;setPoem(poems[poemIndex.current])};if(window.jinrishici)window.jinrishici.load(r=>{if(r.status==='success')setPoem([r.data.content,`${r.data.origin.dynasty} · ${r.data.origin.author}《${r.data.origin.title}》`]);else fallback()},fallback);else fallback()}
  useEffect(()=>{if(initial.error)message.warning(initial.error);const script=document.createElement('script');script.src='https://sdk.jinrishici.com/v2/browser/jinrishici.js';script.async=true;script.onload=loadPoem;document.head.append(script);return()=>{script.onload=null;script.remove()}},[]);
  useEffect(()=>{document.querySelector('link[rel="icon"]').href=avatar},[avatar]);
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('hooper-v2-theme',dark?'dark':'light')}catch{}},[dark]);
  useEffect(()=>{if(!['all','favorites',...db.categories.map(x=>x.id)].includes(category))setCategory('all')},[db.categories,category]);
  useEffect(()=>{let active=true;fetch('https://wttr.in/Nanjing?format=j1',{signal:AbortSignal.timeout(6500)}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(!data.current_condition?.[0]||!Number.isFinite(Number(data.current_condition[0].temp_C)))throw Error();if(active)setWeather(data)}).catch(()=>{if(active)setWeatherError(true)});return()=>{active=false}},[]);
  useEffect(()=>{const handler=e=>{if(e.key==='/'&&!managerOpen&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();inputRef.current?.focus()}if(e.key==='Escape'){setCalendarOpen(false);setWeatherOpen(false)}};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler)},[managerOpen]);
  useEffect(()=>{const handler=()=>{if(!document.hidden)setToday(todayKey())};document.addEventListener('visibilitychange',handler);return()=>document.removeEventListener('visibilitychange',handler)},[]);
  useEffect(()=>{if(!document.modelContext?.registerTool)return;const lifecycle=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'set_navigation_favorite',title:'设置导航收藏',description:'将已有网站加入或移出当前浏览器的常用收藏，同时更新页面。',inputSchema:{type:'object',properties:{title:{type:'string'},favorite:{type:'boolean'}},required:['title','favorite'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(typeof input?.title!=='string'||typeof input.favorite!=='boolean')throw Error('需要网站名称和收藏状态');const matches=dbRef.current.links.filter(x=>x.title===input.title);if(matches.length!==1)throw Error('网站名称不存在或不唯一');const id=matches[0].id;if(dbRef.current.favorites.includes(id)!==input.favorite&&!toggleFavorite(id))throw Error('收藏未能保存');return{title:matches[0].title,favorite:dbRef.current.favorites.includes(id)}}},{signal:lifecycle.signal})).catch(()=>{})}catch{}return()=>lifecycle.abort()},[]);
  function search(e){e.preventDefault();const q=query.trim();if(!q){inputRef.current?.focus();return}const shortcuts={'!g':engines.google,'!b':engines.bing,'!bd':engines.baidu,'!gh':engines.github,'!d':'https://duckduckgo.com/?q=','!y':'https://www.youtube.com/results?search_query=','!tb':'https://s.taobao.com/search?q=','!zh':'https://www.zhihu.com/search?type=content&q='};const [prefix,...words]=q.split(/\s+/);if(shortcuts[prefix]&&words.length)window.open(shortcuts[prefix]+encodeURIComponent(words.join(' ')),'_blank','noopener');else if(mode==='web')window.open(engines[engine]+encodeURIComponent(q),'_blank','noopener')}
  const searchText=mode==='local'?query.trim().toLowerCase():'';
  const filtered=db.links.filter(x=>(category==='all'||category==='favorites'&&db.favorites.includes(x.id)||x.cat===category)&&(!searchText||`${x.title} ${x.desc} ${x.alias}`.toLowerCase().includes(searchText))).sort((a,b)=>Number(db.favorites.includes(b.id))-Number(db.favorites.includes(a.id)));
  const categories=[{id:'all',name:'全部'},{id:'favorites',name:'常用'},...db.categories];
  const weatherContent=weather?<>{weather.weather.slice(0,3).map(d=><div className="forecast-row" key={d.date}><span>{d.date.slice(5)}</span><span>{d.mintempC}° — {d.maxtempC}°</span></div>)}</>:weatherError?'天气暂时不可用。':'正在读取天气…';
  return <>
    <a href="#search" className="skip">跳到搜索</a>
    <header className="header"><div className="header-inner"><div className="brand"><Tooltip title="更换头像"><button className="brand-avatar" aria-label="更换站点头像" onClick={()=>{setManageTab('appearance');setManagerOpen(true)}}><img src={avatar} width="42" height="42" alt="站点头像"/></button></Tooltip><a href="./"><h1>Hooper Navigation</h1></a></div>
      <div className="header-actions"><Popover trigger="click" placement="bottomRight" open={calendarOpen} onOpenChange={open=>{setCalendarOpen(open);if(open){setToday(todayKey());setWeatherOpen(false)}}} content={<CalendarPanel/>} styles={{container:{padding:16,maxWidth:'calc(100vw - 24px)'}}}><Button type="text" className="calendar-trigger" aria-label="展开中国节假日日历" aria-expanded={calendarOpen} icon={<CalendarOutlined/>}><span className="calendar-date">{dayjs(today).format('M月D日')}</span></Button></Popover>
        <Popover trigger="click" open={weatherOpen} onOpenChange={open=>{setWeatherOpen(open);if(open)setCalendarOpen(false)}} content={<div className="forecast">{weatherContent}</div>} placement="bottomRight"><Button type="text" className="weather">南京{weather?` ${weather.current_condition[0].temp_C}°C`:' · 天气'}</Button></Popover>
        <a className="blog-link" href="https://www.hooper.ink/blog/" target="_blank" rel="noopener">博客</a><Tooltip title={dark?'切换为浅色':'切换为深色'}><Button type="text" className="header-icon" aria-label="切换深浅色" icon={dark?<SunOutlined/>:<MoonOutlined/>} onClick={()=>setDark(!dark)}/></Tooltip><Tooltip title="管理导航"><Button type="text" className="header-icon" aria-label="管理导航" icon={<SlidersOutlined/>} onClick={()=>setManagerOpen(true)}/></Tooltip>
      </div></div></header>
    <main className="container"><section className="start" aria-label="搜索与诗词"><button className="poetry" onClick={loadPoem} title="换一句诗词" aria-label="换一句诗词"><span className="poem-line">{poem[0]}</span><span className="poem-source">{poem[1]}</span><ReloadOutlined className="poem-refresh"/></button>
      <form onSubmit={search} role="search"><div className="search-box"><Input ref={inputRef} id="search" size="large" variant="borderless" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setQuery('')}} prefix={<SearchOutlined/>} suffix={<kbd>/</kbd>} placeholder="搜索工具、网站…" aria-label="搜索网站" allowClear/><Button htmlType="submit" className="search-button" aria-label="搜索" icon={<SearchOutlined/>}/></div><div className="search-under"><Space size={8}><Segmented size="small" value={mode} onChange={setMode} options={[{label:'站内',value:'local'},{label:'全网',value:'web'}]}/>{mode==='web'&&<Select size="small" aria-label="搜索引擎" value={engine} onChange={setEngine} options={['Google','Bing','百度','GitHub'].map((label,i)=>({label,value:Object.keys(engines)[i]}))}/>}</Space><span>{mode==='web'?'回车在新标签页搜索':'输入即筛选 · Esc 清空'}</span></div></form>
    </section>
    <nav className="filters" aria-label="网站分类">{categories.map(c=><Button key={c.id} className="filter" type={category===c.id?'primary':'text'} aria-pressed={category===c.id} icon={c.id==='favorites'?<StarOutlined/>:undefined} onClick={()=>setCategory(c.id)}>{c.name}</Button>)}</nav>
    <div className="results-bar"><span>{searchText?'搜索结果':category==='all'?'全部网站':categories.find(c=>c.id===category)?.name}</span><small>{filtered.length}</small></div>
    {filtered.length?<div className="grid">{filtered.map(item=><Card key={item.id} className="card" styles={{body:{padding:0}}}><a className="card-link" href={item.url} target={item.url==='#'?undefined:'_blank'} rel="noopener" onClick={e=>{if(item.url==='#'){e.preventDefault();modal.info({title:item.title,content:item.title==='查学区'?'在微信小程序里搜索「查学区」。':item.desc||'此条目暂未添加网址。',okText:'知道了'})}}}><SiteIcon item={item}/><div className="card-copy"><div className="card-title">{item.title}</div><div className="card-desc" title={item.desc}>{item.desc}</div></div></a><Tooltip title={db.favorites.includes(item.id)?'取消收藏':'加入常用'}><Button type="text" className={`favorite ${db.favorites.includes(item.id)?'active':''}`} aria-label={`${db.favorites.includes(item.id)?'取消收藏':'收藏'} ${item.title}`} aria-pressed={db.favorites.includes(item.id)} icon={db.favorites.includes(item.id)?<StarFilled/>:<StarOutlined/>} onClick={()=>toggleFavorite(item.id)}/></Tooltip></Card>)}</div>:<div className="empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={category==='favorites'&&!query?'点击网站右上角的星标，把常用的留在这里。':'没有找到匹配的网站'}><Button onClick={()=>{setQuery('');setCategory('all')}}>查看全部</Button></Empty></div>}
    <footer><span>Hooper Navigation</span><div className="footer-links"><a href="canvas.html">画布版</a><span>·</span><a href="https://www.hooper.ink/" target="_blank" rel="noopener">原站</a><span>·</span><Button type="text" size="small" onClick={()=>setManagerOpen(true)}>管理导航</Button></div></footer></main>
    <Manager open={managerOpen} onClose={()=>setManagerOpen(false)} tab={manageTab} setTab={setManageTab} db={db} change={change} undo={undo}/>
  </>;
}

function Root(){const [dark,setDark]=useState(()=>document.documentElement.dataset.theme==='dark');return <ConfigProvider locale={zhCN} theme={{algorithm:dark?theme.darkAlgorithm:theme.defaultAlgorithm,token:{colorPrimary:dark?'#79adff':'#397ce6',colorBgContainer:dark?'#182336':'#ffffff',colorText:dark?'#d9e3f3':'#263750',colorTextSecondary:dark?'#8b9db6':'#8794a7',colorBorder:dark?'#273750':'#e4ebf4',borderRadius:9,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif'},components:{Button:{controlHeight:36},Card:{borderRadiusLG:13},Drawer:{paddingLG:24},Modal:{borderRadiusLG:16}}}}><AntApp><Navigation dark={dark} setDark={setDark}/></AntApp></ConfigProvider>}
createRoot(document.getElementById('root')).render(<Root/>);
