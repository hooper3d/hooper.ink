// Adapted from the preserved Demo: same Ant Design calendar and holiday/lunar data.
import {useEffect,useRef,useState} from 'react';
import {Button,Calendar,Space,Tag} from 'antd';
import {LeftOutlined,RightOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {source,holidays,todayKey,lunarLabel,dayInfo} from '../../preview-1080/src/holidays';

const shortDate=key=>`${Number(key.slice(5,7))}月${Number(key.slice(8))}日`;
export default function CalendarPanel(){
  const [date,setDate]=useState(()=>dayjs(todayKey()));
  const surface=useRef(null),keyboardMove=useRef(false);
  const key=date.format('YYYY-MM-DD'),info=dayInfo(key),month=date.format('YYYY-MM');
  useEffect(()=>{if(keyboardMove.current){surface.current?.querySelector('.calendar-cell.selected')?.focus();keyboardMove.current=false}},[key]);
  const plans=holidays.flatMap(h=>[
    ...(h.start.startsWith(month)||h.end.startsWith(month)?[{key:h.start,text:`${shortDate(h.start)}—${shortDate(h.end)} · ${h.name}`}]:[]),
    ...h.work.filter(d=>d.startsWith(month)).map(d=>({key:d,text:`${shortDate(d)} · 补班`}))
  ]).sort((a,b)=>a.key.localeCompare(b.key));
  function navigate(event,current){
    const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-((current.day()+6)%7),End:6-((current.day()+6)%7)};
    if(!(event.key in offsets)&&!['PageUp','PageDown'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();keyboardMove.current=true;
    setDate(event.key==='PageUp'?current.subtract(1,'month'):event.key==='PageDown'?current.add(1,'month'):current.add(offsets[event.key],'day'));
  }
  return <div ref={surface} className="calendar-content">
    <Calendar fullscreen={false} value={date} onSelect={setDate} onPanelChange={setDate}
      headerRender={()=><div className="calendar-toolbar"><strong aria-live="polite">{date.format('YYYY年 M月')}</strong><Space size={2}><Button size="small" type="text" onClick={()=>setDate(dayjs(todayKey()))}>今天</Button><Button type="text" size="small" aria-label="上个月" icon={<LeftOutlined/>} onClick={()=>setDate(date.subtract(1,'month'))}/><Button type="text" size="small" aria-label="下个月" icon={<RightOutlined/>} onClick={()=>setDate(date.add(1,'month'))}/></Space></div>}
      fullCellRender={(current,renderInfo)=>{
        if(renderInfo.type!=='date')return renderInfo.originNode;
        const value=current.format('YYYY-MM-DD'),status=dayInfo(value),label=`${value}，农历${lunarLabel(value,true)}，${status.label}`;
        return <button type="button" className={`calendar-cell ${status.type} ${value===key?'selected':''} ${value===todayKey()?'today':''}`} title={label} aria-label={label} aria-pressed={value===key} aria-current={value===todayKey()?'date':undefined} tabIndex={value===key?0:-1} onClick={event=>{event.stopPropagation();setDate(current)}} onKeyDown={event=>navigate(event,current)}><span>{current.date()}</span><small>{lunarLabel(value)}</small>{['holiday','work'].includes(status.type)&&<i className={`${status.type}-badge`}>{status.type==='holiday'?'休':'班'}</i>}</button>;
      }}/>
    <div className="calendar-legend"><span><Tag color="red">休</Tag></span><span><Tag color="orange">班</Tag></span><span>北京时间</span></div>
    <div className="calendar-selection" aria-live="polite"><strong>{date.format('M月D日 ddd')}<span>农历{lunarLabel(key,true)}</span></strong><p>{info.label}</p></div>
    <div className="calendar-schedule">{plans.length?plans.map(p=><p key={p.key}>{p.text}</p>):date.year()!==2026?<p>{date.year()} 调休待更新</p>:null}</div>
    <div className="calendar-source">{date.year()===2026?<a href={source} target="_blank" rel="noopener" title="国务院办公厅关于2026年部分节假日安排的通知">2026 放假安排</a>:null}</div>
  </div>;
}
