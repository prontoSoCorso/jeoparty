// Il server non deve mai uscire dalle sue radici (path traversal) e deve rispondere con gli header giusti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRequestPath, createRequestHandler } from '../server/static.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const roots = { public: path.join(ROOT, 'public'), data: path.join(ROOT, 'data') };

test('i percorsi validi finiscono dentro public/ o data/', () => {
  assert.equal(resolveRequestPath('/', roots), path.join(roots.public, 'index.html'));
  assert.equal(resolveRequestPath('/css/base.css', roots), path.join(roots.public, 'css', 'base.css'));
  assert.equal(resolveRequestPath('/data/index.json', roots), path.join(roots.data, 'index.json'));
  assert.equal(resolveRequestPath('/data/categories/violetta.json?x=1'.split('?')[0], roots),
    path.join(roots.data, 'categories', 'violetta.json'));
});

test('path traversal e percorsi sospetti sono rifiutati', () => {
  const bad = [
    '/../package.json',
    '/%2e%2e/package.json',
    '/%2E%2E/package.json',
    '/..%2fpackage.json',
    '/%2e%2e%2fpackage.json',
    '/..%5cpackage.json',
    '/%2e%2e%5cpackage.json',
    '/data/../package.json',
    '/data/..%2f..%2fpackage.json',
    '/data/%2e%2e/server/server.js',
    '/.git/config',
    '/data/.hidden.json',
    '/data/categories/nota.txt',
    '/data/',
    '/%E0%A4%A',
    '/con.json',
    '/data/nul.json',
    '/index.html::$DATA',
    '/C:/Windows/win.ini',
    '/a%00.html',
    'package.json',
  ];
  for (const p of bad) assert.equal(resolveRequestPath(p, roots), null, p);
});

function request(port, method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('il server risponde, applica gli header e dà 404 ai tentativi di uscita', async () => {
  const handler = createRequestHandler({ publicDir: roots.public, dataDir: roots.data, info: { app: 'jeoparty' } });
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const home = await request(port, 'GET', '/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-type'], /text\/html/);
    assert.equal(home.headers['cache-control'], 'no-store');
    assert.equal(home.headers['content-security-policy'], "default-src 'self'; style-src 'self' 'unsafe-inline'");

    const index = await request(port, 'GET', '/data/index.json');
    assert.equal(index.status, 200);
    assert.equal(JSON.parse(index.body).schemaVersion, 1);

    for (const p of ['/../package.json', '/%2e%2e/package.json', '/..%5cpackage.json', '/data/../package.json']) {
      assert.equal((await request(port, 'GET', p)).status, 404, p);
    }
    assert.equal((await request(port, 'POST', '/')).status, 405);
    assert.equal((await request(port, 'HEAD', '/')).body, '');
    assert.equal(JSON.parse((await request(port, 'GET', '/__jeoparty')).body).app, 'jeoparty');
  } finally {
    server.close();
  }
});
