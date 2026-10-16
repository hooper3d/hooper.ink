import {useEffect,useState} from 'react';

export const WEATHER_URL='https://api.open-meteo.com/v1/forecast?latitude=32.06&longitude=118.80&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FShanghai&forecast_days=7';
export function condition(code,isDay=true){
  const period=isDay?'day':'night';
  if(code===0)return {label:'晴',icon:`clear-${period}`};
  if(code===1)return {label:'晴间多云',icon:`partly-cloudy-${period}`};
  if(code===2)return {label:'多云',icon:`partly-cloudy-${period}`};
  if(code===3)return {label:'阴',icon:'overcast'};
  if([45,48].includes(code))return {label:code===48?'雾凇':'雾',icon:'fog'};
  if([51,53,55].includes(code))return {label:'毛毛雨',icon:'drizzle'};
  if([56,57,66,67].includes(code))return {label:'冻雨',icon:'sleet'};
  if([61,63,65].includes(code))return {label:{61:'小雨',63:'中雨',65:'大雨'}[code],icon:'rain'};
  if([71,73,75,77].includes(code))return {label:{71:'小雪',73:'中雪',75:'大雪',77:'米雪'}[code],icon:'snow'};
  if([80,81,82].includes(code))return {label:'阵雨',icon:'rain'};
  if([85,86].includes(code))return {label:'阵雪',icon:'snow'};
  if([95,96,97,99].includes(code))return {label:[96,99].includes(code)?'雷雨伴冰雹':'雷阵雨',icon:'thunderstorms'};
  return {label:'天气未知',icon:'not-available'};
}
export const degrees=value=>Number.isFinite(value)?`${Math.round(value)}°`:'—';
export function parseWeather(data){
  const c=data?.current,d=data?.daily;
  if(!Number.isFinite(c?.temperature_2m)||!Number.isInteger(c?.weather_code)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(c?.time)||!Array.isArray(d?.time)||d.time.length!==7)throw Error('天气数据暂不可用');
  const days=d.time.map((date,i)=>{
    const min=d.temperature_2m_min?.[i],max=d.temperature_2m_max?.[i],code=d.weather_code?.[i],rain=d.precipitation_probability_max?.[i];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(min)||!Number.isFinite(max)||min>max||!Number.isInteger(code))throw Error('预报数据暂不可用');
    return {date,min,max,code,rain:Number.isFinite(rain)?rain:null};
  });
  return {current:{temperature:c.temperature_2m,feels:c.apparent_temperature,humidity:c.relative_humidity_2m,code:c.weather_code,isDay:c.is_day!==0,time:c.time},days};
}
export default function useWeather(){
  const [weather,setWeather]=useState(null),[weatherError,setError]=useState(false),[weatherLoading,setLoading]=useState(true),[version,setVersion]=useState(0);
  useEffect(()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);let active=true;setLoading(true);setError(false);
    fetch(WEATHER_URL,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(parseWeather).then(data=>{if(active)setWeather(data)}).catch(()=>{if(active)setError(true)}).finally(()=>{clearTimeout(timeout);if(active)setLoading(false)});
    return()=>{active=false;clearTimeout(timeout);controller.abort()};
  },[version]);
  useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')setVersion(v=>v+1)},15*60*1000);return()=>clearInterval(timer)},[]);
  return {weather,weatherError,weatherLoading,reloadWeather:()=>setVersion(v=>v+1)};
}
