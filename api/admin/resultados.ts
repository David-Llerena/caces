import { getPool } from '../_lib/db.js';
import { route, header, query } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { config } from '../_lib/config.js';
import { cerrarTodosLosVencidos, listarParticipantes } from '../_lib/admin.js';

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? '' : v instanceof Date ? v.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET /api/admin/resultados?key=CLAVE   (o header x-admin-key)  → descarga CSV
export default route(['GET'], async (req, res) => {
  requireAdmin(header(req, 'x-admin-key') || query(req, 'key'));
  const db = getPool();
  await cerrarTodosLosVencidos(db);
  const filas = await listarParticipantes(db);

  const cab = ['alias', 'ingreso', 'estado', 'inicio_examen', 'fin_examen', 'respondidas', 'correctas', 'total', 'porcentaje', 'aprobado', 'ip'];
  const lineas = [cab.join(','), ...filas.map((p) => [
    p.alias, p.creadoEn, p.estado ?? 'SIN_INICIAR', p.iniciadoEn, p.finalizadoEn, p.respondidas,
    p.correctas, p.total, p.porcentaje,
    p.estado === 'FINALIZADO' ? ((p.porcentaje ?? 0) >= config.porcentajeAprobacion ? 'SI' : 'NO') : '',
    p.ip,
  ].map(csv).join(','))];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="resultados-simulacro.csv"');
  res.status(200).send('﻿' + lineas.join('\n'));
});
