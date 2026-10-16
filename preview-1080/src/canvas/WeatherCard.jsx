import {useState} from 'react';
import {Button,Modal,Tooltip} from 'antd';
import {ReloadOutlined} from '@ant-design/icons';
import {useCanvas} from './Widgets';
import {condition,degrees} from './weather';
import {weatherIcons} from './weather-icons';

function WeatherIcon({code,isDay=true}){
  const {icon}=condition(code,isDay);
  return <picture className="weather-icon"><source media="(prefers-reduced-motion: reduce)" srcSet={weatherIcons[icon][1]}/><img src={weatherIcons[icon][0]} alt="" draggable={false}/></picture>;
}
export default function WeatherCard(){
  const {weather,weatherError,weatherLoading,reloadWeather}=useCanvas(),[open,setOpen]=useState(false);
  const current=weather?.current,days=weather?.days||[],status=current&&condition(current.code,current.isDay);
  const dateLabel=date=>new Intl.DateTimeFormat('zh-CN',{weekday:'short',timeZone:'Asia/Shanghai'}).format(new Date(`${date}T12:00:00+08:00`));
  return <section className="weather-widget" aria-label="南京天气">
    <header className="weather-heading"><span>南京</span><Tooltip title="刷新天气"><Button className="nodrag" size="small" type="text" aria-label="刷新天气" disabled={weatherLoading} icon={<ReloadOutlined spin={weatherLoading}/>} onClick={reloadWeather}/></Tooltip></header>
    {current?<><button className="weather-current" aria-label="查看南京七日天气预报" onClick={()=>setOpen(true)}><div><strong>{degrees(current.temperature)}<small>C</small></strong><span>{status.label}</span></div><WeatherIcon code={current.code} isDay={current.isDay}/></button><div className="weather-meta">体感 {degrees(current.feels)} · 湿度 {Number.isFinite(current.humidity)?`${current.humidity}%`:'—'}</div><footer className="weather-footer"><Button className="nodrag" type="text" size="small" onClick={()=>setOpen(true)}>七日预报</Button><a className="nodrag" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a></footer>{weatherError&&<small className="weather-error">更新失败 · 保留 {current.time.slice(5).replace('T',' ')} 数据</small>}</>:<div className="weather-unavailable"><WeatherIcon code={null}/><span>{weatherLoading?'正在读取天气…':'天气暂不可用'}</span>{weatherError&&<Button className="nodrag" size="small" onClick={reloadWeather}>重试</Button>}</div>}
    <Modal title="南京 · 七日天气" open={open} onCancel={()=>setOpen(false)} footer={null} width={520}>
      {current&&<><div className="forecast-summary"><WeatherIcon code={current.code} isDay={current.isDay}/><div><strong>{degrees(current.temperature)} <span>{status.label}</span></strong><p>{current.time.slice(5).replace('T',' ')} · 北京时间{weatherError?' · 更新失败，显示上次数据':''}</p></div></div><div className="forecast-labels"><span>日期</span><span>天气</span><span>低温 / 高温</span><span>降水概率</span></div><div className="forecast-days">{days.map((day,i)=><div className="forecast-day" key={day.date}><div><strong>{i===0&&day.date===current.time.slice(0,10)?'今天':dateLabel(day.date)}</strong><small>{day.date.slice(5).replace('-','/')}</small></div><div className="forecast-condition"><WeatherIcon code={day.code}/><span>{condition(day.code).label}</span></div><span className="forecast-temperature">{degrees(day.min)} <b>/ {degrees(day.max)}</b></span><span className="forecast-rain">{day.rain===null?'—':`${Math.round(day.rain)}%`}</span></div>)}</div></>}
      <p className="forecast-credit">预报：<a className="nodrag" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · 图标：<a className="nodrag" href="https://github.com/basmilius/meteocons" target="_blank" rel="noopener noreferrer">Meteocons</a></p>
    </Modal>
  </section>;
}
