export async function prepareAvatar(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 PNG、JPG 或 WebP 图片。');
  if(file.size>5*1024*1024)throw Error('图片不能超过 5 MB。');
  const url=URL.createObjectURL(file),image=new Image();
  try{image.src=url;await image.decode();const size=Math.min(image.naturalWidth,image.naturalHeight);if(!size)throw Error();const canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,256,256);return canvas.toDataURL('image/png')}catch{throw Error('无法读取这张图片，请换一张再试。')}finally{URL.revokeObjectURL(url)}
}

