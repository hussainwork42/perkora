import { z } from 'zod';
import type { Queryable } from '../db';
import { db, maybeOne, one, tx, isUniqueViolation } from '../db';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../auth/crypto';
import { DomainError } from './errors';
import type { Locale } from '../../shared/i18n';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
export const passwordSchema = z.string().min(10, 'Use at least 10 characters.').max(200, 'That password is too long.');
export const nameSchema = z.string().trim().min(1, 'Enter your name.').max(120, 'That name is too long.');

export const signUpSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });

export async function createUser(
  q: Queryable,
  input: { name: string; email: string; password: string; locale?: Locale; isDemo?: boolean; platformRole?: 'admin' | null },
): Promise<{ id: string }> {
  try {
    const u = await one<{ id: string }>(
      q,
      `insert into users (name, email, locale, is_demo, platform_role) values ($1, $2, $3, $4, $5) returning id`,
      [input.name, input.email.toLowerCase(), input.locale ?? 'en', input.isDemo ?? false, input.platformRole ?? null],
    );
    await q.query(`insert into user_credentials (user_id, password_hash) values ($1, $2)`, [u.id, await hashPassword(input.password)]);
    return u;
  } catch (e) {
    if (isUniqueViolation(e, 'users_email_key')) throw new DomainError('conflict', 'An account with this email already exists.', 409);
    throw e;
  }
}

export async function authenticate(email: string, password: string): Promise<{ id: string } | null> {
  const row = await maybeOne<{ id: string; password_hash: string; status: string }>(
    db,
    `select u.id, c.password_hash, u.status from users u join user_credentials c on c.user_id = u.id where lower(u.email) = lower($1)`,
    [email.trim()],
  );
  if (!row) {
    await burnPasswordCheck(password);
    return null;
  }
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok || row.status !== 'active') return null;
  return { id: row.id };
}

export async function changePassword(userId: string, current: string, next: string): Promise<boolean> {
  const row = await maybeOne<{ password_hash: string }>(db, 'select password_hash from user_credentials where user_id = $1', [userId]);
  if (!row || !(await verifyPassword(current, row.password_hash))) return false;
  await db.query('update user_credentials set password_hash = $2, updated_at = now() where user_id = $1', [userId, await hashPassword(next)]);
  return true;
}

/** The customer record attached to a user account, created on first use. */
export async function ensureCustomerForUser(q: Queryable, user: { id: string; name: string; email: string }): Promise<string> {
  const ex = await maybeOne<{ id: string }>(q, 'select id from customers where user_id = $1', [user.id]);
  if (ex) return ex.id;
  const isDemo = Boolean((await maybeOne<{ is_demo: boolean }>(q, 'select is_demo from users where id = $1', [user.id]))?.is_demo);
  const c = await one<{ id: string }>(
    q,
    `insert into customers (user_id, name, email, is_demo) values ($1, $2, $3, $4)
     on conflict (user_id) do update set updated_at = now() returning id`,
    [user.id, user.name, user.email, isDemo],
  );
  return c.id;
}

/**
 * Delete a customer account. Memberships are closed, personal data removed,
 * and transaction rows kept (without personal data) for the cafés' records.
 */
export async function deleteCustomerAccount(userId: string) {
  return tx(async (q) => {
    const owns = await maybeOne(q, `select 1 from business_members where user_id = $1 and role = 'owner' and status = 'active'`, [userId]);
    if (owns) throw new DomainError('conflict', 'This account owns a café. Transfer or close the café before deleting the account.', 409);
    const c = await maybeOne<{ id: string }>(q, 'select id from customers where user_id = $1', [userId]);
    if (c) {
      await q.query(`update loyalty_memberships set status = 'closed', marketing_consent = false, updated_at = now() where customer_id = $1`, [c.id]);
      await q.query(`update customer_rewards set status = 'void', voided_at = now() where status = 'available' and membership_id in (select id from loyalty_memberships where customer_id = $1)`, [c.id]);
      await q.query(
        `update customers set name = 'Deleted customer', email = null, phone = null, birthday_month = null, birthday_day = null, user_id = null, deleted_at = now(), updated_at = now() where id = $1`,
        [c.id],
      );
    }
    await q.query(`update business_members set status = 'deactivated' where user_id = $1`, [userId]);
    await q.query(`insert into audit_logs (actor_user_id, action, target_type, target_id) values (null, 'account.deleted', 'user', $1::text)`, [userId]);
    await q.query('delete from sessions where user_id = $1', [userId]);
    await q.query('delete from user_credentials where user_id = $1', [userId]);
    await q.query(`update users set status = 'deleted', name = 'Deleted user', email = 'deleted-' || id || '@deleted.invalid' where id = $1`, [userId]);
  });
}
