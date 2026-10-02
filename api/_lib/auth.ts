import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { HttpError, header, type Req } from './http.js';

// ---------- JWT ----------
export async function firmarToken(estudianteId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(estudianteId))
    .setIssuedAt()
    .setExpirationTime('6h')
    .sign(config.jwtSecret);
}

export async function requireEstudiante(req: Req): Promise<number> {
  const auth = header(req, 'authorization');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sesión requerida');
  try {
    const { payload } = await jwtVerify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) throw new Error();
    return id;
  } catch {
    throw new HttpError(401, 'Sesión expirada, vuelve a ingresar');
  }
}

export function requireAdmin(clave: string) {
  const esperado = Buffer.from(config.adminKey);
  const recibido = Buffer.from(clave);
  if (esperado.length < 12 || esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) {
    throw new HttpError(401, 'Clave de administrador inválida');
  }
}
