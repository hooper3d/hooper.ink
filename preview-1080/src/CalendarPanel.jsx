import { useState } from 'react';
import { Button, Calendar, Space, Tag } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { source, holidays, todayKey, lunarLabel, dayInfo } from './holidays';

const shortDate = key => `${Number(key.slice(5,7))}月${Number(key.slice(8))}日`;
export default function CalendarPanel() {
  const [date, setDate] = useState(() => dayjs(todayKey()));
  const key = date.format('YYYY-MM-DD'), info = dayInfo(key), month = date.format('YYYY-MM');
  const plans = holidays.flatMap(h => [
    ...(h.start.startsWith(month) || h.end.startsWith(month) ? [{key:h.start,text:`${shortDate(h.start)}—${shortDate(h.end)} · ${h.name}放假`}] : []),
    ...h.work.filter(d=>d.startsWith(month)).map(d=>({key:d,text:`${shortDate(d)} · ${h.name}补班`}))
  ]).sort((a,b)=>a.key.localeCompare(b.key));
  return <div className="calendar-content">
    <Calendar fullscreen={false} value={date} onSelect={setDate} onPanelChange={setDate}
      headerRender={()=><div className="calendar-toolbar"><strong aria-live="polite">{date.format('YYYY年 M月')}</strong><Space size={2}><Button className="nodrag" size="small" type="text" onClick={()=>setDate(dayjs(todayKey()))}>今天</Button><Button className="nodrag" type="text" size="small" aria-label="上个月" icon={<LeftOutlined/>} onClick={()=>setDate(date.subtract(1,'month'))}/><Button className="nodrag" type="text" size="small" aria-label="下个月" icon={<RightOutlined/>} onClick={()=>setDate(date.add(1,'month'))}/></Space></div>}
      fullCellRender={(current,renderInfo)=>{
        if(renderInfo.type!=='date')return renderInfo.originNode;
        const value=current.format('YYYY-MM-DD'), status=dayInfo(value);
        return <div className={`nodrag calendar-cell ${status.type} ${value===key?'selected':''} ${value===todayKey()?'today':''}`} title={`${value}，农历${lunarLabel(value,true)}，${status.label}`}><span>{current.date()}</span><small>{lunarLabel(value)}</small>{['holiday','work'].includes(status.type)&&<i className={`${status.type}-badge`}>{status.type==='holiday'?'休':'班'}</i>}</div>;
      }}/>
    <div className="calendar-legend"><span><Tag color="red">休</Tag>放假</span><span><Tag color="orange">班</Tag>补班</span><span>北京时间</span></div>
    <div className="calendar-selection" aria-live="polite"><strong>{date.format('M月D日 ddd')}<span>农历{lunarLabel(key,true)}</span></strong><p className={info.type}>{info.label}</p></div>
    <div className="calendar-schedule">{plans.length?plans.map(p=><p key={p.key}>{p.text}</p>):<p>{date.year()===2026?'本月没有额外放假或补班安排。':`${date.year()}年调休数据未收录，暂不标记休／班。`}</p>}</div>
    <div className="calendar-source">{date.year()===2026?<a className="nodrag" href={source} target="_blank" rel="noopener">依据国务院办公厅 2026 年放假通知</a>:'放假与补班以国务院办公厅正式通知为准。'}</div>
  </div>;
}
