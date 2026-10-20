const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  if (['hooper.ink', 'www.hooper.ink'].includes(host) && !req.url.startsWith('/.well-known/acme-challenge/')) {
    res.writeHead(301, { 'Location': `https://${host}${req.url}`, 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  if (host === 'stock.hooper.ink' && !req.url.startsWith('/.well-known/acme-challenge/')) {
    res.writeHead(301, {
      'Location': `https://stock.hooper.ink${req.url}`,
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }

  if (host === 'trade.hooper.ink' && !req.url.startsWith('/.well-known/acme-challenge/')) {
    res.writeHead(301, {
      'Location': `https://trade.hooper.ink${req.url}`,
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }

  if (host === 'aigc.hooper.ink' && !req.url.startsWith('/.well-known/acme-challenge/')) {
    res.writeHead(301, { 'Location': `https://aigc.hooper.ink${req.url}`, 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (host === 'tv.hooper.ink' && !req.url.startsWith('/.well-known/acme-challenge/')) {
    res.writeHead(301, { 'Location': `https://tv.hooper.ink${req.url}`, 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  // Strip query string from URL for file serving
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  
  // Handle directory paths by looking for index.html
  if (!path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nav server running at http://0.0.0.0:${PORT}`);
});
