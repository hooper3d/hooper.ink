import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ConfigProvider,Popover,theme} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import CalendarPanel from './CalendarPanel';
import {todayKey,lunarLabel} from '../../preview-1080/src/holidays';
import useWeather,{condition,degrees} from '../../preview-1080/src/canvas/weather';
import {weatherIcons} from '../../preview-1080/src/canvas/weather-icons';
import NavigationManager from './NavigationManager';
import {createPortal} from 'react-dom';
import MusicPlayer from './MusicPlayer';
import PrivateNotes from './PrivateNotes';
import Calculator from './Calculator';
import Dock from './vendor/react-bits-dock/Dock';
dayjs.locale('zh-cn');
const dateFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'short'});
const timeFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false});
function WeatherIcon({code,isDay=true}) {
  const icons=weatherIcons[condition(code,isDay).icon];
  return <picture className="meteo-icon"><source media="(prefers-reduced-motion: reduce)" srcSet={icons[1]}/><img src={icons[0]} alt="" draggable="false"/></picture>;
}
function Topbar(){
  const {weather,weatherError,weatherLoading,reloadWeather}=useWeather();
  const [open,setOpen]=useState(null),[now,setNow]=useState(new Date()),[dark,setDark]=useState(document.documentElement.classList.contains('dark'));
  const [session,setSession]=useState(null),[privateDirty,setPrivateDirty]=useState(false);
  useEffect(()=>{if(!session?.authenticated&&open&&open!=='weather')setOpen(null)},[session?.authenticated,open]);
  const weatherTrigger=useRef(null),calendarTrigger=useRef(null),weatherPanelRef=useRef(null),calendarPanelRef=useRef(null);
  useEffect(()=>{
    const observer=new MutationObserver(()=>setDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
    const timer=setInterval(()=>setNow(new Date()),30000);
    return()=>{observer.disconnect();clearInterval(timer)};
  },[]);
  useEffect(()=>{
    if(!open||['music','notes','calculator'].includes(open))return;
    const escape=event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(null);(open==='weather'?weatherTrigger:calendarTrigger).current?.focus()}};
    document.addEventListener('keydown',escape,true);
    return()=>document.removeEventListener('keydown',escape,true);
  },[open]);
  const current=weather?.current,status=current&&condition(current.code,current.isDay),key=todayKey();
  const tokens=getComputedStyle(document.documentElement),token=name=>tokens.getPropertyValue(name).trim();
  const dateLabel=date=>new Intl.DateTimeFormat('zh-CN',{weekday:'short',timeZone:'Asia/Shanghai'}).format(new Date(`${date}T12:00:00+08:00`));
  const weatherPanel=<section ref={weatherPanelRef} className="topbar-panel weather-panel" role="dialog" aria-label="南京七日天气">
    <header><strong>南京</strong><div className="panel-actions"><button className="icon-button" aria-label="刷新天气" disabled={weatherLoading} onClick={reloadWeather}><i className={`fas fa-rotate-right ${weatherLoading?'refreshing':''}`} aria-hidden="true"/></button><button className="icon-button" aria-label="关闭天气" onClick={()=>{setOpen(null);weatherTrigger.current?.focus()}}><i className="fas fa-xmark" aria-hidden="true"/></button></div></header>
    {current?<><div className="weather-overview"><div><div className="weather-degrees">{degrees(current.temperature)}<small>C</small></div><p>{status.label}<span>体感 {degrees(current.feels)} · 湿度 {Number.isFinite(current.humidity)?`${current.humidity}%`:'—'}</span></p></div><WeatherIcon code={current.code} isDay={current.isDay}/></div>
    <div className="seven-days">{weather.days.map(day=><div className="day-row" key={day.date}><span>{day.date===key?'今天':dateLabel(day.date)}<small>{day.date.slice(5).replace('-','/')}</small></span><span className="day-condition"><WeatherIcon code={day.code}/><span>{condition(day.code).label}</span></span><span className="day-temperatures">{degrees(day.min)}<b>{degrees(day.max)}</b></span><span className="rain-chance"><i className="fas fa-droplet" aria-label="降水概率"/> {day.rain===null?'—':`${Math.round(day.rain)}%`}</span></div>)}</div></>:<div className="weather-empty"><WeatherIcon code={null}/><p>{weatherLoading?'…':'天气暂不可用'}</p></div>}
    <div className="weather-source"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a><time>{current?`${current.time.slice(5).replace('T',' ')}${weatherError?' · 更新失败':''}`:weatherError?'点击刷新重试':''}</time><a href="https://github.com/basmilius/meteocons" target="_blank" rel="noopener noreferrer">Meteocons</a></div>
  </section>;
  const calendarPanel=<section ref={calendarPanelRef} className="topbar-panel calendar-panel" role="dialog" aria-label="日历"><CalendarPanel key={key}/></section>;
  const dockItems=[
    {id:'video',label:'影视',icon:<i className="fas fa-clapperboard" aria-hidden="true"/>,onClick:()=>window.open('https://tv.hooper.ink/','_blank','noopener,noreferrer')},
    {id:'music',label:'音乐',icon:<i className="fas fa-music" aria-hidden="true"/>,active:open==='music',renderItem:button=><MusicPlayer triggerElement={button} open={open==='music'} onOpenChange={value=>setOpen(value?'music':null)}/>},
    ...(session?.authenticated?[{id:'notes',label:'随手记',icon:<i className="fas fa-note-sticky" aria-hidden="true"/>,active:open==='notes',renderItem:button=><PrivateNotes triggerElement={button} session={session} onSessionChange={setSession} onDirtyChange={setPrivateDirty} open={open==='notes'} onOpenChange={value=>setOpen(value?'notes':null)}/>}]:[]),
    {id:'calendar',label:'日历',icon:<i className="far fa-calendar" aria-hidden="true"/>,active:open==='calendar',renderItem:button=><Popover open={open==='calendar'} onOpenChange={value=>setOpen(value?'calendar':null)} afterOpenChange={value=>{if(value)calendarPanelRef.current?.querySelector('.calendar-cell.selected')?.focus()}} trigger="click" placement="top" arrow={false} content={calendarPanel}>{React.cloneElement(button,{ref:node=>{button.props.ref(node);calendarTrigger.current=node},'aria-haspopup':'dialog','aria-expanded':open==='calendar'})}</Popover>},
    {id:'calculator',label:'计算器',icon:<i className="fas fa-calculator" aria-hidden="true"/>,active:open==='calculator',renderItem:button=><Calculator triggerElement={button} open={open==='calculator'} onOpenChange={value=>setOpen(value?'calculator':null)}/>}
  ];
  return <ConfigProvider locale={zhCN} theme={{algorithm:dark?theme.darkAlgorithm:theme.defaultAlgorithm,token:{motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,fontFamily:'Inter,"Noto Sans SC",sans-serif',colorPrimary:token('--accent'),colorText:token('--text'),colorTextLightSolid:dark?token('--bg'):token('--surface'),colorTextSecondary:token('--muted'),colorTextTertiary:token('--muted'),colorBgBase:token('--bg'),colorBgContainer:token('--surface'),colorBgElevated:token('--surface'),colorBorder:token('--line'),colorBorderSecondary:token('--line'),colorPrimaryBg:token('--selected'),borderRadius:10,boxShadowSecondary:'0 12px 40px #17213126'},components:{Calendar:{fullBg:token('--surface'),itemActiveBg:token('--selected')}}}}>
    <div className="topbar-tools">
      <Popover open={open==='weather'} onOpenChange={value=>setOpen(value?'weather':null)} afterOpenChange={value=>{if(value)weatherPanelRef.current?.querySelector('button')?.focus()}} trigger="click" placement="bottom" arrow={false} content={weatherPanel}>
        <button ref={weatherTrigger} className="topbar-trigger weather-trigger" aria-haspopup="dialog" aria-expanded={open==='weather'} aria-label={`南京${current?` ${status.label} ${degrees(current.temperature)}`:weatherLoading?'天气加载中':'天气暂不可用'}，查看七日预报`}><WeatherIcon code={current?.code} isDay={current?.isDay}/><span className="weather-city">南京</span><strong>{current?degrees(current.temperature):'—'}</strong></button>
      </Popover>
      <div className="topbar-trigger date-trigger" aria-label={`${dateFormat.format(now)} 农历${lunarLabel(key,true)} 北京时间${timeFormat.format(now)}`}><span className="header-clock">{timeFormat.format(now)}</span><span className="header-date">{dateFormat.format(now)}</span><span className="compact-date">{Number(key.slice(5,7))}/{Number(key.slice(8))}</span><span className="header-lunar">{lunarLabel(key,true)}</span></div>
      {createPortal(<NavigationManager session={session} onSessionChange={setSession} privateDirty={privateDirty}/>,document.getElementById('accountTools'))}
    </div>
    {session?.authenticated&&createPortal(<Dock className="hooper-dock" theme={dark?'dark':'light'} items={dockItems} baseItemSize={42} magnification={42} panelHeight={60} gap={16} roundness={.55} bounce={false} showBadges={false} style={{width:dockItems.length*54+(dockItems.length-1)*16+18,'--dock-panel':'var(--surface)','--dock-panel-edge':'var(--line)','--dock-panel-highlight':'var(--hover)','--dock-panel-shadow':'0 8px 28px #17213118','--dock-tile':'var(--icon-bg)','--dock-tile-edge':'var(--line)','--dock-tile-highlight':'var(--hover)','--dock-tile-shadow':'none','--dock-ink':'var(--text)','--dock-label':'var(--surface)','--dock-label-ink':'var(--text)','--dock-dot':'var(--accent)'}}/>,document.getElementById('desktopDock'))}
  </ConfigProvider>;
}
createRoot(document.getElementById('topbarTools')).render(<Topbar/>);

