import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getPool } from './index';

/**
 * Applies SQL files from /migrations in filename order. Each file runs inside
 * its own transaction and is recorded in schema_migrations with a checksum, so
 * an edited, already-applied migration is detected instead of silently skipped.
 */
export async function migrate(dir = path.resolve(process.cwd(), 'migrations'), log: (m: string) => void = console.log) {
  const pool = getPool();
  await pool.query(`create table if not exists schema_migrations (
    filename text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`);
  const applied = new Map<string, string>(
    (await pool.query<{ filename: string; checksum: string }>('select filename, checksum from schema_migrations')).rows.map((r) => [
      r.filename,
      r.checksum,
    ]),
  );
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
  let count = 0;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    if (applied.has(file)) {
      if (applied.get(file) !== checksum) {
        throw new Error(`Migration ${file} was modified after it was applied. Create a new migration instead.`);
      }
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql + '\n;select 1;');
      await client.query('insert into schema_migrations (filename, checksum) values ($1, $2)', [file, checksum]);
      await client.query('commit');
      log(`applied ${file}`);
      count++;
    } catch (e) {
      await client.query('rollback').catch(() => undefined);
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    } finally {
      client.release();
    }
  }
  if (!count) log('database is up to date');
  return count;
}
