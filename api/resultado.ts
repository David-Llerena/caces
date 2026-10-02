import { getPool } from './_lib/db.js';
import { route, query, entero } from './_lib/http.js';
import { requireEstudiante } from './_lib/auth.js';
import { resultado } from './_lib/examen.js';

// GET /api/resultado?id=123  → resultado de un intento finalizado propio
export default route(['GET'], async (req, res) => {
  const id = await requireEstudiante(req);
  res.status(200).json(await resultado(getPool(), id, entero(query(req, 'id'), 'id')));
});
