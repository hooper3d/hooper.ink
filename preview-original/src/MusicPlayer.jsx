import {cloneElement,useEffect,useRef,useState} from 'react';
import {Modal,Popover,Tooltip} from 'antd';
import {Howl} from 'howler';
import {loadPlaylist,savePlaylist} from './music-library';

const icon=name=><i className={`fas fa-${name}`} aria-hidden="true"/>;
const clock=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
const formats=new Set(['mp3','mpeg','opus','ogg','oga','wav','aac','m4a','mp4','weba','webm','flac']);
const online=item=>item.source==='netease';
const release=item=>{if(!online(item)&&item.url)URL.revokeObjectURL(item.url)};
async function request(url){
  const response=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(15000)}),data=await response.json();
  if(!response.ok)throw Error(data.error||'在线音源暂不可用');
  return data;
}
export default function MusicPlayer({open,onOpenChange,triggerElement}){
  const [modal,modalContext]=Modal.useModal();
  const [tracks,setTracks]=useState([]),[current,setCurrent]=useState(null),[state,setState]=useState('idle');
  const [position,setPosition]=useState(0),[duration,setDuration]=useState(0),[volume,setVolume]=useState(()=>{try{const value=Number(localStorage.getItem('hooper_music_volume')??.6);return Number.isFinite(value)?Math.min(1,Math.max(0,value)):.6}catch{return .6}});
  const [repeat,setRepeat]=useState(false),[error,setError]=useState(''),[dragging,setDragging]=useState(false);
  const [restoring,setRestoring]=useState(true),[restoreFailed,setRestoreFailed]=useState(false),[saving,setSaving]=useState(false),[storageError,setStorageError]=useState('');
  const [importOpen,setImportOpen]=useState(false),[playlistUrl,setPlaylistUrl]=useState(''),[importing,setImporting]=useState(false),[importError,setImportError]=useState(''),[notice,setNotice]=useState(''),[trial,setTrial]=useState(false);
  const sound=useRef(null),queue=useRef([]),active=useRef(null),volumeRef=useRef(volume),repeatRef=useRef(repeat),input=useRef(null),trigger=useRef(null),panel=useRef(null),dragDepth=useRef(0);
  const alive=useRef(true),writes=useRef(Promise.resolve()),saveVersion=useRef(0),selectionVersion=useRef(0);
  const confirming=useRef(false);
  const track=tracks.find(item=>item.id===current),playing=state==='playing';
  useEffect(()=>{
    restore();
    return()=>{alive.current=false;sound.current?.unload();queue.current.forEach(release)};
  },[]);
  useEffect(()=>{if(!saving)return;const warn=event=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[saving]);
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>{const value=sound.current?.seek();if(typeof value==='number')setPosition(value)},250);return()=>clearInterval(timer)},[playing]);
  useEffect(()=>{if(!open)return;const escape=event=>{if(event.key==='Escape'&&!confirming.current){event.stopPropagation();onOpenChange(false);trigger.current?.focus()}};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true)},[open,onOpenChange]);
  async function restore(){
    setRestoring(true);setStorageError('');
    try{
      const saved=await loadPlaylist();if(!alive.current)return;
      if(!Array.isArray(saved)||saved.some(item=>!formats.has(item.format)||(online(item)?!/^[1-9]\d{0,19}$/.test(item.sourceId):!(item.file instanceof Blob))))throw Error('歌单格式无效');
      const next=saved.map(item=>({...item,url:online(item)?undefined:URL.createObjectURL(item.file)}));
      queue.current=next;setTracks(next);setRestoreFailed(false);if(next.length)select(next[0],false);
    }catch{if(alive.current){setRestoreFailed(true);setStorageError('无法恢复本地歌单，请重试')}}finally{if(alive.current)setRestoring(false)}
  }
  async function select(item,play=true){
    const version=++selectionVersion.current;
    sound.current?.unload();sound.current=null;active.current=item.id;setCurrent(item.id);setPosition(0);setDuration(0);setTrial(false);setError('');setState('loading');
    let media={url:item.url,format:item.format};
    if(online(item)){
      if(!play){setState('paused');return}
      try{media=await request(`/api/music/track?id=${encodeURIComponent(item.sourceId)}`)}catch(e){if(alive.current&&version===selectionVersion.current){setState('error');setError(e.name==='TimeoutError'?'在线歌曲加载超时，请重试':e.message)}return}
      if(!alive.current||version!==selectionVersion.current)return;
      setTrial(media.trial);
    }
    const next=new Howl({src:[media.url],format:[media.format],html5:true,preload:false,volume:volumeRef.current,
      onload:()=>{if(sound.current===next){setDuration(next.duration());setState(next.playing()?'playing':'paused')}},
      onplay:()=>{if(sound.current===next){setState('playing');setError('')}},
      onpause:()=>{if(sound.current===next)setState('paused')},
      onloaderror:()=>{if(sound.current===next){setState('error');setError(online(item)?'在线歌曲无法播放，请重试或换一首':'无法播放，请检查音频格式')}},
      onplayerror:()=>{if(sound.current===next){setState('error');setError('播放未开始，点击重试')}},
      onend:()=>{if(sound.current!==next)return;if(repeatRef.current){next.seek(0);next.play()}else if(queue.current.length>1)step(1);else{next.seek(0);setPosition(0);setState('paused')}}
    });
    sound.current=next;next.load();if(play)next.play();
  }
  function step(direction){const index=queue.current.findIndex(item=>item.id===active.current);if(queue.current.length)select(queue.current[(index+direction+queue.current.length)%queue.current.length])}
  function toggle(){if(!track){input.current?.click();return}if(!sound.current||state==='error'){select(track);return}if(playing)sound.current.pause();else sound.current.play()}
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
  async function importPlaylist(event){
    event.preventDefault();if(importing||restoring||restoreFailed)return;
    setImporting(true);setImportError('');setNotice('');
    try{
      const playlist=await request(`/api/music/playlist?url=${encodeURIComponent(playlistUrl.trim())}`);
      if(!alive.current)return;
      const next=[...queue.current];let added=0,duplicates=0;
      for(const song of playlist.tracks){
        const key=`netease:${song.sourceId}`;
        if(next.some(item=>item.key===key)){duplicates++;continue}
        if(next.length>=100)break;
        next.push({...song,id:crypto.randomUUID(),key});added++;
      }
      if(added){queue.current=next;setTracks(next);persist(next);if(!active.current)select(next[0],false)}
      const remaining=Math.max(0,playlist.total-added-duplicates);
      setNotice(`「${playlist.name}」已添加 ${added} 首${duplicates?`，跳过 ${duplicates} 首重复歌曲`:''}${remaining?'；单个播放器最多保留 100 首，部分曲目未导入':''}`);
      setImportOpen(false);setPlaylistUrl('');
    }catch(e){if(alive.current)setImportError(e.name==='TimeoutError'?'歌单加载超时，请重试':e.message)}finally{if(alive.current)setImporting(false)}
  }
  function remove(item){
    const index=queue.current.findIndex(value=>value.id===item.id),next=queue.current.filter(value=>value.id!==item.id),wasPlaying=sound.current?.playing();
    queue.current=next;setTracks(next);persist(next);
    if(active.current===item.id){if(next.length)select(next[Math.min(index,next.length-1)],!!wasPlaying);else{selectionVersion.current++;sound.current?.unload();sound.current=null;active.current=null;setCurrent(null);setState('idle');setPosition(0);setDuration(0);setError('');setTrial(false)}}
    release(item);
  }
  function clearPlaylist(){
    if(restoring||restoreFailed||importing||saving||!queue.current.length)return;
    selectionVersion.current++;sound.current?.unload();sound.current=null;
    queue.current.forEach(release);queue.current=[];active.current=null;
    setTracks([]);setCurrent(null);setState('idle');setPosition(0);setDuration(0);setTrial(false);setError('');
    setImportOpen(false);setPlaylistUrl('');setImportError('');setNotice('播放列表已清空');persist([]);
  }
  function confirmClear(){
    confirming.current=true;
    modal.confirm({title:'清空播放列表？',content:`将移除全部 ${queue.current.length} 首歌曲，电脑中的原文件不受影响。`,okText:'清空',cancelText:'取消',okButtonProps:{danger:true},zIndex:1200,onOk:clearPlaylist,afterClose:()=>{confirming.current=false}});
  }
  function changeVolume(value){volumeRef.current=value;setVolume(value);sound.current?.volume(value);try{localStorage.setItem('hooper_music_volume',String(value))}catch{}}
  const content=<section ref={panel} className={`music-panel ${dragging?'is-dragging':''}`} role="dialog" aria-label="音乐播放器"
    onDragEnter={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();dragDepth.current++;setDragging(true)}}}
    onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy'}}}
    onDragLeave={event=>{if(event.dataTransfer.types.includes('Files')&&--dragDepth.current<=0){dragDepth.current=0;setDragging(false)}}}
    onDrop={event=>{event.preventDefault();dragDepth.current=0;setDragging(false);addFiles(event.dataTransfer.files)}}>
    <header><strong>音乐<span>{tracks.length||''}</span></strong><div className="panel-actions"><Tooltip title="导入网易云歌单"><button className="icon-button" aria-label="导入网易云歌单" aria-expanded={importOpen} disabled={restoring||restoreFailed||importing} onClick={()=>{setImportOpen(!importOpen);setImportError('');setNotice('')}}>{icon('cloud-arrow-down')}</button></Tooltip><Tooltip title="添加本地歌曲"><button className="icon-button" aria-label="添加本地歌曲" disabled={restoring||restoreFailed} onClick={()=>input.current?.click()}>{icon('plus')}</button></Tooltip><Tooltip title="清空播放列表"><button className="icon-button" aria-label="清空播放列表" disabled={!tracks.length||restoring||restoreFailed||importing||saving} onClick={confirmClear}>{icon('trash-can')}</button></Tooltip><button className="icon-button" aria-label="关闭播放器" onClick={()=>{onOpenChange(false);trigger.current?.focus()}}>{icon('xmark')}</button></div></header>
    {importOpen&&<form className="music-import" onSubmit={importPlaylist}><label htmlFor="musicPlaylistUrl">网易云歌单</label><div><input id="musicPlaylistUrl" aria-label="网易云歌单链接或 ID" placeholder="粘贴歌单链接或 ID" value={playlistUrl} maxLength={2000} disabled={importing} onChange={event=>setPlaylistUrl(event.target.value)} autoFocus/><button type="submit" disabled={!playlistUrl.trim()||importing}>{importing?'导入中…':'导入'}</button></div><small>公开歌单 · 保留已有歌曲 · 最多 100 首</small>{importError&&<p className="music-error" role="alert">{importError}</p>}</form>}
    {notice&&<p className="music-notice" role="status">{notice}</p>}
    {track?<><div className="music-now"><div className={`music-art ${playing?'is-playing':''}`} aria-hidden="true">{icon('music')}</div><div><strong title={track.title}>{track.title}</strong><small>{state==='loading'?'加载中':online(track)?`网易云${trial?' · 试听':''}${track.artist?` · ${track.artist}`:''}`:track.format.toUpperCase()}</small></div></div>
      <input className="music-range" aria-label="播放进度" type="range" min="0" max={duration||0} step=".1" value={Math.min(position,duration)} disabled={!duration} aria-valuetext={`${clock(position)} / ${clock(duration)}`} style={{'--fill':`${duration?position/duration*100:0}%`}} onChange={event=>{const value=Number(event.target.value);sound.current?.seek(value);setPosition(value)}}/>
      <div className="music-times"><span>{clock(position)}</span><span>{clock(duration)}</span></div>
      <div className="music-controls"><Tooltip title={repeat?'单曲循环':'列表循环'}><button className="icon-button music-repeat" aria-label="单曲循环" aria-pressed={repeat} onClick={()=>{repeatRef.current=!repeat;setRepeat(!repeat)}}>{icon('repeat')}{repeat&&<span>1</span>}</button></Tooltip><div className="music-transport"><button className="icon-button" aria-label="上一首" onClick={()=>{if(position>3){sound.current?.seek(0);setPosition(0)}else step(-1)}}>{icon('backward-step')}</button><button className="music-play" aria-label={state==='error'?'重试播放':playing?'暂停':'播放'} disabled={state==='loading'} onClick={toggle}>{icon(state==='loading'?'circle-notch':playing?'pause':'play')}</button><button className="icon-button" aria-label="下一首" onClick={()=>step(1)}>{icon('forward-step')}</button></div><span className="music-controls-spacer"/></div>
      <div className="music-volume"><button className="icon-button" aria-label={volume?'静音':'取消静音'} onClick={()=>changeVolume(volume?0:.6)}>{icon(volume?'volume-low':'volume-xmark')}</button><input className="music-range" type="range" aria-label="音量" min="0" max="1" step=".01" value={volume} style={{'--fill':`${volume*100}%`}} onChange={event=>changeVolume(Number(event.target.value))}/><span>{Math.round(volume*100)}</span></div>
      {!importOpen&&<div className="music-queue" aria-label="歌曲列表">{tracks.map((item,index)=><div className={`music-row ${item.id===current?'is-current':''}`} key={item.id}><button className="music-track" aria-label={`播放 ${item.title}`} aria-current={item.id===current?'true':undefined} onClick={()=>select(item)}><span>{item.id===current&&playing?icon('volume-high'):String(index+1).padStart(2,'0')}</span><strong title={`${item.title}${item.artist?' · '+item.artist:''}`}>{item.title}{online(item)&&<small>网易云{item.artist?' · '+item.artist:''}</small>}</strong></button><button className="icon-button" aria-label={`移除 ${item.title}`} onClick={()=>remove(item)}>{icon('xmark')}</button></div>)}</div>}</>:!importOpen&&<button className="music-empty" disabled={restoring||restoreFailed} onClick={()=>{setImportOpen(true);setNotice('')}}>{icon('music')}<span>{restoring?'恢复中…':'导入网易云歌单'}</span>{!restoring&&<small>也可以拖入本地歌曲</small>}</button>}
    {error&&<p className="music-error" role="status">{error}</p>}
    {storageError&&<p className="music-error" role="alert">{storageError}{!restoring&&<button className="icon-button" aria-label={restoreFailed?"重试恢复歌单":"重试保存歌单"} disabled={saving} onClick={()=>restoreFailed?restore():persist(queue.current)}>{icon('rotate-right')}</button>}</p>}
    <p className="music-private" role="status">{restoring?'恢复中…':saving?'保存中…':storageError?'':tracks.some(online)?'歌单保存在此浏览器 · 在线歌曲需联网':'仅保存在此浏览器'}</p>
  </section>;
  return <>{modalContext}<input ref={input} className="music-file-input" type="file" tabIndex={-1} accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.webm" multiple aria-label="选择本地歌曲" onChange={event=>{addFiles(event.target.files);event.target.value=''}}/>
    <Popover open={open} onOpenChange={value=>{if(!confirming.current)onOpenChange(value)}} trigger="click" placement="top" arrow={false} content={content} afterOpenChange={value=>{if(value)panel.current?.querySelector('button')?.focus()}}>
      {cloneElement(triggerElement,{ref:node=>{triggerElement.props.ref(node);trigger.current=node},className:`${triggerElement.props.className} music-trigger ${playing?'is-playing':''}`,'aria-haspopup':'dialog','aria-expanded':open,'aria-label':playing?`正在播放 ${track?.title}，打开播放器`:'打开音乐播放器'})}
    </Popover></>;
}
