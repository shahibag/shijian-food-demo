// Development-only source preview. The deliverable remains the native miniprogram/.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const previewRoot = __dirname;
const miniRoot = path.resolve(__dirname, '../miniprogram');
const port = Number(process.env.PREVIEW_PORT || 4173);

function sourceFiles(dir, prefix = '') {
  const result = {};
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, sourceFiles(path.join(dir, entry.name), relative));
    else if (/\.(js|json|wxml|wxss)$/.test(entry.name)) result[relative] = fs.readFileSync(path.join(dir, entry.name), 'utf8');
  }
  return result;
}

http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/api/source') {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ files: sourceFiles(miniRoot) }));
    return;
  }
  const allowed = { '/': 'index.html', '/index.html': 'index.html', '/renderer.js': 'renderer.js' };
  const file = allowed[url.pathname];
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  response.end(fs.readFileSync(path.join(previewRoot, file)));
}).listen(port, '127.0.0.1', () => {
  console.log(`Source preview: http://127.0.0.1:${port}`);
});
