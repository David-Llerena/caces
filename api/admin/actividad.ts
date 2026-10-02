import { getPool } from '../_lib/db.js';
import { route } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { actividad, cerrarTodosLosVencidos } from '../_lib/admin.js';

// GET /api/admin/actividad  → últimos eventos de todos los usuarios (ingresos, inicios, fines)
export default route(['GET'], async (req, res) => {
  await requireAdmin(req);
  const db = getPool();
  await cerrarTodosLosVencidos(db);
  res.status(200).json(await actividad(db, null, 150));
});
