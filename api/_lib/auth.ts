import { SignJWT, jwtVerify } from 'jose';
import { createHash, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { HttpError, header, query, type Req } from './http.js';

/** Comparación en tiempo constante (evita ataques de tiempo) */
export function iguales(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ---------- JWT ----------
const firmar = (sub: string, rol: 'estudiante' | 'admin', exp: string) =>
  new SignJWT({ rol })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(config.jwtSecret);

export const firmarToken = (estudianteId: number) => firmar(String(estudianteId), 'estudiante', '6h');
export const firmarAdmin = () => firmar('admin', 'admin', '12h');

async function leerToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return payload;
  } catch {
    throw new HttpError(401, 'Sesión expirada, vuelve a ingresar');
  }
}

const bearer = (req: Req) => {
  const auth = header(req, 'authorization');
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
};

export async function requireEstudiante(req: Req): Promise<number> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'Sesión requerida');
  const p = await leerToken(token);
  const id = Number(p.sub);
  if (p.rol !== 'estudiante' || !Number.isInteger(id)) throw new HttpError(401, 'Sesión inválida, vuelve a ingresar');
  return id;
}

/** Admin: token de sesión (Bearer o ?token=) o, por compatibilidad, la clave en x-admin-key */
export async function requireAdmin(req: Req): Promise<void> {
  const clave = header(req, 'x-admin-key');
  if (clave) {
    if (config.adminKey && iguales(clave, config.adminKey)) return;
    throw new HttpError(401, 'Clave de administrador inválida');
  }
  const token = bearer(req) || query(req, 'token');
  if (!token) throw new HttpError(401, 'Sesión de administrador requerida');
  const p = await leerToken(token);
  if (p.rol !== 'admin') throw new HttpError(403, 'Solo el administrador puede ver esto');
}
