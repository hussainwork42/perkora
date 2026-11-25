import type { Ctx } from '../http/core';
import { setCookie } from '../http/core';

const COOKIE = 'pk_pv';

/** Preview links this browser has opened (most recent first). Only these previews show up in its café list. */
export function previewTokens(ctx: Ctx): string[] {
  return (ctx.cookies[COOKIE] ?? '')
    .split('.')
    .filter((t) => /^[a-z0-9]{12}$/.test(t))
    .slice(0, 12);
}

export function rememberPreview(ctx: Ctx, token: string) {
  const list = [token, ...previewTokens(ctx).filter((t) => t !== token)].slice(0, 12);
  setCookie(ctx, COOKIE, list.join('.'), { maxAge: 60 * 86400, httpOnly: true });
}
