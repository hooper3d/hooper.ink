const fail=(status,message)=>Object.assign(Error(message),{status});
const validId=value=>typeof value==='string'&&/^[1-9]\d{0,19}$/.test(value);
function playlistId(value){
  if(typeof value!=='string'||value.length>2000)throw fail(400,'请粘贴网易云歌单链接或歌单 ID');
  value=value.trim();
  if(validId(value))return value;
  try{
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||!['music.163.com','y.music.163.com'].includes(url.hostname)||url.username||url.password)throw Error();
    const route=url.hash.startsWith('#/')?new URL(url.hash.slice(1),url.origin):url;
    const id=route.searchParams.get('id')||route.pathname.match(/^\/playlist\/(\d+)\/?$/)?.[1];
    if(!/\/(?:m\/)?playlist(?:\/|$)/.test(route.pathname)||!validId(id))throw Error();
    return id;
  }catch{throw fail(400,'请使用网易云完整歌单链接或歌单 ID，暂不支持短链接')}
}
async function request(path){
  try{
    const response=await fetch('https://music.163.com'+path,{headers:{Referer:'https://music.163.com/','User-Agent':'Mozilla/5.0'},redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error();
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>3*1024*1024)throw Error();chunks.push(chunk)}
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(data.code!==200)throw Error();
    return data;
  }catch{throw fail(502,'网易云暂时无法访问，请稍后重试')}
}
async function playlist(value){
  const id=playlistId(value),data=await request(`/api/playlist/detail?id=${id}&n=100`),list=data.result;
  if(!list||!Array.isArray(list.tracks)||!list.tracks.length)throw fail(404,'歌单为空或未公开，请检查歌单权限');
  const tracks=list.tracks.slice(0,100).filter(song=>validId(String(song.id))&&typeof song.name==='string').map(song=>({source:'netease',sourceId:String(song.id),playlistId:id,title:song.name.slice(0,200),artist:(song.artists||[]).map(artist=>artist.name).filter(name=>typeof name==='string').join(' / ').slice(0,200),format:'mp3'}));
  if(!tracks.length)throw fail(404,'歌单中没有可导入的歌曲');
  return {id,name:String(list.name||'网易云歌单').slice(0,200),total:Number(list.trackCount)||list.tracks.length,tracks};
}
async function track(id){
  if(!validId(id))throw fail(400,'歌曲 ID 无效');
  const data=await request(`/api/song/enhance/player/url?ids=%5B${id}%5D&br=128000`),item=data.data?.[0];
  if(!item?.url)throw fail(404,'这首歌暂不可播放，可能需要网易云登录、会员或受地区限制');
  let url;
  try{url=new URL(item.url);if(!['http:','https:'].includes(url.protocol)||!url.hostname.endsWith('.music.126.net')||url.username||url.password)throw Error();url.protocol='https:'}catch{throw fail(502,'网易云返回的播放地址无效')}
  return {url:url.href,format:['mp3','flac','m4a','aac','ogg'].includes(item.type)?item.type:'mp3',trial:!!item.freeTrialInfo};
}
module.exports={playlist,track,playlistId};
