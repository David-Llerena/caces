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
