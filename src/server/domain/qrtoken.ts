import { config } from '../config';
import { hmac, safeEqual } from '../auth/crypto';

/**
 * Customer identification tokens shown as a QR code on the customer's card.
 * Format: PK1.<membership id, base64url>.<expiry, base36 seconds>.<HMAC-SHA256, 128 bits>
 * The token contains no personal data and stops working after TOKEN_TTL.
 * Staff actions still require a signed-in staff account, server-side checks,
 * an explicit confirmation and an idempotency key, so replaying a captured
 * code inside its lifetime only identifies the member.
 */
export const TOKEN_TTL_SECONDS = 5 * 60;

function uuidToB64(id: string): string {
  return Buffer.from(id.replace(/-/g, ''), 'hex').toString('base64url');
}
function b64ToUuid(s: string): string | null {
  const hex = Buffer.from(s, 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sign(idPart: string, expPart: string): string {
  return hmac(config().APP_SECRET, `qr1:${idPart}:${expPart}`).subarray(0, 16).toString('base64url');
}

export function issueMemberToken(membershipId: string, now = new Date()): { token: string; expiresAt: Date } {
  const exp = Math.floor(now.getTime() / 1000) + TOKEN_TTL_SECONDS;
  const idPart = uuidToB64(membershipId);
  const expPart = exp.toString(36);
  return { token: `PK1.${idPart}.${expPart}.${sign(idPart, expPart)}`, expiresAt: new Date(exp * 1000) };
}

export type TokenCheck = { ok: true; membershipId: string } | { ok: false; reason: 'invalid' | 'expired' };

export function verifyMemberToken(token: string, now = new Date()): TokenCheck {
  const parts = token.trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'PK1') return { ok: false, reason: 'invalid' };
  const [, idPart, expPart, sig] = parts;
  if (!/^[A-Za-z0-9_-]{22}$/.test(idPart) || !/^[a-z0-9]{1,10}$/.test(expPart) || !/^[A-Za-z0-9_-]{22}$/.test(sig)) return { ok: false, reason: 'invalid' };
  if (!safeEqual(sig, sign(idPart, expPart))) return { ok: false, reason: 'invalid' };
  const exp = parseInt(expPart, 36);
  if (!Number.isFinite(exp) || exp * 1000 < now.getTime()) return { ok: false, reason: 'expired' };
  const id = b64ToUuid(idPart);
  return id ? { ok: true, membershipId: id } : { ok: false, reason: 'invalid' };
}

/** Accepts a raw token, a scan URL (…/t/m/<token>) or text containing either. */
export function extractToken(input: string): string | null {
  const m = /PK1\.[A-Za-z0-9_-]{22}\.[a-z0-9]{1,10}\.[A-Za-z0-9_-]{22}/.exec(input);
  return m ? m[0] : null;
}

export function memberScanUrl(token: string): string {
  return `${config().APP_URL.replace(/\/$/, '')}/t/m/${token}`;
}
