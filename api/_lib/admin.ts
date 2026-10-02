import type pg from 'pg';
import { GRACIA_SEGUNDOS } from './config.js';
import { finalizarIntento } from './examen.js';

/** Cierra todos los intentos vencidos para que los reportes estén al día */
export async function cerrarTodosLosVencidos(db: pg.Pool) {
  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM intento WHERE estado = 'EN_CURSO' AND now() > expira_en + make_interval(secs => $1)`,
    [GRACIA_SEGUNDOS]);
  for (const v of rows) await finalizarIntento(db, v.id);
}

/** Una fila por participante con su último intento */
export async function listarParticipantes(db: pg.Pool) {
  const { rows } = await db.query(
    `SELECT e.id, e.alias, e.creado_en AS "creadoEn", e.ip, e.navegador,
            i.id AS "intentoId", i.estado, i.iniciado_en AS "iniciadoEn", i.finalizado_en AS "finalizadoEn",
            i.expira_en AS "expiraEn",
            (SELECT COUNT(*)::int FROM respuesta r WHERE r.intento_id = i.id) AS respondidas,
            i.correctas, i.total, i.porcentaje::float AS porcentaje
       FROM estudiante e
       LEFT JOIN LATERAL (
            SELECT * FROM intento WHERE estudiante_id = e.id ORDER BY numero DESC LIMIT 1
       ) i ON true
      ORDER BY e.creado_en DESC`);
  return rows as {
    id: number; alias: string; creadoEn: Date; ip: string | null; navegador: string | null;
    intentoId: number | null; estado: 'EN_CURSO' | 'FINALIZADO' | null;
    iniciadoEn: Date | null; finalizadoEn: Date | null; expiraEn: Date | null;
    respondidas: number; correctas: number | null; total: number | null; porcentaje: number | null;
  }[];
}
