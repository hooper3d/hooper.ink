let connection;
function database(){
  if(!connection)connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open('hooper-music',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('library');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('本地歌单暂时无法打开'));
  }).catch(error=>{connection=null;throw error});
  return connection;
}
export async function loadPlaylist(){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('library','readonly'),request=transaction.objectStore('library').get('playlist');
    transaction.oncomplete=()=>resolve(request.result||[]);
    transaction.onabort=transaction.onerror=()=>reject(transaction.error||Error('无法读取本地歌单'));
  });
}
export async function savePlaylist(tracks){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('library','readwrite');
    transaction.objectStore('library').put(tracks,'playlist');
    transaction.oncomplete=()=>resolve();
    transaction.onabort=transaction.onerror=()=>reject(transaction.error||Error('无法保存本地歌单'));
  });
}
