// Tipos mínimos compatibles con los req/res de Vercel (Node runtime)
// y con el servidor local de scripts/dev-api.ts.
export interface Req {
  method?: string;
  body?: any;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}
export interface Res {
  status(code: number): Res;
  json(body: unknown): void;
  send(body: string): void;
  setHeader(name: string, value: string): void;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Handler = (req: Req, res: Res) => Promise<void>;

/** Envuelve un handler: valida método y traduce errores a JSON. */
export function route(methods: string[], fn: Handler) {
  return async (req: Req, res: Res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!methods.includes(req.method ?? '')) {
      res.status(405).json({ error: 'Método no permitido' });
      return;
    }
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) {
        res.status(e.status).json({ error: e.message });
      } else {
        console.error(e);
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };
}

export function body<T = Record<string, unknown>>(req: Req): T {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) as T; } catch { throw new HttpError(400, 'JSON inválido'); }
  }
  return (req.body ?? {}) as T;
}

export function header(req: Req, name: string): string {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

export function query(req: Req, name: string): string {
  const v = req.query?.[name];
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

export function entero(v: unknown, campo: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Campo inválido: ${campo}`);
  return n;
}
