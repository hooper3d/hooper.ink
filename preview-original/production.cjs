const path = require('node:path');
const {createPreviewServer} = require('./serve.cjs');
const dataDir = process.env.NAV_DATA_DIR, port = Number(process.env.PORT || 18871);
if (!dataDir || !path.isAbsolute(dataDir)) throw Error('NAV_DATA_DIR must be an absolute private data directory');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid PORT');
process.umask(0o077);
const server = createPreviewServer({dataDir, publicOrigins:['https://hooper.ink','https://www.hooper.ink']});
server.listen(port, '127.0.0.1', () => console.log(`Hooper Navi listening on 127.0.0.1:${port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
