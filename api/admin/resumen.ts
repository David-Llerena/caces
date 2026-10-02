import { getPool } from '../_lib/db.js';
import { route, header } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { config } from '../_lib/config.js';
import { cerrarTodosLosVencidos, listarParticipantes } from '../_lib/admin.js';

// GET /api/admin/resumen   (header x-admin-key)  → totales + lista de participantes
export default route(['GET'], async (req, res) => {
  requireAdmin(header(req, 'x-admin-key'));
  const db = getPool();
  await cerrarTodosLosVencidos(db);
  const participantes = await listarParticipantes(db);

  const fin = participantes.filter((p) => p.estado === 'FINALIZADO');
  const aprobados = fin.filter((p) => (p.porcentaje ?? 0) >= config.porcentajeAprobacion).length;
  res.status(200).json({
    config: { duracionMinutos: config.duracionMinutos, porcentajeAprobacion: config.porcentajeAprobacion },
    totales: {
      participantes: participantes.length,
      enCurso: participantes.filter((p) => p.estado === 'EN_CURSO').length,
      sinIniciar: participantes.filter((p) => !p.estado).length,
      finalizados: fin.length,
      aprobados,
      promedio: fin.length ? fin.reduce((s, p) => s + (p.porcentaje ?? 0), 0) / fin.length : null,
    },
    participantes,
  });
});
