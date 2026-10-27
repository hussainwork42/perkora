import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Messages, Locale } from '../../shared/i18n';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  platformRole: 'admin' | null;
  locale: Locale;
  isDemo: boolean;
}

export interface Flash {
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface UploadedFile {
  field: string;
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface ParsedBody {
  fields: Record<string, string | string[]>;
  files: UploadedFile[];
  json?: unknown;
}

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  url: URL;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  cookies: Record<string, string>;
  ip: string;
  userAgent: string;
  sessionId: string | null;
  user: SessionUser | null;
  csrfToken: string;
  locale: Locale;
  t: Messages;
  flash: Flash | null;
  outCookies: string[];
  body: ParsedBody | null;
  /** route-specific state set by guards (business context, etc.) */
  state: Record<string, any>;
  startedAt: number;
}

export interface Reply {
  status: number;
  headers: Record<string, string>;
  body: string | Buffer;
}

/* ------------------------------------------------------------------ */
/* Cookies                                                             */
/* ------------------------------------------------------------------ */

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k || k in out) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export interface CookieOpts {
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
}

export function serializeCookie(name: string, value: string, o: CookieOpts = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? '/'}`];
  if (o.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(o.maxAge)}`);
  if (o.httpOnly !== false) parts.push('HttpOnly');
  if (o.secure) parts.push('Secure');
  parts.push(`SameSite=${o.sameSite ?? 'Lax'}`);
  return parts.join('; ');
}

let secureCookies = false;
export function setSecureCookies(v: boolean) {
  secureCookies = v;
}

export function setCookie(ctx: Ctx, name: string, value: string, o: CookieOpts = {}) {
  ctx.outCookies.push(serializeCookie(name, value, { secure: secureCookies, ...o }));
}

export function clearCookie(ctx: Ctx, name: string) {
  ctx.outCookies.push(serializeCookie(name, '', { maxAge: 0, secure: secureCookies }));
}

/* ------------------------------------------------------------------ */
/* Replies                                                             */
/* ------------------------------------------------------------------ */

export function reply(status: number, body: string | Buffer, headers: Record<string, string> = {}): Reply {
  return { status, body, headers };
}

export function htmlReply(body: string, status = 200): Reply {
  return reply(status, body, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
}

export function json(data: unknown, status = 200): Reply {
  return reply(status, JSON.stringify(data), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
}

export function setFlash(ctx: Ctx, flash: Flash) {
  setCookie(ctx, 'pk_flash', Buffer.from(JSON.stringify(flash)).toString('base64url'), { maxAge: 60 });
}

/** Only same-site relative paths are accepted as redirect targets. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n]/.test(next)) return fallback;
  return next;
}

export function redirect(ctx: Ctx, location: string, flash?: Flash, status = 303): Reply {
  if (flash) setFlash(ctx, flash);
  return reply(status, '', { location: safeNext(location, '/') });
}

export function back(ctx: Ctx, fallback: string, flash?: Flash): Reply {
  const ref = ctx.req.headers.referer;
  let target = fallback;
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.host === ctx.url.host) target = u.pathname + u.search;
    } catch {
      /* ignore */
    }
  }
  return redirect(ctx, target, flash);
}

export function wantsJson(ctx: Ctx): boolean {
  return ctx.path.startsWith('/api/') || (ctx.req.headers.accept ?? '').includes('application/json');
}

/* ------------------------------------------------------------------ */
/* Body parsing                                                        */
/* ------------------------------------------------------------------ */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readRaw(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, 'The request is too large.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function addField(fields: Record<string, string | string[]>, k: string, v: string) {
  const cur = fields[k];
  if (cur === undefined) fields[k] = v;
  else if (Array.isArray(cur)) cur.push(v);
  else fields[k] = [cur, v];
}

function parseMultipart(buf: Buffer, boundary: string): ParsedBody {
  const fields: Record<string, string | string[]> = {};
  const files: UploadedFile[] = [];
  const delim = Buffer.from('--' + boundary);
  let pos = buf.indexOf(delim);
  while (pos !== -1) {
    pos += delim.length;
    if (buf[pos] === 45 && buf[pos + 1] === 45) break; // closing --
    pos += 2; // CRLF
    const headerEnd = buf.indexOf('\r\n\r\n', pos);
    if (headerEnd === -1) break;
    const headers = buf.toString('utf8', pos, headerEnd);
    const next = buf.indexOf(delim, headerEnd + 4);
    if (next === -1) break;
    const content = buf.subarray(headerEnd + 4, next - 2);
    const disp = /content-disposition:\s*form-data;([^\r\n]*)/i.exec(headers)?.[1] ?? '';
    const name = /\bname="([^"]*)"/i.exec(disp)?.[1];
    const filename = /\bfilename="([^"]*)"/i.exec(disp)?.[1];
    const ctype = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? 'application/octet-stream';
    if (name) {
      if (filename !== undefined) {
        if (content.length > 0) files.push({ field: name, filename, contentType: ctype, data: Buffer.from(content) });
      } else addField(fields, name, content.toString('utf8'));
    }
    pos = next;
  }
  return { fields, files };
}

export async function readBody(ctx: Ctx, limit = 256 * 1024): Promise<ParsedBody> {
  if (ctx.body) return ctx.body;
  const type = (ctx.req.headers['content-type'] ?? '').toLowerCase();
  const boundary = /multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(ctx.req.headers['content-type'] ?? '');
  const raw = await readRaw(ctx.req, boundary ? Math.max(limit, 2.5 * 1024 * 1024) : limit);
  let body: ParsedBody;
  if (boundary) {
    body = parseMultipart(raw, boundary[1] ?? boundary[2]);
  } else if (type.startsWith('application/json')) {
    let parsed: unknown;
    try {
      parsed = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    } catch {
      throw new HttpError(400, 'The request body is not valid JSON.');
    }
    const fields: Record<string, string | string[]> = {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const tok = (parsed as Record<string, unknown>)._csrf;
      if (typeof tok === 'string') fields._csrf = tok;
    }
    body = { fields, files: [], json: parsed };
  } else {
    const fields: Record<string, string | string[]> = {};
    for (const [k, v] of new URLSearchParams(raw.toString('utf8'))) addField(fields, k, v);
    body = { fields, files: [] };
  }
  ctx.body = body;
  return body;
}

/** Read a single string field (the first value if repeated). */
export function field(body: ParsedBody, name: string): string {
  const v = body.fields[name];
  if (v === undefined) return '';
  return Array.isArray(v) ? (v[0] ?? '') : v;
}

export function fieldAll(body: ParsedBody, name: string): string[] {
  const v = body.fields[name];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function formObject(body: ParsedBody): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(body.fields)) if (k !== '_csrf') out[k] = field(body, k);
  return out;
}
