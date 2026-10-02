// Crea las tablas en la base indicada por DATABASE_URL (.env.local)
import 'dotenv/config';
import { config as dotenv } from 'dotenv';
import { readFileSync } from 'node:fs';
import pg from 'pg';

dotenv({ path: '.env.local', override: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(readFileSync('db/schema.sql', 'utf8'));
await client.end();
console.log('✔ Esquema creado/actualizado');
