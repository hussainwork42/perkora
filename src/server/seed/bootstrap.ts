/**
 * First-run setup for hosts without a shell (for example Render's free plan):
 *  - `node dist/cli.cjs bootstrap` applies migrations, seeds plans, and creates the first
 *    platform admin from ADMIN_EMAIL + ADMIN_PASSWORD (only if that account does not exist yet;
 *    an existing account's password is never changed).
 *  - the server calls ensureDemo() after it starts listening, so the demo café is built in the
 *    background on first boot when DEMO_MODE=true. Everything here is safe to repeat.
 */
import { config } from '../config';
import { db, maybeOne, tx } from '../db';
import { migrate } from '../db/migrate';
import { createUser } from '../domain/accounts';
import { seedPlans } from './seed';

export async function bootstrap() {
  await migrate();
  await seedPlans();
  console.log('plans ready');
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!email) return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return console.warn('ADMIN_EMAIL is not a valid email address — no admin created.');
  const existing = await maybeOne<{ id: string; platform_role: string }>(db, 'select id, platform_role from users where lower(email) = $1', [email]);
  if (existing) {
    if (existing.platform_role !== 'admin') {
      await db.query(`update users set platform_role = 'admin', status = 'active' where id = $1`, [existing.id]);
      console.log(`${email} is now a platform administrator.`);
    }
    return;
  }
  if (password.length < 12) return console.warn('ADMIN_PASSWORD must be at least 12 characters — no admin created.');
  await tx((q) => createUser(q, { name: process.env.ADMIN_NAME || 'Perkora Admin', email, password, platformRole: 'admin' }));
  console.log(`Administrator created: ${email}`);
}

/** Builds the demo cafés if DEMO_MODE=true and they are missing or were left half-built. */
export async function ensureDemo() {
  if (!config().DEMO_MODE) return;
  const demo = await maybeOne(db, `select 1 from businesses where slug = 'perkora-demo-cafe'`);
  const complete = await maybeOne(db, `select 1 from businesses where is_demo and default_currency = 'TRY'`);
  if (demo && complete) return;
  const { seedDemo, resetDemoData } = await import('./demo');
  if (demo) {
    console.log('demo data incomplete — rebuilding');
    await resetDemoData();
  } else {
    console.log('building demo data in the background…');
    await seedDemo();
  }
}
