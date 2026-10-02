import { getPool } from './_lib/db.js';
import { route, body, entero } from './_lib/http.js';
import { requireEstudiante } from './_lib/auth.js';
import { guardarRespuesta } from './_lib/examen.js';

// POST /api/respuesta  { intentoId, preguntaId, opcionId | null }  → autoguardado
export default route(['POST'], async (req, res) => {
  const id = await requireEstudiante(req);
  const b = body<{ intentoId?: unknown; preguntaId?: unknown; opcionId?: unknown }>(req);
  const opcion = b.opcionId === null ? null : entero(b.opcionId, 'opcionId');
  await guardarRespuesta(getPool(), id, entero(b.intentoId, 'intentoId'), entero(b.preguntaId, 'preguntaId'), opcion);
  res.status(200).json({ ok: true });
});
