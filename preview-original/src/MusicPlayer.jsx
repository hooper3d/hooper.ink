import {cloneElement,useEffect,useRef,useState} from 'react';
import {Popover,Tooltip} from 'antd';
import {Howl} from 'howler';
import {loadPlaylist,savePlaylist} from './music-library';

const icon=name=><i className={`fas fa-${name}`} aria-hidden="true"/>;
const clock=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
const formats=new Set(['mp3','mpeg','opus','ogg','oga','wav','aac','m4a','mp4','weba','webm','flac']);
export default function MusicPlayer({open,onOpenChange,triggerElement}){
  const [tracks,setTracks]=useState([]),[current,setCurrent]=useState(null),[state,setState]=useState('idle');
  const [position,setPosition]=useState(0),[duration,setDuration]=useState(0),[volume,setVolume]=useState(()=>{try{const value=Number(localStorage.getItem('hooper_music_volume')??.6);return Number.isFinite(value)?Math.min(1,Math.max(0,value)):.6}catch{return .6}});
  const [repeat,setRepeat]=useState(false),[error,setError]=useState(''),[dragging,setDragging]=useState(false);
  const [restoring,setRestoring]=useState(true),[restoreFailed,setRestoreFailed]=useState(false),[saving,setSaving]=useState(false),[storageError,setStorageError]=useState('');
  const sound=useRef(null),queue=useRef([]),active=useRef(null),volumeRef=useRef(volume),repeatRef=useRef(repeat),input=useRef(null),trigger=useRef(null),panel=useRef(null),dragDepth=useRef(0);
  const alive=useRef(true),writes=useRef(Promise.resolve()),saveVersion=useRef(0);
  const track=tracks.find(item=>item.id===current),playing=state==='playing';
  useEffect(()=>{
    restore();
    return()=>{alive.current=false;sound.current?.unload();queue.current.forEach(item=>URL.revokeObjectURL(item.url))};
  },[]);
  useEffect(()=>{if(!saving)return;const warn=event=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[saving]);
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>{const value=sound.current?.seek();if(typeof value==='number')setPosition(value)},250);return()=>clearInterval(timer)},[playing]);
  useEffect(()=>{if(!open)return;const escape=event=>{if(event.key==='Escape'){event.stopPropagation();onOpenChange(false);trigger.current?.focus()}};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true)},[open,onOpenChange]);
  async function restore(){
    setRestoring(true);setStorageError('');
    try{
      const saved=await loadPlaylist();if(!alive.current)return;
      if(!Array.isArray(saved)||saved.some(item=>!(item.file instanceof Blob)||!formats.has(item.format)))throw Error('本地歌单格式无效');
      const next=saved.map(item=>({...item,url:URL.createObjectURL(item.file)}));
      queue.current=next;setTracks(next);setRestoreFailed(false);if(next.length)select(next[0],false);
    }catch{if(alive.current){setRestoreFailed(true);setStorageError('无法恢复本地歌单，请重试')}}finally{if(alive.current)setRestoring(false)}
  }
  function select(item,play=true){
    sound.current?.unload();active.current=item.id;setCurrent(item.id);setPosition(0);setDuration(0);setError('');setState('loading');
    const next=new Howl({src:[item.url],format:[item.format],html5:true,preload:false,volume:volumeRef.current,
      onload:()=>{if(sound.current===next){setDuration(next.duration());setState(next.playing()?'playing':'paused')}},
      onplay:()=>{if(sound.current===next){setState('playing');setError('')}},
      onpause:()=>{if(sound.current===next)setState('paused')},
      onloaderror:()=>{if(sound.current===next){setState('error');setError('无法播放，请检查音频格式')}},
      onplayerror:()=>{if(sound.current===next){setState('error');setError('播放未开始，点击重试')}},
      onend:()=>{if(sound.current!==next)return;if(repeatRef.current){next.seek(0);next.play()}else if(queue.current.length>1)step(1);else{next.seek(0);setPosition(0);setState('paused')}}
    });
    sound.current=next;next.load();if(play)next.play();
  }
  function step(direction){const index=queue.current.findIndex(item=>item.id===active.current);if(queue.current.length)select(queue.current[(index+direction+queue.current.length)%queue.current.length])}
  function toggle(){if(!track){input.current?.click();return}if(state==='error'){select(track);return}if(playing)sound.current.pause();else sound.current.play()}
  function persist(next){
    const snapshot=next.map(({url,...item})=>item),version=++saveVersion.current;setSaving(true);
    writes.current=writes.current.catch(()=>{}).then(()=>savePlaylist(snapshot)).then(()=>{if(alive.current&&version===saveVersion.current)setStorageError('')}).catch(e=>{if(alive.current&&version===saveVersion.current)setStorageError(e.name==='QuotaExceededError'?'浏览器空间不足，歌单未保存':'歌单未保存，请重试')}).finally(()=>{if(alive.current&&version===saveVersion.current)setSaving(false)});
  }
  function addFiles(files){
    if(restoring||restoreFailed)return;
    const next=[...queue.current];let rejected=false;
    for(const file of files){
      const format=file.name.split('.').pop().toLowerCase(),key=`${file.name}:${file.size}:${file.lastModified}`;
      if(!formats.has(format)||!file.size){rejected=true;continue}
      if(next.some(item=>item.key===key))continue;
      if(next.length>=100){rejected=true;break}
      next.push({id:crypto.randomUUID(),key,title:file.name.replace(/\.[^.]+$/,''),format,file,url:URL.createObjectURL(file)});
    }
    if(next.length!==queue.current.length)persist(next);
    queue.current=next;setTracks(next);if(!active.current&&next.length)select(next[0]);if(rejected)setError('支持常见音频文件，最多 100 首');
  }
  function remove(item){
    const index=queue.current.findIndex(value=>value.id===item.id),next=queue.current.filter(value=>value.id!==item.id),wasPlaying=sound.current?.playing();
    queue.current=next;setTracks(next);persist(next);
    if(active.current===item.id){if(next.length)select(next[Math.min(index,next.length-1)],!!wasPlaying);else{sound.current?.unload();sound.current=null;active.current=null;setCurrent(null);setState('idle');setPosition(0);setDuration(0);setError('')}}
    URL.revokeObjectURL(item.url);
  }
  function changeVolume(value){volumeRef.current=value;setVolume(value);sound.current?.volume(value);try{localStorage.setItem('hooper_music_volume',String(value))}catch{}}
  const content=<section ref={panel} className={`music-panel ${dragging?'is-dragging':''}`} role="dialog" aria-label="音乐播放器"
    onDragEnter={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();dragDepth.current++;setDragging(true)}}}
    onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy'}}}
    onDragLeave={event=>{if(event.dataTransfer.types.includes('Files')&&--dragDepth.current<=0){dragDepth.current=0;setDragging(false)}}}
    onDrop={event=>{event.preventDefault();dragDepth.current=0;setDragging(false);addFiles(event.dataTransfer.files)}}>
    <header><strong>音乐<span>{tracks.length||''}</span></strong><div className="panel-actions"><Tooltip title="添加本地歌曲"><button className="icon-button" aria-label="添加本地歌曲" disabled={restoring||restoreFailed} onClick={()=>input.current?.click()}>{icon('plus')}</button></Tooltip><button className="icon-button" aria-label="关闭播放器" onClick={()=>{onOpenChange(false);trigger.current?.focus()}}>{icon('xmark')}</button></div></header>
    {track?<><div className="music-now"><div className={`music-art ${playing?'is-playing':''}`} aria-hidden="true">{icon('music')}</div><div><strong title={track.title}>{track.title}</strong><small>{state==='loading'?'加载中':track.format.toUpperCase()}</small></div></div>
      <input className="music-range" aria-label="播放进度" type="range" min="0" max={duration||0} step=".1" value={Math.min(position,duration)} disabled={!duration} aria-valuetext={`${clock(position)} / ${clock(duration)}`} style={{'--fill':`${duration?position/duration*100:0}%`}} onChange={event=>{const value=Number(event.target.value);sound.current?.seek(value);setPosition(value)}}/>
      <div className="music-times"><span>{clock(position)}</span><span>{clock(duration)}</span></div>
      <div className="music-controls"><Tooltip title={repeat?'单曲循环':'列表循环'}><button className="icon-button music-repeat" aria-label="单曲循环" aria-pressed={repeat} onClick={()=>{repeatRef.current=!repeat;setRepeat(!repeat)}}>{icon('repeat')}{repeat&&<span>1</span>}</button></Tooltip><div className="music-transport"><button className="icon-button" aria-label="上一首" onClick={()=>{if(position>3){sound.current?.seek(0);setPosition(0)}else step(-1)}}>{icon('backward-step')}</button><button className="music-play" aria-label={state==='error'?'重试播放':playing?'暂停':'播放'} disabled={state==='loading'} onClick={toggle}>{icon(state==='loading'?'circle-notch':playing?'pause':'play')}</button><button className="icon-button" aria-label="下一首" onClick={()=>step(1)}>{icon('forward-step')}</button></div><span className="music-controls-spacer"/></div>
      <div className="music-volume"><button className="icon-button" aria-label={volume?'静音':'取消静音'} onClick={()=>changeVolume(volume?0:.6)}>{icon(volume?'volume-low':'volume-xmark')}</button><input className="music-range" type="range" aria-label="音量" min="0" max="1" step=".01" value={volume} style={{'--fill':`${volume*100}%`}} onChange={event=>changeVolume(Number(event.target.value))}/><span>{Math.round(volume*100)}</span></div>
      <div className="music-queue" aria-label="本地歌单">{tracks.map((item,index)=><div className={`music-row ${item.id===current?'is-current':''}`} key={item.id}><button className="music-track" aria-label={`播放 ${item.title}`} aria-current={item.id===current?'true':undefined} onClick={()=>select(item)}><span>{item.id===current&&playing?icon('volume-high'):String(index+1).padStart(2,'0')}</span><strong title={item.title}>{item.title}</strong></button><button className="icon-button" aria-label={`移除 ${item.title}`} onClick={()=>remove(item)}>{icon('xmark')}</button></div>)}</div></>:<button className="music-empty" disabled={restoring||restoreFailed} onClick={()=>input.current?.click()}>{icon('music')}<span>{restoring?'恢复中…':'拖入歌曲'}</span>{!restoring&&<small>或点击选择</small>}</button>}
    {error&&<p className="music-error" role="status">{error}</p>}
    {storageError&&<p className="music-error" role="alert">{storageError}{!restoring&&<button className="icon-button" aria-label={restoreFailed?"重试恢复歌单":"重试保存歌单"} disabled={saving} onClick={()=>restoreFailed?restore():persist(queue.current)}>{icon('rotate-right')}</button>}</p>}
    <p className="music-private" role="status">{restoring?'恢复中…':saving?'保存中…':storageError?'':'仅保存在此浏览器'}</p>
  </section>;
  return <><input ref={input} className="music-file-input" type="file" tabIndex={-1} accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.webm" multiple aria-label="选择本地歌曲" onChange={event=>{addFiles(event.target.files);event.target.value=''}}/>
    <Popover open={open} onOpenChange={onOpenChange} trigger="click" placement="top" arrow={false} content={content} afterOpenChange={value=>{if(value)panel.current?.querySelector('button')?.focus()}}>
      {cloneElement(triggerElement,{ref:node=>{triggerElement.props.ref(node);trigger.current=node},className:`${triggerElement.props.className} music-trigger ${playing?'is-playing':''}`,'aria-haspopup':'dialog','aria-expanded':open,'aria-label':playing?`正在播放 ${track?.title}，打开播放器`:'打开音乐播放器'})}
    </Popover></>;
}
