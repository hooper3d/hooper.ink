const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto');
const {promisify} = require('node:util');
const {validateNavigation} = require('./navigation-model.cjs');
const {emptyDocument, validateNote, imagePath} = require('./notes-model.cjs');
const scrypt = promisify(crypto.scrypt), root = __dirname;
function createPreviewServer({dataDir = path.join(root, '.local'), publicOrigins = []} = {}) {
  const production = publicOrigins.length > 0;
  const allowedOrigins = publicOrigins.map(value => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== value) throw Error('Production origins must be HTTPS origins');
    return url;
  });
  fs.mkdirSync(dataDir, {recursive:true});
  const navFile = path.join(dataDir, 'navigation.json'), authFile = path.join(dataDir, 'auth.json');
  const noteFile = path.join(dataDir, 'notes.json'), imageDir = path.join(dataDir, 'note-images');
  const atomicWrite = (file, data) => {
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), {mode:0o600});
    fs.renameSync(temporary, file);
  };
  if (!fs.existsSync(navFile)) atomicWrite(navFile, {...validateNavigation(require('./defaults.json')), revision:0});
  let navigation = JSON.parse(fs.readFileSync(navFile, 'utf8'));
  validateNavigation(navigation);
  let note = fs.existsSync(noteFile) ? JSON.parse(fs.readFileSync(noteFile, 'utf8')) : {revision:0, document:emptyDocument(), updatedAt:null};
  validateNote(note.document);
  let auth = fs.existsSync(authFile) ? JSON.parse(fs.readFileSync(authFile, 'utf8')) : null;
  if (production && !auth) throw Error('Production requires an existing owner password');
  const sessions = new Map(), failures = new Map(), setupToken = crypto.randomBytes(32).toString('hex');
  let setupBusy = false;
  const error = (status, message) => Object.assign(Error(message), {status});
  const reply = (res, status, data) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
  const same = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string') return false; const first = Buffer.from(a), second = Buffer.from(b); return first.length === second.length && crypto.timingSafeEqual(first, second); };
  async function readBytes(req, limit) {
    if (Number(req.headers['content-length']) > limit) throw error(413, '数据过大');
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > limit) throw error(413, '数据过大'); chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
  async function readBody(req) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw error(415, '需要 JSON 数据');
    const bytes = await readBytes(req, 256 * 1024);
    try { return JSON.parse(bytes.toString('utf8')); } catch { throw error(400, 'JSON 格式无效'); }
  }
  function startSession(res, port) {
    const token = crypto.randomBytes(32).toString('hex'), csrf = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {expires:Date.now() + 8 * 3600 * 1000, csrf});
    res.setHeader('Set-Cookie', `${production?'__Host-hooper_admin':`hooper_admin_${port}`}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production?'; Secure':''}`);
    return {authenticated:true, configured:true, csrf};
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const port = server.address().port;
    const publicOrigin = allowedOrigins.find(url => url.host === req.headers.host);
    if (production ? !publicOrigin : ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) { reply(res, 403, {error:'主机不匹配'}); return; }
    const origin = production ? publicOrigin.origin : `http://${req.headers.host}`;
    let name;
    try { name = decodeURIComponent(new URL(req.url, origin).pathname); } catch { reply(res, 400, {error:'地址无效'}); return; }
    const cookieName = production ? '__Host-hooper_admin' : `hooper_admin_${port}`;
    const cookie = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    const session = sessions.get(cookie);
    if (session && session.expires <= Date.now()) sessions.delete(cookie);
    const loggedIn = session && session.expires > Date.now();
    try {
      if (name.startsWith('/api/')) {
        if (req.method === 'GET' && name === '/api/session') { reply(res, 200, {configured:!!auth, authenticated:!!loggedIn, ...(loggedIn ? {csrf:session.csrf} : !auth && !production ? {setupToken} : {})}); return; }
        if (req.method === 'GET' && name === '/api/navigation') { reply(res, 200, navigation); return; }
        if (name === '/api/notes' || name.startsWith('/api/note-images')) {
          if (!loggedIn) throw error(401, '请先登录');
          res.setHeader('Referrer-Policy', 'no-referrer');
          res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
          if (req.method === 'GET' && name === '/api/notes') { reply(res, 200, note); return; }
          if (['GET','HEAD'].includes(req.method) && imagePath.test(name)) {
            const file = path.join(imageDir, path.basename(name));
            if (!fs.existsSync(file)) throw error(404, '图片不存在');
            res.setHeader('Content-Type', {'.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[path.extname(file)]);
            res.end(req.method === 'HEAD' ? '' : fs.readFileSync(file)); return;
          }
        }
        if (req.headers.origin !== origin) throw error(403, '请求来源不匹配');
        if (req.method === 'POST' && ['/api/setup', '/api/login'].includes(name)) {
          const input = await readBody(req);
          if (name === '/api/setup') {
            if (production) throw error(403, '线上不开放密码初始化');
            if (auth || setupBusy) throw error(409, '管理密码已设置');
            if (!same(input.setupToken, setupToken)) throw error(403, '初始化凭据无效');
            if (typeof input.password !== 'string' || input.password.length < 10 || input.password.length > 128) throw error(400, '密码需为 10–128 位');
            setupBusy = true;
            try {
              const salt = crypto.randomBytes(16).toString('hex');
              const next = {salt, hash:(await scrypt(input.password, salt, 64)).toString('hex')};
              atomicWrite(authFile, next); auth = next;
            } finally { setupBusy = false; }
            reply(res, 201, startSession(res, port)); return;
          }
          if (!auth) throw error(409, '请先设置管理密码');
          const address = production && typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'].slice(0,64) : req.socket.remoteAddress, failed = failures.get(address);
          for (const [ip, value] of failures) if (value.until <= Date.now()) failures.delete(ip);
          if (failed && failed.until > Date.now() && failed.count >= 5) throw error(429, '尝试过多，请 10 分钟后重试');
          failures.set(address, {count:failed && failed.until > Date.now() ? failed.count + 1 : 1, until:failed && failed.until > Date.now() ? failed.until : Date.now() + 600000});
          if (typeof input.password !== 'string' || input.password.length > 128) throw error(401, '密码不正确');
          const candidate = (await scrypt(input.password, auth.salt, 64)).toString('hex');
          if (!same(candidate, auth.hash)) {
            throw error(401, '密码不正确');
          }
          failures.delete(address);
          for (const [token, value] of sessions) if (value.expires <= Date.now()) sessions.delete(token);
          reply(res, 200, startSession(res, port)); return;
        }
        if (!loggedIn) throw error(401, '请先登录');
        if (!same(req.headers['x-csrf-token'], session.csrf)) throw error(403, '请求凭据无效，请重新登录');
        if (req.method === 'POST' && name === '/api/note-images') {
          const bytes = await readBytes(req, 8 * 1024 * 1024);
          const extension = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpg' : ['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()) ? 'gif' : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' ? 'webp' : null;
          if (!extension) throw error(400, '支持 PNG、JPEG、GIF、WebP 图片');
          fs.mkdirSync(imageDir, {recursive:true});
          const used = fs.readdirSync(imageDir).reduce((sum, file) => sum + fs.statSync(path.join(imageDir,file)).size, 0);
          if (used + bytes.length > 100 * 1024 * 1024) throw error(413, '图片存储已满');
          const fileName = `${crypto.randomUUID()}.${extension}`;
          fs.writeFileSync(path.join(imageDir,fileName), bytes, {mode:0o600});
          let originalName = '图片';
          try { originalName = decodeURIComponent(req.headers['x-file-name'] || '图片').slice(0,160); } catch {}
          reply(res, 201, {src:`/api/note-images/${fileName}`, alt:originalName, size:bytes.length}); return;
        }
        if (req.method === 'PUT' && name === '/api/notes') {
          const input = await readBody(req);
          if (input.revision !== note.revision) throw error(409, '便笺已在其他页面更新，请重新载入');
          let document;
          try { document = validateNote(input.document); } catch (e) { throw error(400, e.message); }
          const checkImages = node => { if (node.type === 'noteImage' && !fs.existsSync(path.join(imageDir,path.basename(node.attrs.src)))) throw error(400, '图片不存在，请重新上传'); (node.content || []).forEach(checkImages); };
          checkImages(document);
          const next = {revision:note.revision + 1, document, updatedAt:new Date().toISOString()};
          if (fs.existsSync(noteFile)) fs.copyFileSync(noteFile, noteFile + '.bak');
          atomicWrite(noteFile, next); note = next;
          reply(res, 200, note); return;
        }
        if (req.method === 'POST' && name === '/api/logout') {
          sessions.delete(cookie);
          res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`);
          reply(res, 200, {authenticated:false, configured:true}); return;
        }
        if (req.method === 'PUT' && name === '/api/navigation') {
          const input = await readBody(req);
          if (input.revision !== navigation.revision) throw error(409, '内容已在其他页面更新，请重新载入后再编辑');
          let next;
          try { next = {...validateNavigation(input), revision:navigation.revision + 1}; } catch (e) { throw error(400, e.message); }
          fs.copyFileSync(navFile, navFile + '.bak');
          atomicWrite(navFile, next); navigation = next;
          reply(res, 200, next); return;
        }
        throw error(404, '接口不存在');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw error(405, '方法不支持');
      if (name === '/data.js') {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.end(req.method === 'HEAD' ? '' : `let navData=${JSON.stringify(navigation.links)};let navCategories=${JSON.stringify(navigation.categories)};`); return;
      }
      const allowed = ['/index.html', '/app.js', '/style.css', '/topbar.css'];
      if (name === '/') name = '/index.html';
      if (!allowed.includes(name) && !/^\/(assets|ui)\/[a-zA-Z0-9_./-]+$/.test(name)) throw error(404, 'Not found');
      const file = path.resolve(root, '.' + name);
      if (!file.startsWith(root + path.sep) || name.split('/').includes('..')) throw error(404, 'Not found');
      const types = {'.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8'};
      if (!types[path.extname(file)]) throw error(404, 'Not found');
      fs.readFile(file, (err, data) => { if (err) { reply(res, 404, {error:'Not found'}); return; } if (production && name === '/index.html') data = Buffer.from(data.toString('utf8').replace(/\s*<meta name="robots" content="noindex, nofollow">/, '')); res.setHeader('Content-Type', types[path.extname(file)]); res.end(req.method === 'HEAD' ? '' : data); });
    } catch (e) { reply(res, e.status || 500, {error:e.status ? e.message : '保存服务暂不可用'}); }
  });
  return server;
}
if (require.main === module) createPreviewServer().listen(18869, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:18869/'));
module.exports = {createPreviewServer};
