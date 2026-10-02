import { getPool } from './_lib/db.js';
import { route } from './_lib/http.js';
import { requireEstudiante } from './_lib/auth.js';
import { estadoEstudiante } from './_lib/examen.js';

// GET /api/estado  → configuración, intentos usados, intento en curso
export default route(['GET'], async (req, res) => {
  const id = await requireEstudiante(req);
  res.status(200).json(await estadoEstudiante(getPool(), id));
});
