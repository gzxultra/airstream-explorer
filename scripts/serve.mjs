// Minimal static file server for local preview/smoke-testing dist/.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

const ROOT = join(process.cwd(), 'dist');
const PORT = Number(process.argv[2]) || 8788;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.json': 'application/json', '.webp': 'image/webp' };

const server = createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';
    const path = normalize(join(ROOT, url));
    if (!path.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    const ext = path.slice(path.lastIndexOf('.'));
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404');
  }
});

server.listen(PORT, () => console.log(`serving dist/ on http://localhost:${PORT}`));
