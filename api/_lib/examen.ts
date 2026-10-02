import type pg from 'pg';
import { config, GRACIA_SEGUNDOS } from './config.js';
import { HttpError } from './http.js';

type Q = pg.PoolClient | pg.Pool;

export interface IntentoRow {
  id: number;
  estudiante_id: number;
  numero: number;
  estado: 'EN_CURSO' | 'FINALIZADO';
  iniciado_en: Date;
  expira_en: Date;
  finalizado_en: Date | null;
  preguntas: number[];
  correctas: number | null;
  total: number | null;
  porcentaje: string | null;
}

const expirado = (i: IntentoRow) => Date.now() > i.expira_en.getTime() + GRACIA_SEGUNDOS * 1000;

// ---------------------------------------------------------------------
// Calificación (siempre en servidor)
// ---------------------------------------------------------------------
export async function finalizarIntento(db: Q, intentoId: number): Promise<void> {
  await db.query(
    `UPDATE intento i
        SET estado = 'FINALIZADO',
            finalizado_en = LEAST(now(), i.expira_en + make_interval(secs => $2)),
            total = cardinality(i.preguntas),
            correctas = sub.correctas,
            porcentaje = CASE WHEN cardinality(i.preguntas) = 0 THEN 0
                              ELSE ROUND(sub.correctas * 100.0 / cardinality(i.preguntas), 2) END
       FROM (SELECT COUNT(*) FILTER (WHERE o.es_correcta)::int AS correctas
               FROM respuesta r JOIN opcion o ON o.id = r.opcion_id
              WHERE r.intento_id = $1) sub
      WHERE i.id = $1 AND i.estado = 'EN_CURSO'`,
    [intentoId, GRACIA_SEGUNDOS],
  );
}

/** Cierra automáticamente intentos en curso cuyo tiempo ya venció */
export async function cerrarVencidos(db: Q, estudianteId: number): Promise<void> {
  const { rows } = await db.query<IntentoRow>(
    `SELECT * FROM intento WHERE estudiante_id = $1 AND estado = 'EN_CURSO'`, [estudianteId]);
  for (const i of rows) if (expirado(i)) await finalizarIntento(db, i.id);
}

// ---------------------------------------------------------------------
// Estado del estudiante (pantalla de inicio)
// ---------------------------------------------------------------------
export async function estadoEstudiante(db: Q, estudianteId: number) {
  await cerrarVencidos(db, estudianteId);
  const { rows } = await db.query<IntentoRow>(
    `SELECT * FROM intento WHERE estudiante_id = $1 ORDER BY numero`, [estudianteId]);
  const enCurso = rows.find((r) => r.estado === 'EN_CURSO');
  const { rows: [{ n }] } = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM pregunta WHERE activa`);
  const numPreguntas = config.numPreguntas > 0 ? Math.min(config.numPreguntas, n) : n;
  return {
    config: {
      duracionMinutos: config.duracionMinutos,
      maxIntentos: config.maxIntentos,
      numPreguntas,
      porcentajeAprobacion: config.porcentajeAprobacion,
    },
    intentosUsados: rows.length,
    puedeIniciar: !enCurso && (config.intentosIlimitados || rows.length < config.maxIntentos) && numPreguntas > 0,
    intentoEnCurso: enCurso ? { id: enCurso.id, expiraEn: enCurso.expira_en } : null,
    historial: rows
      .filter((r) => r.estado === 'FINALIZADO')
      .map((r) => ({
        id: r.id, numero: r.numero, finalizadoEn: r.finalizado_en,
        correctas: r.correctas, total: r.total, porcentaje: Number(r.porcentaje),
      })),
  };
}

// ---------------------------------------------------------------------
// Iniciar o reanudar un intento
// ---------------------------------------------------------------------
export async function iniciarOReanudar(db: pg.PoolClient, estudianteId: number) {
  // Bloqueo por estudiante para evitar dos inicios simultáneos
  await db.query(`SELECT id FROM estudiante WHERE id = $1 FOR UPDATE`, [estudianteId]);
  await cerrarVencidos(db, estudianteId);

  let { rows: [intento] } = await db.query<IntentoRow>(
    `SELECT * FROM intento WHERE estudiante_id = $1 AND estado = 'EN_CURSO'`, [estudianteId]);

  if (!intento) {
    const { rows: [{ usados }] } = await db.query<{ usados: number }>(
      `SELECT COUNT(*)::int AS usados FROM intento WHERE estudiante_id = $1`, [estudianteId]);
    if (!config.intentosIlimitados && usados >= config.maxIntentos) throw new HttpError(409, 'Ya usaste todos tus intentos');

    // Selección aleatoria de preguntas activas
    const limite = config.numPreguntas > 0 ? config.numPreguntas : null;
    const { rows: sel } = await db.query<{ id: number }>(
      `SELECT id FROM pregunta WHERE activa ORDER BY random() LIMIT $1`, [limite]);
    if (sel.length === 0) throw new HttpError(409, 'No hay preguntas cargadas');

    ({ rows: [intento] } = await db.query<IntentoRow>(
      `INSERT INTO intento (estudiante_id, numero, expira_en, preguntas)
       VALUES ($1, $2, now() + make_interval(mins => $3), $4)
       RETURNING *`,
      [estudianteId, usados + 1, config.duracionMinutos, sel.map((r) => r.id)]));
  }

  return {
    intentoId: intento.id,
    numero: intento.numero,
    iniciadoEn: intento.iniciado_en,
    expiraEn: intento.expira_en,
    ahoraServidor: new Date(),
    preguntas: await preguntasSinRespuesta(db, intento.preguntas),
    respuestas: await respuestasGuardadas(db, intento.id),
  };
}

/** Preguntas con opciones, SIN el campo es_correcta */
async function preguntasSinRespuesta(db: Q, ids: number[]) {
  const { rows } = await db.query<{ id: number; area: string; enunciado: string; opciones: { id: number; letra: string; texto: string }[] }>(
    `SELECT p.id, p.area, p.enunciado,
            json_agg(json_build_object('id', o.id, 'letra', o.letra, 'texto', o.texto) ORDER BY o.letra) AS opciones
       FROM unnest($1::int[]) WITH ORDINALITY AS x(pid, pos)
       JOIN pregunta p ON p.id = x.pid
       JOIN opcion o ON o.pregunta_id = p.id
      GROUP BY p.id, x.pos
      ORDER BY x.pos`,
    [ids]);
  return rows;
}

async function respuestasGuardadas(db: Q, intentoId: number): Promise<Record<number, number>> {
  const { rows } = await db.query<{ pregunta_id: number; opcion_id: number }>(
    `SELECT pregunta_id, opcion_id FROM respuesta WHERE intento_id = $1`, [intentoId]);
  return Object.fromEntries(rows.map((r) => [r.pregunta_id, r.opcion_id]));
}

// ---------------------------------------------------------------------
// Autoguardado de respuesta
// ---------------------------------------------------------------------
/** estudianteId = null solo para el panel de administración (ve cualquier intento) */
async function intentoPropio(db: Q, estudianteId: number | null, intentoId: number): Promise<IntentoRow> {
  const { rows: [i] } = await db.query<IntentoRow>(
    `SELECT * FROM intento WHERE id = $1 AND ($2::int IS NULL OR estudiante_id = $2)`, [intentoId, estudianteId]);
  if (!i) throw new HttpError(404, 'Intento no encontrado');
  return i;
}

export async function guardarRespuesta(
  db: Q, estudianteId: number, intentoId: number, preguntaId: number, opcionId: number | null,
) {
  const i = await intentoPropio(db, estudianteId, intentoId);
  if (i.estado !== 'EN_CURSO') throw new HttpError(409, 'El intento ya fue finalizado');
  if (expirado(i)) {
    await finalizarIntento(db, i.id);
    throw new HttpError(409, 'Se acabó el tiempo');
  }
  if (!i.preguntas.includes(preguntaId)) throw new HttpError(400, 'La pregunta no pertenece a este intento');

  if (opcionId === null) {
    await db.query(`DELETE FROM respuesta WHERE intento_id = $1 AND pregunta_id = $2`, [intentoId, preguntaId]);
    return;
  }
  const { rowCount } = await db.query(
    `SELECT 1 FROM opcion WHERE id = $1 AND pregunta_id = $2`, [opcionId, preguntaId]);
  if (!rowCount) throw new HttpError(400, 'Opción inválida');

  await db.query(
    `INSERT INTO respuesta (intento_id, pregunta_id, opcion_id) VALUES ($1, $2, $3)
     ON CONFLICT (intento_id, pregunta_id) DO UPDATE SET opcion_id = EXCLUDED.opcion_id, respondido_en = now()`,
    [intentoId, preguntaId, opcionId]);
}

// ---------------------------------------------------------------------
// Enviar y obtener resultado
// ---------------------------------------------------------------------
export async function enviar(db: Q, estudianteId: number, intentoId: number) {
  const i = await intentoPropio(db, estudianteId, intentoId);
  if (i.estado === 'EN_CURSO') await finalizarIntento(db, i.id);
  return resultado(db, estudianteId, intentoId);
}

export async function resultado(db: Q, estudianteId: number | null, intentoId: number) {
  const i = await intentoPropio(db, estudianteId, intentoId);
  if (i.estado !== 'FINALIZADO') throw new HttpError(409, 'El intento aún está en curso');

  const { rows: porArea } = await db.query<{ area: string; total: number; correctas: number }>(
    `SELECT p.area,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE o.es_correcta)::int AS correctas
       FROM unnest($1::int[]) AS x(pid)
       JOIN pregunta p ON p.id = x.pid
       LEFT JOIN respuesta r ON r.intento_id = $2 AND r.pregunta_id = p.id
       LEFT JOIN opcion o ON o.id = r.opcion_id
      GROUP BY p.area ORDER BY p.area`,
    [i.preguntas, i.id]);
  const { rows: [{ respondidas }] } = await db.query<{ respondidas: number }>(
    `SELECT COUNT(*)::int AS respondidas FROM respuesta WHERE intento_id = $1`, [i.id]);

  const porcentaje = Number(i.porcentaje);
  return {
    intentoId: i.id,
    numero: i.numero,
    correctas: i.correctas ?? 0,
    total: i.total ?? 0,
    respondidas,
    porcentaje,
    aprobado: porcentaje >= config.porcentajeAprobacion,
    porcentajeAprobacion: config.porcentajeAprobacion,
    duracionSegundos: Math.round(((i.finalizado_en?.getTime() ?? Date.now()) - i.iniciado_en.getTime()) / 1000),
    porArea,
    revision: config.mostrarRevision || estudianteId === null ? await revision(db, i) : [],
  };
}

/** Pregunta por pregunta: qué eligió, cuál era la correcta y si acertó */
async function revision(db: Q, i: IntentoRow) {
  const { rows } = await db.query<{
    numero: number; preguntaId: number; area: string; enunciado: string;
    opciones: { id: number; letra: string; texto: string; correcta: boolean }[];
    elegida: number | null; acierto: boolean;
  }>(
    `SELECT x.pos::int AS numero, p.id AS "preguntaId", p.area, p.enunciado,
            (SELECT json_agg(json_build_object('id', o.id, 'letra', o.letra, 'texto', o.texto, 'correcta', o.es_correcta) ORDER BY o.letra)
               FROM opcion o WHERE o.pregunta_id = p.id) AS opciones,
            r.opcion_id AS elegida,
            COALESCE(oe.es_correcta, false) AS acierto
       FROM unnest($1::int[]) WITH ORDINALITY AS x(pid, pos)
       JOIN pregunta p ON p.id = x.pid
       LEFT JOIN respuesta r ON r.intento_id = $2 AND r.pregunta_id = p.id
       LEFT JOIN opcion oe ON oe.id = r.opcion_id
      ORDER BY x.pos`,
    [i.preguntas, i.id]);
  return rows;
}
