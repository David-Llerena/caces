import { getPool } from './_lib/db.js';
import { route, body, entero } from './_lib/http.js';
import { requireEstudiante } from './_lib/auth.js';
import { enviar } from './_lib/examen.js';

// POST /api/enviar  { intentoId }  → califica en el servidor y devuelve el resultado
export default route(['POST'], async (req, res) => {
  const id = await requireEstudiante(req);
  const { intentoId } = body<{ intentoId?: unknown }>(req);
  res.status(200).json(await enviar(getPool(), id, entero(intentoId, 'intentoId')));
});
