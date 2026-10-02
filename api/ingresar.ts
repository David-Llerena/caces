import { getPool } from './_lib/db.js';
import { route, body, header, HttpError } from './_lib/http.js';
import { firmarToken } from './_lib/auth.js';
import { estadoEstudiante } from './_lib/examen.js';

// Letras (con tildes/ñ), números, punto, guion y guion bajo. 3 a 30 caracteres.
const FORMATO = /^[\p{L}\p{N}._-]{3,30}$/u;

// POST /api/ingresar  { alias }  → registra el alias (debe ser nuevo) y devuelve la sesión
export default route(['POST'], async (req, res) => {
  const alias = String(body<{ alias?: unknown }>(req).alias ?? '').trim();
  if (!FORMATO.test(alias)) {
    throw new HttpError(400, 'El alias debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo (sin espacios).');
  }

  const ip = (header(req, 'x-forwarded-for').split(',')[0] || header(req, 'x-real-ip')).trim().slice(0, 64) || null;
  const db = getPool();
  const { rows: [nuevo] } = await db.query<{ id: number; alias: string }>(
    `INSERT INTO estudiante (alias, ip, navegador) VALUES ($1, $2, $3)
     ON CONFLICT ((lower(alias))) DO NOTHING
     RETURNING id, alias`,
    [alias, ip, header(req, 'user-agent').slice(0, 300) || null]);

  if (!nuevo) throw new HttpError(409, `El alias "${alias}" ya fue usado. Elige otro.`);

  res.status(200).json({
    token: await firmarToken(nuevo.id),
    estudiante: { alias: nuevo.alias },
    estado: await estadoEstudiante(db, nuevo.id),
  });
});
