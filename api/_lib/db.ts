import pg from 'pg';

let pool: pg.Pool | undefined;

// Pool pequeño: en Vercel cada función es una instancia separada.
// En Neon usa la cadena "pooled" (host con -pooler).
export function getPool(): pg.Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no configurada');
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10_000 });
  }
  return pool;
}

export async function withTx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Columnas agregadas después de la primera versión: se crean solas si faltan,
// así no hay que volver a correr db:init en Neon.
let esquemaListo: Promise<unknown> | undefined;
export function asegurarEsquema(): Promise<unknown> {
  esquemaListo ??= getPool().query(`
    ALTER TABLE estudiante ADD COLUMN IF NOT EXISTS ultimo_ingreso  TIMESTAMPTZ;
    ALTER TABLE estudiante ADD COLUMN IF NOT EXISTS ingresos        INT NOT NULL DEFAULT 0;
    ALTER TABLE estudiante ADD COLUMN IF NOT EXISTS fallos_login    INT NOT NULL DEFAULT 0;
    ALTER TABLE estudiante ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;
  `).catch((e) => { esquemaListo = undefined; throw e; });
  return esquemaListo;
}
