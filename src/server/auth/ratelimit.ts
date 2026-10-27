import { db, one } from '../db';
import { DomainError } from '../domain/errors';

/**
 * Fixed-window rate limiting stored in Postgres, so limits hold across
 * multiple app instances. Throws a DomainError('rate_limited') when exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const r = await one<{ count: number }>(
    db,
    `insert into rate_limits (key, window_start, count)
     values ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [key, windowSeconds],
  );
  if (r.count > limit) {
    throw new DomainError('rate_limited', 'Too many attempts. Please wait a moment and try again.', 429);
  }
}
