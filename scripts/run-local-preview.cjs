const {createPreviewServer}=require('../preview-original/serve.cjs');
const parent=Number(process.argv[2]);
if (!Number.isSafeInteger(parent)||parent!==process.ppid) throw Error('Preview requires its supervisor parent');
// Windows Task Scheduler may stop PowerShell without terminating its Node child.
setInterval(()=>{try{process.kill(parent,0)}catch{process.exit(0)}},1000);
createPreviewServer({localAutoLogin:true}).listen(18869,'127.0.0.1',()=>console.log('Local auto-login preview: http://127.0.0.1:18869/'));
