/**
 * Email: the SMTP client against a local fake mail server, the new-message alert,
 * and replying to a website message from the admin.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

interface Received {
  from: string;
  to: string[];
  data: string;
  auth: string;
}
const inbox: Received[] = [];
let rejectAuth = false;

/** A tiny SMTP server that accepts AUTH PLAIN and records each message. */
const smtp = net.createServer((sock) => {
  let buf = '';
  let inData = false;
  let cur: Received = { from: '', to: [], data: '', auth: '' };
  const send = (l: string) => sock.write(l + '\r\n');
  send('220 fake.test ESMTP');
  sock.on('data', (d) => {
    buf += d.toString('utf8');
    for (;;) {
      if (inData) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end < 0) return;
        cur.data = buf.slice(0, end);
        buf = buf.slice(end + 5);
        inData = false;
        inbox.push(cur);
        cur = { from: '', to: [], data: '', auth: cur.auth };
        send('250 OK queued');
        continue;
      }
      const i = buf.indexOf('\r\n');
      if (i < 0) return;
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (/^EHLO/i.test(line)) send('250-fake.test\r\n250 AUTH PLAIN LOGIN');
      else if (/^AUTH PLAIN/i.test(line)) {
        cur.auth = Buffer.from(line.slice(11), 'base64').toString('utf8');
        send(rejectAuth ? '535 5.7.8 Authentication failed' : '235 OK');
      } else if (/^MAIL FROM:/i.test(line)) (cur.from = line.slice(10)), send('250 OK');
      else if (/^RCPT TO:/i.test(line)) (cur.to.push(line.slice(8)), send('250 OK'));
      else if (/^DATA/i.test(line)) (inData = true), send('354 go ahead');
      else if (/^QUIT/i.test(line)) (send('221 bye'), sock.end());
      else send('500 what?');
    }
  });
});
await new Promise<void>((r) => smtp.listen(0, '127.0.0.1', () => r()));
const smtpPort = (smtp.address() as AddressInfo).port;
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = String(smtpPort);
process.env.SMTP_SECURE = 'none';
process.env.SMTP_USER = 'hello@perkora.test';
process.env.SMTP_PASS = 'mail-password';
process.env.MAIL_FROM = 'Perkora <hello@perkora.test>';
process.env.NOTIFY_EMAIL = 'owner@perkora.test';

const { closePool, db, one, resetDb } = await import('../helpers');
const { sendMail, buildMessage } = await import('../../src/server/mail/smtp');
const { createApp } = await import('../../src/server/app');
const { hashPassword } = await import('../../src/server/auth/crypto');

const body = (r: Received) => {
  const [, b64] = r.data.split('\r\n\r\n');
  return Buffer.from(b64.replace(/\r\n/g, ''), 'base64').toString('utf8');
};
const header = (r: Received, name: string) => new RegExp(`^${name}: (.*)$`, 'mi').exec(r.data)?.[1] ?? '';
const waitFor = async (pred: () => boolean) => {
  for (let i = 0; i < 100 && !pred(); i++) await new Promise((r) => setTimeout(r, 20));
};

let server: http.Server;
let base = '';
before(async () => {
  await resetDb();
  server = http.createServer(createApp());
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  server?.close();
  smtp.close();
  await closePool();
});

/** Cookie-keeping form client (same idea as in http.test.ts). */
class Client {
  cookies = new Map<string, string>();
  async req(method: string, path: string, form?: Record<string, string>) {
    const headers: Record<string, string> = { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '), origin: base };
    let b: string | undefined;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      b = new URLSearchParams({ _csrf: this.cookies.get('pk_csrf') ?? '', ...form }).toString();
    }
    const res = await fetch(base + path, { method, headers, body: b, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      if (/Max-Age=0/.test(c)) this.cookies.delete(pair.slice(0, i));
      else this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return { status: res.status, text: await res.text(), location: res.headers.get('location') };
  }
}

describe('sending email', () => {
  test('a message goes through SMTP with UTF-8 text, a safe subject and dot-stuffing', async () => {
    inbox.length = 0;
    await sendMail({ to: 'Ayşe <ayse@example.com>', subject: 'Merhaba\r\nBcc: evil@example.com', text: 'Teşekkürler!\n.\nLine after a dot' });
    assert.equal(inbox.length, 1);
    const m = inbox[0];
    assert.equal(m.from, '<hello@perkora.test>');
    assert.deepEqual(m.to, ['<ayse@example.com>']);
    assert.equal(m.auth, '\0hello@perkora.test\0mail-password');
    assert.equal(body(m), 'Teşekkürler!\r\n.\r\nLine after a dot');
    assert.ok(!/^Bcc:/mi.test(m.data), 'no header injection');
    assert.equal(header(m, 'Subject'), 'Merhaba Bcc: evil@example.com');
  });

  test('non-ASCII subjects and sender names are encoded', () => {
    const raw = buildMessage({ from: 'Kahve Köşesi <k@example.com>', to: 'x@example.com', subject: 'Yeni mesaj – teşekkürler', text: 'x' });
    assert.match(raw, /^From: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <k@example.com>$/m);
    assert.match(raw, /^Subject: =\?UTF-8\?B\?/m);
  });
});

describe('website messages by email', () => {
  test('a new contact message is announced to the team', async () => {
    inbox.length = 0;
    const visitor = new Client();
    await visitor.req('GET', '/contact');
    const r = await visitor.req('POST', '/contact', { name: 'Selin Visitor', email: 'selin@example.com', message: 'Do you support points?' });
    assert.equal(r.status, 200);
    await waitFor(() => inbox.length > 0);
    assert.deepEqual(inbox[0].to, ['<owner@perkora.test>']);
    assert.match(header(inbox[0], 'Reply-To'), /selin@example.com/);
    assert.match(body(inbox[0]), /Do you support points\?/);
  });

  test('the admin replies and the email reaches the visitor; failures are shown, not hidden', async () => {
    const admin = await one(db, `insert into users (name, email, platform_role) values ('Ada Admin', 'ada@example.com', 'admin') returning id`);
    await db.query('insert into user_credentials (user_id, password_hash) values ($1, $2)', [admin.id, await hashPassword('admin-password-123')]);
    const a = new Client();
    await a.req('GET', '/sign-in');
    await a.req('POST', '/sign-in', { email: 'ada@example.com', password: 'admin-password-123' });
    const page = await a.req('GET', '/admin/requests');
    assert.match(page.text, /data-island="ReplyBox"|ReplyBox/);
    const id = (await one(db, `select id from demo_requests where email = 'selin@example.com'`)).id;

    inbox.length = 0;
    const sent = await a.req('POST', `/admin/requests/${id}/reply`, { body: 'Hi Selin,\n\nYes, points are in Premium.\n\nPerkora' });
    assert.equal(sent.status, 303);
    assert.equal(inbox.length, 1);
    assert.deepEqual(inbox[0].to, ['<selin@example.com>']);
    assert.match(body(inbox[0]), /points are in Premium/);
    const reply = await one(db, 'select status, channel from message_replies where request_id = $1', [id]);
    assert.deepEqual([reply.status, reply.channel], ['sent', 'email']);
    assert.equal((await one(db, 'select status from demo_requests where id = $1', [id])).status, 'contacted');
    const thread = await a.req('GET', '/admin/requests?show=all');
    assert.ok(thread.text.includes('points are in Premium'));

    rejectAuth = true;
    const failed = await a.req('POST', `/admin/requests/${id}/reply`, { body: 'Second try' });
    rejectAuth = false;
    assert.equal(failed.status, 303);
    const f = await one(db, `select status, error from message_replies where request_id = $1 and body = 'Second try'`, [id]);
    assert.equal(f.status, 'failed');
    assert.match(f.error, /535|password/i);
  });
});
