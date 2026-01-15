import http from 'http';
import https from 'https';
import { URL } from 'url';


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

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/steam/appdetails')) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  const query = req.url.split('?')[1] || '';
  const targetUrl = `https://store.steampowered.com/api/appdetails?${query}`;

  try {
    const resp = await simpleFetch(targetUrl);
    const body = await resp.text();

    res.statusCode = resp.status || 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(body);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'proxy_failed' }));
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Steam proxy listening on http://localhost:${PORT}`);
});