import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from './config';
import { db } from './db';
import type { Ctx, Reply } from './http/core';
import { HttpError, json, parseCookies, readBody, field, setCookie, wantsJson, redirect, setSecureCookies } from './http/core';
import { Router } from './http/router';
import { loadSession } from './auth/session';
import { randomToken, safeEqual } from './auth/crypto';
import { DomainError } from './domain/errors';
import { detectLocale, getMessages, isLocale } from '../shared/i18n';
import { registerRoutes } from './routes';
import { renderError } from './routes/errors';

const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const publicDir = path.resolve(process.cwd(), 'public');

function serveStatic(req: IncomingMessage, res: ServerResponse, urlPath: string): boolean {
  if (!/^\/(assets|fonts)\/|^\/(favicon\.svg|robots\.txt|manifest\.webmanifest)$/.test(urlPath)) return false;
  const rel = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const file = path.join(publicDir, rel);
  if (!file.startsWith(publicDir + path.sep)) return false;
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const immutable = urlPath.startsWith('/assets/') || urlPath.startsWith('/fonts/');
  // serve the pre-compressed copy written by the build when the browser accepts gzip
  let serveFile = file;
  let size = stat.size;
  let encoding: string | undefined;
  if (/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? '')) && /\.(js|css|svg)$/.test(file)) {
    try {
      const gz = fs.statSync(file + '.gz');
      serveFile = file + '.gz';
      size = gz.size;
      encoding = 'gzip';
    } catch {
      /* no compressed copy */
    }
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'content-length': size,
    ...(encoding ? { 'content-encoding': encoding, vary: 'accept-encoding' } : {}),
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': urlPath.startsWith('/fonts/') ? '*' : '',
  });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(serveFile).pipe(res);
  return true;
}

function securityHeaders(): Record<string, string> {
  const https = config().APP_URL.startsWith('https://');
  const h: Record<string, string> = {
    'content-security-policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
    'cross-origin-opener-policy': 'same-origin',
  };
  if (https) h['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
  return h;
}

function clientIp(req: IncomingMessage): string {
  if (config().TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Cross-site request forgery protection: same-origin check + double-submit token. */
async function verifyCsrf(ctx: Ctx) {
  const origin = ctx.req.headers.origin;
  const allowed = new Set([new URL(config().APP_URL).origin, `${ctx.url.protocol}//${ctx.req.headers.host}`]);
  if (origin && origin !== 'null' && !allowed.has(origin)) throw new HttpError(403, 'Cross-site request blocked.');
  if (!origin) {
    const ref = ctx.req.headers.referer;
    if (ref) {
      try {
        if (!allowed.has(new URL(ref).origin)) throw new HttpError(403, 'Cross-site request blocked.');
      } catch (e) {
        if (e instanceof HttpError) throw e;
      }
    }
  }
  const header = ctx.req.headers['x-csrf-token'];
  let token = typeof header === 'string' ? header : '';
  if (!token) token = field(await readBody(ctx), '_csrf');
  if (!token || !ctx.cookies.pk_csrf || !safeEqual(token, ctx.cookies.pk_csrf)) {
    throw new HttpError(403, 'Your session form expired. Reload the page and try again.');
  }
}

async function logError(ctx: Ctx | null, e: unknown) {
  const err = e as Error & { code?: string };
  console.error(`[error] ${ctx?.method ?? ''} ${ctx?.path ?? ''}`, err);
  try {
    await db.query(`insert into error_logs (message, path, method, error_code, stack) values ($1, $2, $3, $4, $5)`, [
      String(err?.message ?? err).slice(0, 1000),
      ctx?.path?.slice(0, 300) ?? null,
      ctx?.method ?? null,
      err?.code ?? null,
      String(err?.stack ?? '').slice(0, 4000),
    ]);
  } catch {
    /* database may be unavailable */
  }
}

export function createApp() {
  const router = new Router();
  registerRoutes(router);
  setSecureCookies(config().APP_URL.startsWith('https://'));
  const sec = securityHeaders();

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const started = Date.now();
    let ctx: Ctx | null = null;
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (serveStatic(req, res, url.pathname)) return;

      const cookies = parseCookies(req.headers.cookie);
      const localeCookie = cookies.pk_locale;
      ctx = {
        req,
        res,
        method: (req.method ?? 'GET').toUpperCase(),
        url,
        path: url.pathname,
        params: {},
        query: url.searchParams,
        cookies,
        ip: clientIp(req),
        userAgent: String(req.headers['user-agent'] ?? ''),
        sessionId: null,
        user: null,
        csrfToken: cookies.pk_csrf && /^[A-Za-z0-9_-]{20,64}$/.test(cookies.pk_csrf) ? cookies.pk_csrf : '',
        locale: 'en',
        t: getMessages('en'),
        flash: null,
        outCookies: [],
        body: null,
        state: {},
        startedAt: started,
      };
      if (!ctx.csrfToken) {
        ctx.csrfToken = randomToken(24);
        ctx.cookies.pk_csrf = ctx.csrfToken;
        setCookie(ctx, 'pk_csrf', ctx.csrfToken, { maxAge: 7 * 86400 });
      }
      if (cookies.pk_flash) {
        try {
          ctx.flash = JSON.parse(Buffer.from(cookies.pk_flash, 'base64url').toString('utf8'));
        } catch {
          /* ignore */
        }
        setCookie(ctx, 'pk_flash', '', { maxAge: 0 });
      }
      await loadSession(ctx);
      ctx.locale = isLocale(localeCookie) ? localeCookie : (ctx.user?.locale ?? detectLocale(req.headers['accept-language'] as string));
      ctx.t = getMessages(ctx.locale);

      const match = router.match(ctx.method, ctx.path);
      let out: Reply;
      if (!match) out = renderError(ctx, 404);
      else if (match === 'method') out = renderError(ctx, 405);
      else {
        ctx.params = match.params;
        if (!['GET', 'HEAD'].includes(ctx.method)) await verifyCsrf(ctx);
        out = await match.handler(ctx);
      }
      send(res, ctx, out, sec);
    } catch (e) {
      if (!ctx) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Internal error');
        return;
      }
      let out: Reply;
      if (e instanceof DomainError) {
        if (wantsJson(ctx)) out = json({ error: { code: e.code, message: e.message, details: e.details ?? null } }, e.status);
        else if (e.status === 403 && !ctx.user) out = redirect(ctx, `/sign-in?next=${encodeURIComponent(ctx.path)}`);
        else out = renderError(ctx, e.status, e.message);
      } else if (e instanceof HttpError) {
        out = wantsJson(ctx) ? json({ error: { code: 'http_' + e.status, message: e.message } }, e.status) : renderError(ctx, e.status, e.message);
      } else {
        await logError(ctx, e);
        const ref = crypto.randomBytes(4).toString('hex');
        out = wantsJson(ctx)
          ? json({ error: { code: 'internal', message: `Something went wrong on our side (ref ${ref}). Please try again.` } }, 500)
          : renderError(ctx, 500, `Something went wrong on our side (ref ${ref}). Please try again.`);
      }
      if (!res.headersSent) send(res, ctx, out, sec);
    } finally {
      if (ctx && config().LOG_LEVEL === 'debug') console.log(`${ctx.method} ${ctx.path} ${res.statusCode} ${Date.now() - started}ms`);
    }
  };
}

function send(res: ServerResponse, ctx: Ctx, out: Reply, sec: Record<string, string>) {
  const headers: Record<string, string | string[]> = { ...sec, ...out.headers };
  if (ctx.outCookies.length) headers['set-cookie'] = ctx.outCookies;
  let body = out.body;
  const type = out.headers['content-type'] ?? '';
  if (
    body.length > 1024 &&
    /^(text\/|application\/json|image\/svg)/.test(type) &&
    /\bgzip\b/.test(String(ctx.req.headers['accept-encoding'] ?? ''))
  ) {
    body = zlib.gzipSync(body, { level: 6 });
    headers['content-encoding'] = 'gzip';
    headers.vary = 'accept-encoding';
  }
  res.writeHead(out.status, headers);
  res.end(ctx.method === 'HEAD' ? undefined : body);
}
