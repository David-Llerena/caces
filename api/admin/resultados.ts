import { getPool, asegurarEsquema } from '../_lib/db.js';
import { route } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { config } from '../_lib/config.js';
import { cerrarTodosLosVencidos } from '../_lib/admin.js';

const fecha = (d: Date | null) => d ? d.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : '';
const csv = (v: unknown) => {
  const s = v === null || v === undefined ? '' : v instanceof Date ? fecha(v) : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET /api/admin/resultados?token=TOKEN_ADMIN  → CSV con TODOS los intentos (histórico completo)
export default route(['GET'], async (req, res) => {
  await requireAdmin(req);
  const db = getPool();
  await asegurarEsquema();
  await cerrarTodosLosVencidos(db);

  const { rows } = await db.query(
    `SELECT u.alias AS usuario, e.ultimo_ingreso, COALESCE(e.ingresos, 0) AS ingresos,
            i.numero AS intento, i.estado, i.iniciado_en, i.finalizado_en,
            CASE WHEN i.finalizado_en IS NOT NULL
                 THEN ROUND(EXTRACT(EPOCH FROM (i.finalizado_en - i.iniciado_en)) / 60) END AS minutos,
            (SELECT COUNT(*) FROM respuesta r WHERE r.intento_id = i.id) AS respondidas,
            i.correctas, i.total, i.porcentaje,
            (i.estado = 'FINALIZADO' AND i.finalizado_en >= i.expira_en) AS por_tiempo
       FROM unnest($1::text[]) WITH ORDINALITY AS u(alias, orden)
       LEFT JOIN estudiante e ON lower(e.alias) = lower(u.alias)
       LEFT JOIN intento i ON i.estudiante_id = e.id
      ORDER BY u.orden, i.numero`,
    [config.usuarios.map((u) => u.usuario)]);

  const cab = ['usuario', 'intento', 'estado', 'inicio', 'fin', 'minutos', 'respondidas', 'correctas', 'total',
    'porcentaje', 'aprobado', 'terminado_por_tiempo', 'veces_ingreso', 'ultimo_ingreso'];
  const lineas = [cab.join(','), ...rows.map((r) => [
    r.usuario, r.intento, r.estado ?? (r.ultimo_ingreso ? 'SIN_INTENTOS' : 'NO_INGRESO'),
    r.iniciado_en, r.finalizado_en, r.minutos, r.intento ? r.respondidas : '', r.correctas, r.total, r.porcentaje,
    r.estado === 'FINALIZADO' ? (Number(r.porcentaje) >= config.porcentajeAprobacion ? 'SI' : 'NO') : '',
    r.estado === 'FINALIZADO' ? (r.por_tiempo ? 'SI' : 'NO') : '',
    r.ingresos, r.ultimo_ingreso,
  ].map(csv).join(','))];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="historico-simulacro.csv"');
  res.status(200).send('﻿' + lineas.join('\n'));
});
