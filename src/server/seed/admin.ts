import crypto from 'node:crypto';
import { db, maybeOne, tx } from '../db';
import { createUser } from '../domain/accounts';
import { hashPassword } from '../auth/crypto';

/**
 * Create (or promote) a platform administrator. There is deliberately no
 * public route for this. The password comes from ADMIN_PASSWORD or is
 * generated and printed once.
 */
export async function createAdminCli(args: string[]) {
  const arg = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const name = arg('name') ?? process.env.ADMIN_NAME ?? 'Perkora Admin';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Pass --email you@example.com (or set ADMIN_EMAIL).');
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  const existing = await maybeOne<{ id: string }>(db, 'select id from users where lower(email) = $1', [email]);
  if (existing) {
    await db.query(`update users set platform_role = 'admin', status = 'active' where id = $1`, [existing.id]);
    if (process.env.ADMIN_PASSWORD) {
      await db.query('update user_credentials set password_hash = $2, updated_at = now() where user_id = $1', [existing.id, await hashPassword(password)]);
    }
    console.log(`${email} is now a platform administrator.`);
    return;
  }
  await tx((q) => createUser(q, { name, email, password, platformRole: 'admin' }));
  console.log(`Administrator created: ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Temporary password (shown once): ${password}`);
}
