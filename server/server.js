// Avvio di Jeoparty: server statico locale, solo moduli built-in di Node.
// Uso: node server/server.js [--port 4000] [--no-open]
import http from 'node:http';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from './static.js';
import { openBrowser } from './open-browser.js';
import { rebuildIndex } from '../scripts/lib/catalog.js';

const MIN_NODE = 20;
const DEFAULT_PORT = 3456;
const FALLBACK_TRIES = 10;

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');

function fail(message) {
  console.error(`\n  [Jeoparty] ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { port: null, open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-open') args.open = false;
    else if (a === '--port' || a === '-p') args.port = argv[++i] ?? '';
    else if (a.startsWith('--port=')) args.port = a.slice('--port='.length);
    else if (a === '--help' || a === '-h') args.help = true;
    else fail(`Argomento sconosciuto: ${a} (usa --port N oppure --no-open)`);
  }
  return args;
}

function readPort(args) {
  const raw = args.port ?? process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    fail(`Porta non valida: "${raw}". Usa un numero tra 1024 e 65535.`);
  }
  return port;
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

// Ascolta solo su loopback: 127.0.0.1 sempre, ::1 se IPv6 è disponibile.
async function tryPort(handler, port) {
  const v4 = http.createServer(handler);
  try {
    await listen(v4, port, '127.0.0.1');
  } catch (err) {
    return { ok: false, err };
  }
  const v6 = http.createServer(handler);
  try {
    await listen(v6, port, '::1');
  } catch (err) {
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      v4.close();
      return { ok: false, err };
    }
    return { ok: true, servers: [v4] };
  }
  return { ok: true, servers: [v4, v6] };
}

// La porta è occupata proprio da Jeoparty?
function isJeopartyRunning(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/__jeoparty', timeout: 800 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body).app === 'jeoparty');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

// Rigenera data/index.json (solo se è cambiato) e avvisa se qualche categoria ha errori.
async function refreshIndex() {
  try {
    const { catalog, index } = await rebuildIndex(ROOT);
    const excluded = catalog.entries.filter((e) => !e.valid).map((e) => e.file);
    console.log(`  Categorie pronte: ${index.categories.length}.`);
    if (excluded.length) {
      console.warn(`  Escluse per errori: ${excluded.join(', ')}. Dettagli: npm run validate\n`);
    }
  } catch (err) {
    console.warn(`  Non riesco ad aggiornare data/index.json (${err.message}): uso quello esistente.\n`);
  }
}

async function main() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE) fail(`Serve Node.js ${MIN_NODE} o superiore (trovato ${process.versions.node}).`);

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node server/server.js [--port N] [--no-open]');
    return;
  }
  const preferred = readPort(args);
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const info = { app: 'jeoparty', version: pkg.version };
  const handler = createRequestHandler({ publicDir: PUBLIC_DIR, dataDir: DATA_DIR, info });
  await refreshIndex();

  const last = Math.min(preferred + FALLBACK_TRIES, 65535);
  for (let port = preferred; port <= last; port++) {
    const result = await tryPort(handler, port);
    const url = `http://localhost:${port}`;
    if (result.ok) {
      info.port = port;
      console.log(`\n  Jeoparty è pronto: ${url}\n  Per fermarlo premi Ctrl+C.\n`);
      if (port !== preferred) {
        console.warn(`  Attenzione: la porta ${preferred} non era disponibile, uso la ${port}.`);
        console.warn(`  Le partite salvate restano legate alla porta: una partita iniziata sulla ${preferred} si ritrova solo lì.\n`);
      }
      if (args.open && !process.env.JEOPARTY_NO_OPEN) openBrowser(url);
      const stop = () => {
        console.log('\n  Server fermato.');
        for (const server of result.servers) server.close();
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
      return;
    }
    const code = result.err.code;
    if (code !== 'EADDRINUSE' && code !== 'EACCES') fail(`Impossibile avviare il server: ${result.err.message}`);
    if (await isJeopartyRunning(port)) {
      console.log(`\n  Jeoparty è già in esecuzione su ${url}: apro il browser.\n`);
      if (args.open && !process.env.JEOPARTY_NO_OPEN) openBrowser(url);
      return;
    }
    console.warn(`  Porta ${port} non disponibile (${code === 'EACCES' ? 'riservata da Windows' : 'occupata'}).`);
  }
  fail(`Nessuna porta libera tra ${preferred} e ${last}. Prova con --port e un altro numero.`);
}

main().catch((err) => fail(err.stack || String(err)));
