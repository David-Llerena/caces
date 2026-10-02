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
  mejorNota: number | null;
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
            (SELECT MAX(x.porcentaje)::float FROM intento x WHERE x.estudiante_id = e.id AND x.estado = 'FINALIZADO') AS "mejorNota",
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

const usuariosConfigurados = () => config.usuarios.map((u) => u.usuario.toLowerCase());

/** Todos los intentos de un usuario, del más reciente al más antiguo */
export async function intentosDeUsuario(db: pg.Pool, alias: string) {
  const { rows } = await db.query(
    `SELECT i.id, i.numero, i.estado, i.iniciado_en AS "iniciadoEn", i.finalizado_en AS "finalizadoEn",
            i.expira_en AS "expiraEn",
            (i.estado = 'FINALIZADO' AND i.finalizado_en >= i.expira_en) AS "porTiempo",
            (SELECT COUNT(*)::int FROM respuesta r WHERE r.intento_id = i.id) AS respondidas,
            cardinality(i.preguntas) AS "totalPreguntas",
            i.correctas, i.porcentaje::float AS porcentaje
       FROM intento i JOIN estudiante e ON e.id = i.estudiante_id
      WHERE lower(e.alias) = lower($1)
      ORDER BY i.numero DESC`,
    [alias]);
  return rows;
}

/**
 * Línea de tiempo: ingresos, inicios y fines de intento.
 * alias = null → actividad de todos los usuarios configurados.
 */
export async function actividad(db: pg.Pool, alias: string | null, limite = 300) {
  await asegurarEsquema();
  const { rows } = await db.query(
    `SELECT * FROM (
        SELECT e.alias, a.fecha, 'ingreso' AS tipo, NULL::int AS numero, NULL::float AS porcentaje,
               NULL::int AS "intentoId", NULL::text AS detalle, false AS "porTiempo"
          FROM acceso a JOIN estudiante e ON e.id = a.estudiante_id
        UNION ALL
        SELECT e.alias, i.iniciado_en, 'inicio', i.numero, NULL, i.id, NULL, false
          FROM intento i JOIN estudiante e ON e.id = i.estudiante_id
        UNION ALL
        SELECT e.alias, i.finalizado_en, 'fin', i.numero, i.porcentaje::float, i.id,
               i.correctas || ' de ' || i.total, i.finalizado_en >= i.expira_en
          FROM intento i JOIN estudiante e ON e.id = i.estudiante_id
         WHERE i.estado = 'FINALIZADO'
     ) ev
     WHERE lower(ev.alias) = ANY($1::text[])
       AND ($2::text IS NULL OR lower(ev.alias) = lower($2))
     ORDER BY ev.fecha DESC
     LIMIT $3`,
    [usuariosConfigurados(), alias, limite]);
  return rows;
}
