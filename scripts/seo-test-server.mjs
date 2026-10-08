import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import handler from '../api/page.js';
// Mirrors cleanUrls filesystem priority and the page adapter, without calling production.
export async function startSeoTestServer() {
 const root = resolve('dist');
 const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  const candidates = path === '/' ? ['/index.html'] : [path, ...(extname(path) ? [] : [`${path}.html`])];
  for (const candidate of candidates) {
   const file = resolve(root, `.${candidate}`);
   if (!file.startsWith(root + '/')) continue;
   try {
    const body = await readFile(file);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.png': 'image/png', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    if (url.searchParams.has('checkin') || url.searchParams.has('departure')) res.setHeader('X-Robots-Tag', 'noindex, follow');
    res.end(body); return;
   } catch { /* Fall through to the server adapter. */ }
  }
  const params = new URLSearchParams(url.search);
  params.set('path', path.slice(1));
  await handler({ url: `/api/page?${params}` }, { setHeader: (k, v) => res.setHeader(k, v), status: code => { res.statusCode = code; return { send: body => res.end(body), end: () => res.end() }; } });
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
