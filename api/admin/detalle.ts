import { getPool } from '../_lib/db.js';
import { route, query, entero } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { resultado } from '../_lib/examen.js';

// GET /api/admin/detalle?intento=ID   (token de admin)  → nota + revisión pregunta por pregunta
export default route(['GET'], async (req, res) => {
  await requireAdmin(req);
  const db = getPool();
  const id = entero(query(req, 'intento'), 'intento');
  const { rows: [p] } = await db.query<{ alias: string }>(
    `SELECT e.alias FROM intento i JOIN estudiante e ON e.id = i.estudiante_id WHERE i.id = $1`, [id]);
  res.status(200).json({ alias: p?.alias, ...(await resultado(db, null, id)) });
});
