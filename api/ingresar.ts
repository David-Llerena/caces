import { getPool, asegurarEsquema } from './_lib/db.js';
import { route, body, header, HttpError } from './_lib/http.js';
import { firmarAdmin, firmarToken, iguales } from './_lib/auth.js';
import { config } from './_lib/config.js';
import { estadoEstudiante } from './_lib/examen.js';

const MAX_FALLOS = 5;
const BLOQUEO_MIN = 10;
const ERROR = 'Usuario o contraseña incorrectos';

// POST /api/ingresar  { usuario, clave }
//  → admin:      { rol: 'admin', token }
//  → estudiante: { rol: 'estudiante', token, estudiante, estado }
export default route(['POST'], async (req, res) => {
  const b = body<{ usuario?: unknown; clave?: unknown }>(req);
  const usuario = String(b.usuario ?? '').trim();
  const clave = String(b.clave ?? '');
  if (!usuario || !clave) throw new HttpError(400, 'Escribe tu usuario y tu contraseña');

  // ---- Administrador ----
  if (usuario.toLowerCase() === config.adminUsuario.toLowerCase()) {
    if (config.adminKey.length < 12 || !iguales(clave, config.adminKey)) throw new HttpError(401, ERROR);
    res.status(200).json({ rol: 'admin', token: await firmarAdmin() });
    return;
  }

  // ---- Estudiante habilitado ----
  const habilitado = config.usuarios.find((u) => u.usuario.toLowerCase() === usuario.toLowerCase());
  if (!habilitado) throw new HttpError(401, ERROR);

  await asegurarEsquema();
  const db = getPool();
  const { rows: [previo] } = await db.query<{ bloqueado_hasta: Date | null }>(
    `SELECT bloqueado_hasta FROM estudiante WHERE lower(alias) = lower($1)`, [habilitado.usuario]);
  if (previo?.bloqueado_hasta && previo.bloqueado_hasta > new Date()) {
    throw new HttpError(429, `Demasiados intentos fallidos. Espera ${BLOQUEO_MIN} minutos y vuelve a intentar.`);
  }

  if (!iguales(clave, habilitado.clave)) {
    await db.query(
      `INSERT INTO estudiante (alias, fallos_login) VALUES ($1, 1)
       ON CONFLICT ((lower(alias))) DO UPDATE
         SET fallos_login = estudiante.fallos_login + 1,
             bloqueado_hasta = CASE WHEN estudiante.fallos_login + 1 >= $2
                                    THEN now() + make_interval(mins => $3) END`,
      [habilitado.usuario, MAX_FALLOS, BLOQUEO_MIN]);
    throw new HttpError(401, ERROR);
  }

  const ip = (header(req, 'x-forwarded-for').split(',')[0] || header(req, 'x-real-ip')).trim().slice(0, 64) || null;
  const { rows: [e] } = await db.query<{ id: number; alias: string }>(
    `INSERT INTO estudiante (alias, ip, navegador, ultimo_ingreso, ingresos) VALUES ($1, $2, $3, now(), 1)
     ON CONFLICT ((lower(alias))) DO UPDATE
       SET ip = EXCLUDED.ip, navegador = EXCLUDED.navegador, ultimo_ingreso = now(),
           ingresos = estudiante.ingresos + 1, fallos_login = 0, bloqueado_hasta = NULL
     RETURNING id, alias`,
    [habilitado.usuario, ip, header(req, 'user-agent').slice(0, 300) || null]);
  await db.query(`INSERT INTO acceso (estudiante_id, ip, navegador) VALUES ($1, $2, $3)`,
    [e.id, ip, header(req, 'user-agent').slice(0, 300) || null]);

  res.status(200).json({
    rol: 'estudiante',
    token: await firmarToken(e.id),
    estudiante: { alias: e.alias },
    estado: await estadoEstudiante(db, e.id),
  });
});
