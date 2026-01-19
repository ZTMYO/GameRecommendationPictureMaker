import http from 'http';
import https from 'https';
import { URL } from 'url';
import JSZip from 'jszip';

async function simpleFetch(targetUrl) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const req = lib.get(urlObj, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          text: async () => data
        });
      });
    });

    req.on('error', reject);
  });
}

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/steam/appdetails')) {
    const query = req.url.split('?')[1] || '';
    const targetUrl = `https://store.steampowered.com/api/appdetails?${query}`;

    try {
      const resp = await simpleFetch(targetUrl);
      const body = await resp.text();

      res.statusCode = resp.status || 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(body);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'proxy_failed' }));
    }
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/export-zip')) {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      const images = Array.isArray(parsed.images) ? parsed.images : [];

      if (!images.length) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'no_images' }));
        return;
      }

      const zip = new JSZip();
      images.forEach((dataUrl, index) => {
        if (typeof dataUrl !== 'string' || !dataUrl) return;
        const parts = dataUrl.split(',');
        const base64Data = parts.length > 1 ? parts[1] : parts[0];
        const filename = `result_${index + 1}.png`;
        zip.file(filename, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: 'nodebuffer' });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="results.zip"');
      res.end(content);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'zip_failed' }));
    }
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('not found');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Steam proxy listening on http://localhost:${PORT}`);
});