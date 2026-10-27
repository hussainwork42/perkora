import { Pool, parseConnectionString, PgError, type PoolClient, type Queryable, type QueryResult } from './pg/driver';
import { config } from '../config';

export type { Queryable, QueryResult };
export { PgError };

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const cfg = config();
  const pg = parseConnectionString(cfg.DATABASE_URL);
  if (cfg.DATABASE_CA_CERT) pg.sslCa = cfg.DATABASE_CA_CERT.replace(/\\n/g, '\n');
  pool = new Pool(pg, { max: cfg.DATABASE_POOL_MAX });
  return pool;
}

export function setPool(p: Pool) {
  pool = p;
}

export async function closePool() {
  if (pool) await pool.end();
  pool = null;
}

/** The default query interface (auto-commit, pooled). */
export const db: Queryable = {
  query: (text, params) => getPool().query(text, params),
};

export async function one<T = any>(q: Queryable, text: string, params?: readonly unknown[]): Promise<T> {
  const r = await q.query<T>(text, params);
  if (r.rows.length !== 1) throw new Error(`Expected exactly one row, got ${r.rows.length}`);
  return r.rows[0];
}

export async function maybeOne<T = any>(q: Queryable, text: string, params?: readonly unknown[]): Promise<T | null> {
  const r = await q.query<T>(text, params);
  return r.rows[0] ?? null;
}

export async function many<T = any>(q: Queryable, text: string, params?: readonly unknown[]): Promise<T[]> {
  const r = await q.query<T>(text, params);
  return r.rows;
}

/**
 * Run `fn` inside a database transaction. Rolls back on any thrown error.
 * Serialization failures and deadlocks are retried a few times.
 */
export async function tx<T>(fn: (q: Queryable) => Promise<T>, opts: { retries?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    const client: PoolClient = await getPool().connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      client.release();
      return result;
    } catch (e) {
      let broken = false;
      try {
        await client.query('rollback');
      } catch {
        broken = true;
      }
      client.release(broken);
      const code = (e as PgError).code;
      if ((code === '40001' || code === '40P01') && attempt < retries) continue;
      throw e;
    }
  }
}

export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const pe = e as PgError;
  return pe?.code === '23505' && (!constraint || pe.constraint === constraint);
}
