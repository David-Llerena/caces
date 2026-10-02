import { getPool } from '../_lib/db.js';
import { route, query, HttpError } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { config } from '../_lib/config.js';
import { actividad, cerrarTodosLosVencidos, intentosDeUsuario, listarParticipantes } from '../_lib/admin.js';

// GET /api/admin/usuario?alias=usuario1  → resumen, todos sus intentos y su actividad por hora
export default route(['GET'], async (req, res) => {
  await requireAdmin(req);
  const alias = query(req, 'alias').trim();
  if (!config.usuarios.some((u) => u.usuario.toLowerCase() === alias.toLowerCase())) {
    throw new HttpError(404, 'Ese usuario no está configurado');
  }
  const db = getPool();
  await cerrarTodosLosVencidos(db);
  const fila = (await listarParticipantes(db)).find((p) => p.alias.toLowerCase() === alias.toLowerCase());
  res.status(200).json({
    usuario: fila,
    porcentajeAprobacion: config.porcentajeAprobacion,
    intentos: fila?.id ? await intentosDeUsuario(db, alias) : [],
    actividad: fila?.id ? await actividad(db, alias, 500) : [],
  });
});
