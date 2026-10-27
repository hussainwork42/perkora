import { db, maybeOne, one } from '../db';
import { randomToken, sha256 } from './crypto';
import type { Ctx, SessionUser } from '../http/core';
import { clearCookie, setCookie } from '../http/core';

const SESSION_COOKIE = 'pk_session';
const SESSION_DAYS = 30;

export async function createSession(ctx: Ctx, userId: string) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  // rotate: one fresh session per sign-in (prevents fixation)
  if (ctx.sessionId) await db.query('delete from sessions where id = $1', [ctx.sessionId]);
  const s = await one<{ id: string }>(
    db,
    `insert into sessions (user_id, token_hash, csrf_token, user_agent, expires_at) values ($1, $2, $3, $4, $5) returning id`,
    [userId, sha256(token), randomToken(16), ctx.userAgent.slice(0, 300), expires],
  );
  await db.query('update users set last_sign_in_at = now() where id = $1', [userId]);
  ctx.sessionId = s.id;
  setCookie(ctx, SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400 });
}

export async function destroySession(ctx: Ctx) {
  if (ctx.sessionId) await db.query('delete from sessions where id = $1', [ctx.sessionId]);
  ctx.sessionId = null;
  ctx.user = null;
  clearCookie(ctx, SESSION_COOKIE);
  clearCookie(ctx, 'pk_biz');
}

export async function destroyAllSessions(userId: string) {
  await db.query('delete from sessions where user_id = $1', [userId]);
}

export async function loadSession(ctx: Ctx) {
  const token = ctx.cookies[SESSION_COOKIE];
  if (!token || token.length > 100) return;
  const row = await maybeOne<any>(
    db,
    `select s.id as session_id, s.last_seen_at, u.id, u.name, u.email, u.platform_role, u.locale, u.is_demo
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.status = 'active'`,
    [sha256(token)],
  );
  if (!row) {
    clearCookie(ctx, SESSION_COOKIE);
    return;
  }
  ctx.sessionId = row.session_id;
  const user: SessionUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    platformRole: row.platform_role,
    locale: row.locale,
    isDemo: row.is_demo,
  };
  ctx.user = user;
  // sliding expiry, written at most every 10 minutes
  if (Date.now() - new Date(row.last_seen_at).getTime() > 10 * 60 * 1000) {
    await db.query(`update sessions set last_seen_at = now(), expires_at = now() + interval '${SESSION_DAYS} days' where id = $1`, [row.session_id]);
    setCookie(ctx, SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400 });
  }
}

export async function purgeExpiredSessions() {
  await db.query('delete from sessions where expires_at < now()');
  await db.query(`delete from rate_limits where window_start < now() - interval '1 day'`);
}
