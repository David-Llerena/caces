import { withTx } from './_lib/db.js';
import { route } from './_lib/http.js';
import { requireEstudiante } from './_lib/auth.js';
import { iniciarOReanudar } from './_lib/examen.js';

// POST /api/intento  → inicia un intento nuevo o reanuda el que está en curso
export default route(['POST'], async (req, res) => {
  const id = await requireEstudiante(req);
  res.status(200).json(await withTx((c) => iniciarOReanudar(c, id)));
});
