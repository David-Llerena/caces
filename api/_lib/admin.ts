import type pg from 'pg';
import { config, GRACIA_SEGUNDOS } from './config.js';
import { finalizarIntento } from './examen.js';
import { asegurarEsquema } from './db.js';

/** Cierra todos los intentos vencidos para que los reportes estén al día */
export async function cerrarTodosLosVencidos(db: pg.Pool) {
  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM intento WHERE estado = 'EN_CURSO' AND now() > expira_en + make_interval(secs => $1)`,
    [GRACIA_SEGUNDOS]);
  for (const v of rows) await finalizarIntento(db, v.id);
}

export interface FilaParticipante {
  alias: string; id: number | null; ultimoIngreso: Date | null; ingresos: number;
  ip: string | null; navegador: string | null;
  intentoId: number | null; estado: 'EN_CURSO' | 'FINALIZADO' | null; intentos: number;
  iniciadoEn: Date | null; finalizadoEn: Date | null; expiraEn: Date | null;
  respondidas: number; correctas: number | null; total: number | null; porcentaje: number | null;
}

/** Una fila por usuario habilitado (aunque nunca haya ingresado), con su último intento */
export async function listarParticipantes(db: pg.Pool): Promise<FilaParticipante[]> {
  await asegurarEsquema();
  const usuarios = config.usuarios.map((u) => u.usuario);
  const { rows } = await db.query<FilaParticipante>(
    `SELECT u.alias, e.id, e.ultimo_ingreso AS "ultimoIngreso", COALESCE(e.ingresos, 0) AS ingresos,
            e.ip, e.navegador,
            i.id AS "intentoId", i.estado, i.iniciado_en AS "iniciadoEn", i.finalizado_en AS "finalizadoEn",
            i.expira_en AS "expiraEn",
            (SELECT COUNT(*)::int FROM intento x WHERE x.estudiante_id = e.id) AS intentos,
            COALESCE((SELECT COUNT(*)::int FROM respuesta r WHERE r.intento_id = i.id), 0) AS respondidas,
            i.correctas, i.total, i.porcentaje::float AS porcentaje
       FROM unnest($1::text[]) WITH ORDINALITY AS u(alias, orden)
       LEFT JOIN estudiante e ON lower(e.alias) = lower(u.alias)
       LEFT JOIN LATERAL (
            SELECT * FROM intento WHERE estudiante_id = e.id ORDER BY numero DESC LIMIT 1
       ) i ON true
      ORDER BY u.orden`,
    [usuarios]);
  return rows;
}
