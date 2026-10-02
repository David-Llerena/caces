// Carga el banco de preguntas desde CSV (idempotente: se puede re-ejecutar).
//   npm run db:cargar -- --preguntas data/preguntas.csv
import 'dotenv/config';
import { config as dotenv } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';
import { parseCsv } from './csv.js';

dotenv({ path: '.env.local', override: true });

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const rutaPreg = arg('preguntas') ?? (existsSync('data/preguntas.csv') ? 'data/preguntas.csv' : undefined);
if (!rutaPreg) {
  console.error('Indica --preguntas <archivo.csv> (o crea data/preguntas.csv)');
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query('BEGIN');
try {
  // ---------------- Preguntas ----------------
  if (rutaPreg) {
    const filas = parseCsv(readFileSync(rutaPreg, 'utf8'));
    let n = 0;
    for (const [idx, f] of filas.entries()) {
      const linea = idx + 2;
      const codigo = f.codigo || `P${String(idx + 1).padStart(3, '0')}`;
      const correcta = (f.correcta ?? '').toUpperCase();
      const opciones = ['a', 'b', 'c', 'd', 'e'].filter((l) => f[l]).map((l) => ({ letra: l.toUpperCase(), texto: f[l] }));
      if (!f.enunciado) throw new Error(`Línea ${linea}: falta "enunciado"`);
      if (opciones.length < 2) throw new Error(`Línea ${linea}: se necesitan al menos 2 opciones (a, b, ...)`);
      if (!opciones.some((o) => o.letra === correcta)) throw new Error(`Línea ${linea}: "correcta" debe ser una de ${opciones.map((o) => o.letra).join(', ')}`);

      const { rows: [p] } = await db.query<{ id: number }>(
        `INSERT INTO pregunta (codigo, area, enunciado, activa) VALUES ($1, $2, $3, $4)
         ON CONFLICT (codigo) DO UPDATE SET area = EXCLUDED.area, enunciado = EXCLUDED.enunciado, activa = EXCLUDED.activa
         RETURNING id`,
        [codigo, f.area || 'General', f.enunciado, (f.activa ?? 'si').toLowerCase() !== 'no']);
      for (const o of opciones) {
        await db.query(
          `INSERT INTO opcion (pregunta_id, letra, texto, es_correcta) VALUES ($1, $2, $3, $4)
           ON CONFLICT (pregunta_id, letra) DO UPDATE SET texto = EXCLUDED.texto, es_correcta = EXCLUDED.es_correcta`,
          [p.id, o.letra, o.texto, o.letra === correcta]);
      }
      // Opciones que ya no están en el CSV y que nadie ha respondido se eliminan
      await db.query(
        `DELETE FROM opcion o WHERE o.pregunta_id = $1 AND NOT (o.letra = ANY($2))
           AND NOT EXISTS (SELECT 1 FROM respuesta r WHERE r.opcion_id = o.id)`,
        [p.id, opciones.map((o) => o.letra)]);
      n++;
    }
    console.log(`✔ ${n} preguntas cargadas desde ${rutaPreg}`);
  }

  await db.query('COMMIT');
} catch (e) {
  await db.query('ROLLBACK');
  console.error('✖ No se cargó nada:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await db.end();
}
