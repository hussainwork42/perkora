/**
 * A small, dependency-free PostgreSQL client implementing the v3 wire protocol.
 *
 * Why this exists: Perkora was built in an environment without npm registry
 * access, so the standard `pg` package could not be installed. This driver
 * deliberately mirrors the parts of the `pg` API that Perkora uses
 * (`Pool#query`, `Pool#connect`, `client.query`, `client.release`) so it can be
 * replaced by `pg` with a one-line import change.
 *
 * Supported: TLS (sslmode disable/prefer/require/verify-full), SCRAM-SHA-256,
 * MD5 and cleartext auth, the extended query protocol with unnamed statements
 * (parameters are never interpolated into SQL), the simple query protocol for
 * migrations, text-format type parsing for the types Perkora uses, pooling.
 */
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sslmode: 'disable' | 'prefer' | 'require' | 'verify-full';
  sslCa?: string;
  applicationName?: string;
  connectTimeoutMs?: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  fields: string[];
}

export interface Queryable {
  query<T = any>(text: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
}

export class PgError extends Error {
  code?: string;
  detail?: string;
  hint?: string;
  constraint?: string;
  table?: string;
  column?: string;
  severity?: string;
  position?: string;
  constructor(fields: Record<string, string>) {
    super(fields.M || 'PostgreSQL error');
    this.name = 'PgError';
    this.code = fields.C;
    this.detail = fields.D;
    this.hint = fields.H;
    this.constraint = fields.n;
    this.table = fields.t;
    this.column = fields.c;
    this.severity = fields.S;
    this.position = fields.P;
  }
}

export function parseConnectionString(url: string): PgConfig {
  const u = new URL(url);
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must start with postgres:// or postgresql://');
  }
  const mode = (u.searchParams.get('sslmode') || 'prefer') as string;
  const sslmode = (
    mode === 'verify-ca' ? 'verify-full' : ['disable', 'prefer', 'require', 'verify-full'].includes(mode) ? mode : 'prefer'
  ) as PgConfig['sslmode'];
  return {
    host: decodeURIComponent(u.hostname) || '127.0.0.1',
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    database: decodeURIComponent(u.pathname.replace(/^\//, '') || 'postgres'),
    sslmode,
  };
}

/* ------------------------------------------------------------------ */
/* Type parsing (text format)                                          */
/* ------------------------------------------------------------------ */

const TS_RE = /^(\d{4,})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?(?:([+-])(\d{2})(?::?(\d{2}))?(?::?(\d{2}))?|Z)?( BC)?$/;

function parseTimestamptz(s: string): Date | string {
  if (s === 'infinity' || s === '-infinity') return s;
  const m = TS_RE.exec(s);
  if (!m) return new Date(s);
  const [, y, mo, d, h, mi, sec, frac, sign, oh, om, os] = m;
  const ms = frac ? Math.round(Number(frac) * 1000) : 0;
  let t = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec), ms);
  if (sign) {
    const off = (Number(oh) * 3600 + Number(om || 0) * 60 + Number(os || 0)) * 1000;
    t = sign === '+' ? t - off : t + off;
  }
  return new Date(t);
}

function parseBytea(s: string): Buffer {
  if (s.startsWith('\\x')) return Buffer.from(s.slice(2), 'hex');
  // escape format fallback
  return Buffer.from(s.replace(/\\(\d{3})/g, (_m, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\\\/g, '\\'), 'binary');
}

export function parseArray(s: string, item: (v: string) => unknown): unknown[] {
  // Parses one-dimensional PostgreSQL array literals: {a,"b c",NULL}
  if (s === '{}') return [];
  const out: unknown[] = [];
  let i = 1;
  while (i < s.length - 1) {
    if (s[i] === '"') {
      let v = '';
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\') i++;
        v += s[i];
        i++;
      }
      i++; // closing quote
      out.push(item(v));
    } else {
      let j = i;
      while (j < s.length - 1 && s[j] !== ',') j++;
      const raw = s.slice(i, j);
      out.push(raw === 'NULL' ? null : item(raw));
      i = j;
    }
    if (s[i] === ',') i++;
  }
  return out;
}

const num = (v: string) => Number(v);
const int8 = (v: string) => {
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : v;
};
const str = (v: string) => v;

const PARSERS: Record<number, (v: string) => unknown> = {
  16: (v) => v === 't',
  17: parseBytea,
  20: int8,
  21: num,
  23: num,
  26: num,
  700: num,
  701: num,
  1700: num,
  114: (v) => JSON.parse(v),
  3802: (v) => JSON.parse(v),
  1082: str,
  1114: (v) => parseTimestamptz(v + 'Z'),
  1184: parseTimestamptz,
  1000: (v) => parseArray(v, (x) => x === 't'),
  1005: (v) => parseArray(v, num),
  1007: (v) => parseArray(v, num),
  1016: (v) => parseArray(v, int8),
  1009: (v) => parseArray(v, str),
  1015: (v) => parseArray(v, str),
  2951: (v) => parseArray(v, str),
  1182: (v) => parseArray(v, str),
  1185: (v) => parseArray(v, parseTimestamptz),
  3807: (v) => parseArray(v, (x) => JSON.parse(x)),
};

function quoteArrayItem(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (Array.isArray(v)) return toArrayLiteral(v);
  const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function toArrayLiteral(arr: readonly unknown[]): string {
  return '{' + arr.map(quoteArrayItem).join(',') + '}';
}

export function serializeParam(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return '\\x' + v.toString('hex');
  if (Array.isArray(v)) return toArrayLiteral(v);
  return JSON.stringify(v);
}

/* ------------------------------------------------------------------ */
/* Message writing                                                     */
/* ------------------------------------------------------------------ */

class Writer {
  private parts: Buffer[] = [];
  private size = 0;
  int32(n: number) {
    const b = Buffer.alloc(4);
    b.writeInt32BE(n);
    return this.push(b);
  }
  int16(n: number) {
    const b = Buffer.alloc(2);
    b.writeInt16BE(n);
    return this.push(b);
  }
  cstr(s: string) {
    return this.push(Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]));
  }
  bytes(b: Buffer) {
    return this.push(b);
  }
  private push(b: Buffer) {
    this.parts.push(b);
    this.size += b.length;
    return this;
  }
  /** Build a message with a type byte (or none for startup messages). */
  message(type?: string): Buffer {
    const body = Buffer.concat(this.parts, this.size);
    const header = Buffer.alloc(type ? 5 : 4);
    if (type) {
      header.write(type, 0, 'ascii');
      header.writeInt32BE(body.length + 4, 1);
    } else {
      header.writeInt32BE(body.length + 4, 0);
    }
    return Buffer.concat([header, body]);
  }
}

/* ------------------------------------------------------------------ */
/* Connection                                                          */
/* ------------------------------------------------------------------ */

interface PendingQuery {
  messages: Buffer;
  resolve: (r: QueryResult) => void;
  reject: (e: Error) => void;
  fields: { name: string; oid: number }[];
  rows: any[];
  command: string;
  rowCount: number;
  error?: Error;
}

export class Connection {
  private socket!: net.Socket | tls.TLSSocket;
  private buf: Buffer = Buffer.alloc(0);
  private queue: PendingQuery[] = [];
  private current: PendingQuery | null = null;
  private ready = false;
  dead = false;
  lastUsed = Date.now();
  private onFatal: ((e: Error) => void) | null = null;
  private startupResolve: (() => void) | null = null;
  private startupReject: ((e: Error) => void) | null = null;
  private scram: { clientNonce: string; firstBare: string; serverSignature?: Buffer } | null = null;

  constructor(private cfg: PgConfig) {}

  async connect(): Promise<void> {
    const sock = await this.openSocket();
    this.socket = sock;
    sock.setNoDelay(true);
    sock.on('data', (d: Buffer) => this.onData(d));
    sock.on('error', (e) => this.fail(e));
    sock.on('close', () => this.fail(new Error('Connection to PostgreSQL closed')));
    await new Promise<void>((resolve, reject) => {
      this.startupResolve = resolve;
      this.startupReject = reject;
      const w = new Writer().int32(196608);
      const params: Record<string, string> = {
        user: this.cfg.user,
        database: this.cfg.database,
        client_encoding: 'UTF8',
        TimeZone: 'UTC',
        DateStyle: 'ISO, MDY',
        application_name: this.cfg.applicationName || 'perkora',
      };
      for (const [k, v] of Object.entries(params)) w.cstr(k).cstr(v);
      w.bytes(Buffer.from([0]));
      sock.write(w.message());
    });
  }

  private openSocket(): Promise<net.Socket | tls.TLSSocket> {
    const { host, port, sslmode } = this.cfg;
    const timeout = this.cfg.connectTimeoutMs ?? 10000;
    return new Promise((resolve, reject) => {
      const raw = net.connect({ host, port });
      const timer = setTimeout(() => {
        raw.destroy();
        reject(new Error(`Timed out connecting to PostgreSQL at ${host}:${port}`));
      }, timeout);
      raw.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      raw.once('connect', () => {
        if (sslmode === 'disable') {
          clearTimeout(timer);
          raw.removeAllListeners('error');
          return resolve(raw);
        }
        // SSLRequest
        raw.write(new Writer().int32(80877103).message());
        raw.once('data', (d: Buffer) => {
          const answer = String.fromCharCode(d[0]);
          if (answer === 'S') {
            const secure = tls.connect({
              socket: raw,
              servername: net.isIP(host) ? undefined : host,
              rejectUnauthorized: sslmode === 'verify-full',
              ca: this.cfg.sslCa,
            });
            secure.once('secureConnect', () => {
              clearTimeout(timer);
              raw.removeAllListeners('error');
              secure.removeAllListeners('error');
              resolve(secure);
            });
            secure.once('error', (e) => {
              clearTimeout(timer);
              reject(e);
            });
          } else if (sslmode === 'prefer') {
            clearTimeout(timer);
            raw.removeAllListeners('error');
            resolve(raw);
          } else {
            clearTimeout(timer);
            raw.destroy();
            reject(new Error('The PostgreSQL server does not support SSL, but sslmode requires it'));
          }
        });
      });
    });
  }

  private fail(e: Error) {
    if (this.dead) return;
    this.dead = true;
    this.ready = false;
    if (this.startupReject) {
      this.startupReject(e);
      this.startupReject = null;
    }
    if (this.current) this.current.reject(e);
    for (const q of this.queue) q.reject(e);
    this.current = null;
    this.queue = [];
    this.onFatal?.(e);
    try {
      this.socket?.destroy();
    } catch {
      /* ignore */
    }
  }

  setFatalHandler(fn: (e: Error) => void) {
    this.onFatal = fn;
  }

  close() {
    if (this.dead) return;
    try {
      this.socket.write(new Writer().message('X'));
      this.socket.end();
    } catch {
      /* ignore */
    }
    this.dead = true;
  }

  private onData(d: Buffer) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.buf.length >= 5) {
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < len + 1) break;
      const type = String.fromCharCode(this.buf[0]);
      const body = this.buf.subarray(5, len + 1);
      this.buf = this.buf.subarray(len + 1);
      try {
        this.handle(type, body);
      } catch (e) {
        this.fail(e as Error);
        return;
      }
    }
  }

  private handle(type: string, body: Buffer) {
    switch (type) {
      case 'R':
        return this.handleAuth(body);
      case 'S': // ParameterStatus
      case 'K': // BackendKeyData
      case 'N': // Notice
      case 'A': // Notification
      case '1': // ParseComplete
      case '2': // BindComplete
      case '3': // CloseComplete
      case 'n': // NoData
      case 'I': // EmptyQueryResponse
      case 's': // PortalSuspended
        return;
      case 'T': {
        if (!this.current) return;
        const n = body.readInt16BE(0);
        let off = 2;
        const fields: { name: string; oid: number }[] = [];
        for (let i = 0; i < n; i++) {
          const end = body.indexOf(0, off);
          const name = body.toString('utf8', off, end);
          off = end + 1;
          const oid = body.readInt32BE(off + 6);
          off += 18;
          fields.push({ name, oid });
        }
        this.current.fields = fields;
        this.current.rows = [];
        return;
      }
      case 'D': {
        const q = this.current;
        if (!q) return;
        const n = body.readInt16BE(0);
        let off = 2;
        const row: Record<string, unknown> = {};
        for (let i = 0; i < n; i++) {
          const len = body.readInt32BE(off);
          off += 4;
          const f = q.fields[i];
          if (len === -1) {
            row[f.name] = null;
          } else {
            const raw = body.toString('utf8', off, off + len);
            off += len;
            const p = PARSERS[f.oid];
            row[f.name] = p ? p(raw) : raw;
          }
        }
        q.rows.push(row);
        return;
      }
      case 'C': {
        if (!this.current) return;
        const tag = body.toString('utf8', 0, body.length - 1);
        const parts = tag.split(' ');
        this.current.command = parts[0];
        const last = Number(parts[parts.length - 1]);
        this.current.rowCount = Number.isFinite(last) ? last : 0;
        return;
      }
      case 'E': {
        const fields: Record<string, string> = {};
        let off = 0;
        while (off < body.length && body[off] !== 0) {
          const code = String.fromCharCode(body[off]);
          const end = body.indexOf(0, off + 1);
          fields[code] = body.toString('utf8', off + 1, end);
          off = end + 1;
        }
        const err = new PgError(fields);
        if (!this.ready) {
          this.startupReject?.(err);
          this.startupReject = null;
          this.fail(err);
          return;
        }
        if (this.current) this.current.error = err;
        return;
      }
      case 'Z': {
        if (!this.ready) {
          this.ready = true;
          this.startupResolve?.();
          this.startupResolve = null;
          this.startupReject = null;
          return;
        }
        const q = this.current;
        this.current = null;
        if (q) {
          if (q.error) q.reject(q.error);
          else q.resolve({ rows: q.rows, rowCount: q.rowCount, command: q.command, fields: q.fields.map((f) => f.name) });
        }
        this.lastUsed = Date.now();
        this.pump();
        return;
      }
      default:
        return;
    }
  }

  private handleAuth(body: Buffer) {
    const code = body.readInt32BE(0);
    const { password, user } = this.cfg;
    if (code === 0) return; // AuthenticationOk
    if (code === 3) {
      this.socket.write(new Writer().cstr(password).message('p'));
      return;
    }
    if (code === 5) {
      const salt = body.subarray(4, 8);
      const inner = crypto.createHash('md5').update(password + user).digest('hex');
      const outer = crypto.createHash('md5').update(Buffer.concat([Buffer.from(inner), salt])).digest('hex');
      this.socket.write(new Writer().cstr('md5' + outer).message('p'));
      return;
    }
    if (code === 10) {
      const mechs = body.toString('utf8', 4).split('\0').filter(Boolean);
      if (!mechs.includes('SCRAM-SHA-256')) throw new Error('Server requires an unsupported SASL mechanism: ' + mechs.join(', '));
      const clientNonce = crypto.randomBytes(18).toString('base64');
      const firstBare = 'n=*,r=' + clientNonce;
      this.scram = { clientNonce, firstBare };
      const first = Buffer.from('n,,' + firstBare, 'utf8');
      this.socket.write(new Writer().cstr('SCRAM-SHA-256').int32(first.length).bytes(first).message('p'));
      return;
    }
    if (code === 11) {
      if (!this.scram) throw new Error('Unexpected SASL continue');
      const serverFirst = body.toString('utf8', 4);
      const attrs = Object.fromEntries(serverFirst.split(',').map((kv) => [kv[0], kv.slice(2)]));
      if (!attrs.r?.startsWith(this.scram.clientNonce)) throw new Error('SCRAM: server nonce mismatch');
      const salt = Buffer.from(attrs.s, 'base64');
      const iterations = Number(attrs.i);
      const salted = crypto.pbkdf2Sync(password.normalize('NFKC'), salt, iterations, 32, 'sha256');
      const clientKey = crypto.createHmac('sha256', salted).update('Client Key').digest();
      const storedKey = crypto.createHash('sha256').update(clientKey).digest();
      const withoutProof = 'c=biws,r=' + attrs.r;
      const authMessage = this.scram.firstBare + ',' + serverFirst + ',' + withoutProof;
      const clientSig = crypto.createHmac('sha256', storedKey).update(authMessage).digest();
      const proof = Buffer.alloc(clientKey.length);
      for (let i = 0; i < proof.length; i++) proof[i] = clientKey[i] ^ clientSig[i];
      const serverKey = crypto.createHmac('sha256', salted).update('Server Key').digest();
      this.scram.serverSignature = crypto.createHmac('sha256', serverKey).update(authMessage).digest();
      const final = Buffer.from(withoutProof + ',p=' + proof.toString('base64'), 'utf8');
      this.socket.write(new Writer().bytes(final).message('p'));
      return;
    }
    if (code === 12) {
      const serverFinal = body.toString('utf8', 4);
      const v = serverFinal.split(',').find((p) => p.startsWith('v='));
      if (!v || !this.scram?.serverSignature) throw new Error('SCRAM: missing server signature');
      const got = Buffer.from(v.slice(2), 'base64');
      if (got.length !== this.scram.serverSignature.length || !crypto.timingSafeEqual(got, this.scram.serverSignature)) {
        throw new Error('SCRAM: server signature mismatch');
      }
      return;
    }
    throw new Error('Unsupported PostgreSQL authentication method: ' + code);
  }

  private pump() {
    if (this.current || this.dead || !this.ready) return;
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    this.socket.write(next.messages);
  }

  query<T = any>(text: string, params: readonly unknown[] = []): Promise<QueryResult<T>> {
    if (this.dead) return Promise.reject(new Error('Connection is closed'));
    let messages: Buffer;
    if (params.length === 0 && text.includes(';') && /;\s*\S/.test(text)) {
      // multiple statements: simple query protocol (used for migrations only)
      messages = new Writer().cstr(text).message('Q');
    } else {
      const parse = new Writer().cstr('').cstr(text).int16(0).message('P');
      const bind = new Writer().cstr('').cstr('').int16(0).int16(params.length);
      for (const p of params) {
        const s = serializeParam(p);
        if (s === null) bind.int32(-1);
        else {
          const b = Buffer.from(s, 'utf8');
          bind.int32(b.length).bytes(b);
        }
      }
      bind.int16(0);
      const describe = new Writer().bytes(Buffer.from('P')).cstr('').message('D');
      const execute = new Writer().cstr('').int32(0).message('E');
      const sync = new Writer().message('S');
      messages = Buffer.concat([parse, bind.message('B'), describe, execute, sync]);
    }
    return new Promise<QueryResult<T>>((resolve, reject) => {
      this.queue.push({
        messages,
        resolve: resolve as (r: QueryResult) => void,
        reject,
        fields: [],
        rows: [],
        command: '',
        rowCount: 0,
      });
      this.pump();
    });
  }
}

/* ------------------------------------------------------------------ */
/* Pool                                                                */
/* ------------------------------------------------------------------ */

export interface PoolClient extends Queryable {
  release(destroy?: boolean | Error): void;
}

export interface PoolOptions {
  max?: number;
  idleTimeoutMs?: number;
  acquireTimeoutMs?: number;
}

export class Pool implements Queryable {
  private idle: Connection[] = [];
  private total = 0;
  private waiters: { resolve: (c: Connection) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }[] = [];
  private closed = false;
  private reaper: NodeJS.Timeout;
  private max: number;
  private idleTimeoutMs: number;
  private acquireTimeoutMs: number;

  constructor(private cfg: PgConfig, opts: PoolOptions = {}) {
    this.max = opts.max ?? 10;
    this.idleTimeoutMs = opts.idleTimeoutMs ?? 30000;
    this.acquireTimeoutMs = opts.acquireTimeoutMs ?? 15000;
    this.reaper = setInterval(() => this.reap(), 10000);
    this.reaper.unref();
  }

  get stats() {
    return { total: this.total, idle: this.idle.length, waiting: this.waiters.length };
  }

  private reap() {
    const now = Date.now();
    this.idle = this.idle.filter((c) => {
      if (now - c.lastUsed > this.idleTimeoutMs && this.total > 1) {
        c.close();
        this.total--;
        return false;
      }
      return true;
    });
  }

  private async create(): Promise<Connection> {
    this.total++;
    const c = new Connection(this.cfg);
    try {
      await c.connect();
    } catch (e) {
      this.total--;
      throw e;
    }
    c.setFatalHandler(() => {
      const i = this.idle.indexOf(c);
      if (i >= 0) this.idle.splice(i, 1);
    });
    return c;
  }

  private async acquire(): Promise<Connection> {
    if (this.closed) throw new Error('Pool is closed');
    while (this.idle.length) {
      const c = this.idle.pop()!;
      if (!c.dead) return c;
      this.total--;
    }
    if (this.total < this.max) return this.create();
    return new Promise<Connection>((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex((w) => w.timer === timer);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error('Timed out waiting for a database connection'));
      }, this.acquireTimeoutMs);
      this.waiters.push({ resolve, reject, timer });
    });
  }

  private releaseConn(c: Connection, destroy: boolean) {
    if (destroy || c.dead || this.closed) {
      if (!c.dead) c.close();
      this.total--;
      // a slot opened up: create a connection for the next waiter
      const w = this.waiters.shift();
      if (w) {
        clearTimeout(w.timer);
        this.create().then(w.resolve, w.reject);
      }
      return;
    }
    const w = this.waiters.shift();
    if (w) {
      clearTimeout(w.timer);
      w.resolve(c);
      return;
    }
    this.idle.push(c);
  }

  async connect(): Promise<PoolClient> {
    const c = await this.acquire();
    let released = false;
    return {
      query: (text, params) => c.query(text, params),
      release: (destroy?: boolean | Error) => {
        if (released) return;
        released = true;
        this.releaseConn(c, Boolean(destroy));
      },
    };
  }

  async query<T = any>(text: string, params?: readonly unknown[]): Promise<QueryResult<T>> {
    const c = await this.acquire();
    try {
      const r = await c.query<T>(text, params);
      this.releaseConn(c, false);
      return r;
    } catch (e) {
      this.releaseConn(c, c.dead);
      throw e;
    }
  }

  async end() {
    this.closed = true;
    clearInterval(this.reaper);
    for (const c of this.idle) c.close();
    this.idle = [];
    for (const w of this.waiters) {
      clearTimeout(w.timer);
      w.reject(new Error('Pool is closed'));
    }
    this.waiters = [];
  }
}
