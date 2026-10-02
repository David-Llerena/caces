// Servidor local que imita las funciones de Vercel (sin necesitar `vercel dev`).
// Vite redirige /api/* hacia aquí (ver vite.config.ts).
import { config as dotenv } from 'dotenv';
import { createServer } from 'node:http';
import type { Req, Res } from '../api/_lib/http.js';

dotenv({ path: '.env.local' });
const PORT = Number(process.env.API_PORT ?? 3001);

const rutas: Record<string, () => Promise<{ default: (req: Req, res: Res) => Promise<void> }>> = {
  '/api/ingresar': () => import('../api/ingresar.js'),
  '/api/admin/resumen': () => import('../api/admin/resumen.js'),
  '/api/admin/detalle': () => import('../api/admin/detalle.js'),
  '/api/admin/usuario': () => import('../api/admin/usuario.js'),
  '/api/admin/actividad': () => import('../api/admin/actividad.js'),
  '/api/estado': () => import('../api/estado.js'),
  '/api/intento': () => import('../api/intento.js'),
  '/api/respuesta': () => import('../api/respuesta.js'),
  '/api/enviar': () => import('../api/enviar.js'),
  '/api/resultado': () => import('../api/resultado.js'),
  '/api/admin/resultados': () => import('../api/admin/resultados.js'),
};

createServer(async (nreq, nres) => {
  const url = new URL(nreq.url ?? '/', `http://localhost:${PORT}`);
  const cargar = rutas[url.pathname];
  if (!cargar) { nres.writeHead(404).end('{"error":"No existe"}'); return; }

  let raw = '';
  for await (const chunk of nreq) raw += chunk;
  let parsed: unknown = undefined;
  try { parsed = raw ? JSON.parse(raw) : undefined; } catch { parsed = raw; }

  const req: Req = { method: nreq.method, headers: nreq.headers, body: parsed, query: Object.fromEntries(url.searchParams) };
  let code = 200;
  const res: Res = {
    status(c) { code = c; return res; },
    setHeader(n, v) { nres.setHeader(n, v); },
    json(b) { nres.setHeader('Content-Type', 'application/json'); nres.writeHead(code).end(JSON.stringify(b)); },
    send(b) { nres.writeHead(code).end(b); },
  };
  await (await cargar()).default(req, res);
}).listen(PORT, () => console.log(`API local en http://localhost:${PORT}`));
