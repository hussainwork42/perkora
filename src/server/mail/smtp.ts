/**
 * Minimal SMTP client (RFC 5321) for transactional email: replies to website messages and
 * new-message notifications. Supports implicit TLS (port 465), STARTTLS (587) and plain
 * connections (local testing only), with AUTH PLAIN or LOGIN. Plain-text UTF-8 bodies.
 */
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import { config } from '../config';

export interface MailSettings {
  host: string;
  port: number;
  secure: 'ssl' | 'starttls' | 'none';
  user: string;
  pass: string;
  from: string;
}

/** Mail settings from the environment, or null when email sending isn't set up. */
export function mailSettings(): MailSettings | null {
  const c = config();
  if (!c.SMTP_HOST || !c.SMTP_USER || !c.SMTP_PASS) return null;
  const port = c.SMTP_PORT ?? 465;
  return {
    host: c.SMTP_HOST,
    port,
    secure: c.SMTP_SECURE ?? (port === 465 ? 'ssl' : 'starttls'),
    user: c.SMTP_USER,
    pass: c.SMTP_PASS,
    from: c.MAIL_FROM || `Perkora <${c.SMTP_USER}>`,
  };
}

export class MailError extends Error {}

const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
const addr = (s: string) => (/<([^>]+)>/.exec(s)?.[1] ?? s).trim();
const encodeWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);
const wrap76 = (b64: string) => b64.replace(/.{1,76}/g, (m) => m + '\r\n');

function formatFrom(from: string) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m && m[1] ? `${encodeWord(m[1].replace(/^"|"$/g, ''))} <${m[2]}>` : `<${addr(from)}>`;
}

export function buildMessage(m: { from: string; to: string; subject: string; text: string; replyTo?: string; inReplyTo?: string }): string {
  const domain = addr(m.from).split('@')[1] ?? 'perkora.local';
  const headers = [
    `From: ${formatFrom(clean(m.from))}`,
    `To: <${addr(clean(m.to))}>`,
    ...(m.replyTo ? [`Reply-To: <${addr(clean(m.replyTo))}>`] : []),
    `Subject: ${encodeWord(clean(m.subject))}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    ...(m.inReplyTo ? [`In-Reply-To: ${clean(m.inReplyTo)}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];
  return headers.join('\r\n') + '\r\n\r\n' + wrap76(Buffer.from(m.text.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64'));
}

class Conn {
  private buf = '';
  private waiters: ((line: string) => void)[] = [];
  private lines: string[] = [];
  private failure: Error | null = null;
  constructor(public socket: net.Socket | tls.TLSSocket) {
    this.attach(socket);
  }
  attach(socket: net.Socket | tls.TLSSocket) {
    this.socket = socket;
    socket.setEncoding('utf8');
    socket.on('data', (d: string) => {
      this.buf += d;
      let i: number;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).replace(/\r$/, '');
        this.buf = this.buf.slice(i + 1);
        const w = this.waiters.shift();
        if (w) w(line);
        else this.lines.push(line);
      }
    });
    socket.on('error', (e) => this.fail(e));
    socket.on('close', () => this.fail(new MailError('The mail server closed the connection.')));
  }
  private fail(e: Error) {
    if (!this.failure) this.failure = e;
    for (const w of this.waiters.splice(0)) w('');
  }
  private nextLine(): Promise<string> {
    if (this.lines.length) return Promise.resolve(this.lines.shift()!);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) =>
      this.waiters.push((l) => (this.failure && l === '' ? reject(this.failure) : resolve(l))),
    );
  }
  /** Read one (possibly multi-line) reply; throws unless the code is in `ok`. */
  async reply(ok: number[]): Promise<{ code: number; text: string }> {
    const parts: string[] = [];
    for (;;) {
      const line = await this.nextLine();
      parts.push(line.slice(4));
      if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
        const code = Number(line.slice(0, 3));
        const text = parts.join('\n');
        if (!ok.includes(code)) throw new MailError(`Mail server said: ${code} ${text}`.slice(0, 300));
        return { code, text };
      }
    }
  }
  async cmd(line: string, ok: number[]) {
    this.socket.write(line + '\r\n');
    return this.reply(ok);
  }
}

export async function sendMail(msg: { to: string; subject: string; text: string; replyTo?: string; inReplyTo?: string }, settings: MailSettings | null = mailSettings()): Promise<void> {
  if (!settings) throw new MailError('Email sending is not set up.');
  const s = settings;
  const timeoutMs = 20000;
  const socket: net.Socket = await new Promise((resolve, reject) => {
    const onErr = (e: Error) => reject(new MailError(`Couldn’t reach the mail server (${e.message}).`));
    const sock =
      s.secure === 'ssl'
        ? tls.connect({ host: s.host, port: s.port, servername: net.isIP(s.host) ? undefined : s.host }, () => resolve(sock))
        : net.connect({ host: s.host, port: s.port }, () => resolve(sock));
    sock.once('error', onErr);
    sock.setTimeout(timeoutMs, () => sock.destroy(new Error('timed out')));
  });
  const c = new Conn(socket);
  const helo = (() => {
    try {
      return new URL(config().APP_URL).hostname || 'localhost';
    } catch {
      return 'localhost';
    }
  })();
  try {
    await c.reply([220]);
    let ehlo = await c.cmd(`EHLO ${helo}`, [250]);
    if (s.secure === 'starttls') {
      await c.cmd('STARTTLS', [220]);
      const secured = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const t = tls.connect({ socket, servername: net.isIP(s.host) ? undefined : s.host }, () => resolve(t));
        t.once('error', reject);
      });
      c.attach(secured);
      ehlo = await c.cmd(`EHLO ${helo}`, [250]);
    }
    if (s.user) {
      if (/AUTH[ =][^\n]*PLAIN/i.test(ehlo.text) || !/AUTH[ =][^\n]*LOGIN/i.test(ehlo.text)) {
        await c.cmd(`AUTH PLAIN ${Buffer.from(`\0${s.user}\0${s.pass}`).toString('base64')}`, [235]);
      } else {
        await c.cmd('AUTH LOGIN', [334]);
        await c.cmd(Buffer.from(s.user).toString('base64'), [334]);
        await c.cmd(Buffer.from(s.pass).toString('base64'), [235]);
      }
    }
    await c.cmd(`MAIL FROM:<${addr(s.from)}>`, [250]);
    await c.cmd(`RCPT TO:<${addr(clean(msg.to))}>`, [250, 251]);
    await c.cmd('DATA', [354]);
    const data = buildMessage({ ...msg, from: s.from })
      .split('\r\n')
      .map((l) => (l.startsWith('.') ? '.' + l : l))
      .join('\r\n');
    c.socket.write(data.replace(/\r\n$/, '') + '\r\n.\r\n');
    await c.reply([250]);
    await c.cmd('QUIT', [221]).catch(() => undefined);
  } catch (e) {
    if (e instanceof MailError) throw e;
    throw new MailError(/auth/i.test(String((e as Error).message)) ? 'The mail server rejected the username or password.' : `Sending failed (${(e as Error).message}).`);
  } finally {
    c.socket.destroy();
  }
}
