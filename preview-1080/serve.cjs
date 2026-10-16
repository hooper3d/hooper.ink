const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'dist');
http.createServer((req,res)=>{
  let file;
  try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);file=path.resolve(root,'.'+(name==='/'?'/index.html':name))}catch{res.writeHead(400);res.end();return}
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404);res.end('Not found');return}
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.txt':'text/plain; charset=utf-8'})[path.extname(file)]||'application/octet-stream');
    res.end(data);
  });
}).listen(18867,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:18867/'));
