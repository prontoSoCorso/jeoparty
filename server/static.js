// File statici: public/ su "/" e data/ su "/data/" (solo .json), senza mai uscire dalle due radici.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// Caratteri vietati nei nomi di file di Windows (":" blocca anche drive e flussi alternativi NTFS).
const BAD_SEGMENT = /[\u0000-\u001f:*?"<>|]/;
// Nomi di dispositivo riservati di Windows (CON, NUL, COM1…), anche con estensione.
const RESERVED_NAME = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;

/**
 * Converte il percorso di una richiesta nel file da servire, oppure null se non è ammesso.
 * Rifiuta decodifiche non valide, backslash, segmenti "."/"..", file nascosti e nomi riservati.
 */
export function resolveRequestPath(urlPath, roots) {
  if (typeof urlPath !== 'string' || !urlPath.startsWith('/')) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter((s) => s !== '');
  if (segments.some((s) => s.startsWith('.') || BAD_SEGMENT.test(s) || RESERVED_NAME.test(s))) return null;

  let base = roots.public;
  let rel = segments;
  if (segments[0] === 'data') {
    base = roots.data;
    rel = segments.slice(1);
    if (rel.length === 0 || !rel[rel.length - 1].toLowerCase().endsWith('.json')) return null;
  } else if (rel.length === 0 || decoded.endsWith('/')) {
    rel = [...rel, 'index.html'];
  }

  const filePath = path.resolve(base, ...rel);
  const rootWithSep = base.endsWith(path.sep) ? base : base + path.sep;
  return filePath.startsWith(rootWithSep) ? filePath : null;
}

function send(req, res, status, body, type, extra = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type, 'Content-Length': buf.length, ...extra });
  res.end(req.method === 'HEAD' ? undefined : buf);
}

/** Crea il gestore delle richieste HTTP. `info` viene esposto su /__jeoparty. */
export function createRequestHandler({ publicDir, dataDir, info }) {
  const roots = { public: path.resolve(publicDir), data: path.resolve(dataDir) };
  return async function handle(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(req, res, 405, 'Metodo non consentito', 'text/plain; charset=utf-8', { Allow: 'GET, HEAD' });
      return;
    }
    const urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/__jeoparty') {
      send(req, res, 200, JSON.stringify(info), MIME['.json']);
      return;
    }
    const filePath = resolveRequestPath(urlPath, roots);
    if (filePath) {
      try {
        const st = await stat(filePath);
        if (st.isFile()) {
          const body = await readFile(filePath);
          const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
          send(req, res, 200, body, type);
          return;
        }
      } catch {
        // file inesistente o illeggibile: 404 qui sotto
      }
    }
    send(req, res, 404, '404 - Non trovato', 'text/plain; charset=utf-8');
  };
}
