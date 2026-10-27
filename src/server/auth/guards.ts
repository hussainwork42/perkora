import { db, maybeOne, many } from '../db';
import type { Ctx, Reply } from '../http/core';
import { redirect, setCookie } from '../http/core';
import { DomainError } from '../domain/errors';
import { parseSettings, planFeaturesSchema, type BusinessSettings, type FeatureKey, type PlanFeatures } from '../../shared/schemas';

export type StaffPermission = 'view_customers' | 'manage_rewards' | 'adjust_balances' | 'view_reports';
export const STAFF_PERMISSIONS: { key: StaffPermission; label: string; help: string }[] = [
  { key: 'view_customers', label: 'View customer list', help: 'See names, contact details and history in the dashboard.' },
  { key: 'view_reports', label: 'View reports', help: 'Open analytics and the full transaction log.' },
  { key: 'manage_rewards', label: 'Manage rewards and offers', help: 'Create and edit rewards, campaigns and challenges.' },
  { key: 'adjust_balances', label: 'Correct balances', help: 'Reverse transactions and make audited manual adjustments.' },
];

export interface BusinessContext {
  id: string;
  name: string;
  slug: string;
  status: 'onboarding' | 'active' | 'suspended';
  onboardingStep: number;
  timezone: string;
  currency: 'EUR' | 'TRY';
  primaryColour: string;
  secondaryColour: string;
  logoUploadId: string | null;
  isDemo: boolean;
  settings: BusinessSettings;
  role: 'owner' | 'staff';
  permissions: Partial<Record<StaffPermission, boolean>>;
  plan: { id: string; name: string; features: PlanFeatures; status: string; paymentStatus: string };
  memberships: { id: string; name: string; role: string }[];
}

export function requireUser(ctx: Ctx): Reply | null {
  if (ctx.user) return null;
  return redirect(ctx, `/sign-in?next=${encodeURIComponent(ctx.path + ctx.url.search)}`);
}

export function requireAdmin(ctx: Ctx): Reply | null {
  const r = requireUser(ctx);
  if (r) return r;
  if (ctx.user!.platformRole !== 'admin') throw new DomainError('forbidden', 'This area is for Perkora administrators.', 403);
  return null;
}

export async function planFor(businessId: string): Promise<BusinessContext['plan']> {
  const r = await maybeOne<any>(
    db,
    `select p.id, p.name, p.feature_configuration, s.status, s.payment_status
       from subscriptions s join plans p on p.id = s.plan_id where s.business_id = $1`,
    [businessId],
  );
  if (!r) return { id: 'none', name: 'No plan', features: planFeaturesSchema.parse({}), status: 'none', paymentStatus: 'not_configured' };
  return { id: r.id, name: r.name, features: planFeaturesSchema.parse(r.feature_configuration ?? {}), status: r.status, paymentStatus: r.payment_status };
}

/**
 * Resolve the café the signed-in user is working in. The selected café id is a
 * cookie, but it is always re-checked against business_members on the server.
 */
export async function loadBusinessContext(ctx: Ctx): Promise<BusinessContext | null> {
  if (!ctx.user) return null;
  if (ctx.state.biz !== undefined) return ctx.state.biz;
  const rows = await many<any>(
    db,
    `select b.*, bm.role, bm.permissions
       from business_members bm join businesses b on b.id = bm.business_id
      where bm.user_id = $1 and bm.status = 'active'
      order by bm.created_at`,
    [ctx.user.id],
  );
  if (!rows.length) {
    ctx.state.biz = null;
    return null;
  }
  const wanted = ctx.cookies.pk_biz;
  const b = rows.find((r) => r.id === wanted) ?? rows[0];
  const biz: BusinessContext = {
    id: b.id,
    name: b.name,
    slug: b.slug,
    status: b.status,
    onboardingStep: b.onboarding_step,
    timezone: b.timezone,
    currency: b.default_currency,
    primaryColour: b.primary_colour,
    secondaryColour: b.secondary_colour,
    logoUploadId: b.logo_upload_id,
    isDemo: b.is_demo,
    settings: parseSettings(b.settings),
    role: b.role,
    permissions: b.role === 'owner' ? {} : (b.permissions ?? {}),
    plan: await planFor(b.id),
    memberships: rows.map((r) => ({ id: r.id, name: r.name, role: r.role })),
  };
  ctx.state.biz = biz;
  return biz;
}

export function selectBusiness(ctx: Ctx, businessId: string) {
  setCookie(ctx, 'pk_biz', businessId, { maxAge: 365 * 86400 });
}

export function can(biz: BusinessContext, perm: StaffPermission | 'owner'): boolean {
  if (biz.role === 'owner') return true;
  if (perm === 'owner') return false;
  return Boolean(biz.permissions[perm]);
}

export function assertCan(biz: BusinessContext, perm: StaffPermission | 'owner') {
  if (!can(biz, perm)) {
    throw new DomainError('forbidden', perm === 'owner' ? 'Only the café owner can do this.' : 'Your account does not have permission to do this.', 403);
  }
}

export function hasFeature(biz: BusinessContext, f: FeatureKey): boolean {
  return Boolean(biz.plan.features.features[f]);
}

export function assertFeature(biz: BusinessContext, f: FeatureKey, label: string) {
  if (!hasFeature(biz, f)) {
    throw new DomainError('plan_feature', `${label} is not included in the ${biz.plan.name} plan. Change plan under Subscription.`, 403);
  }
}

/**
 * Guard for the café dashboard. `mode` controls what a café in each state can reach:
 *  - 'dashboard': active (or suspended, read-only notice) cafés
 *  - 'onboarding': cafés still being set up
 */
export async function requireBusiness(ctx: Ctx, opts: { owner?: boolean; perm?: StaffPermission; allowOnboarding?: boolean } = {}): Promise<Reply | BusinessContext> {
  const r = requireUser(ctx);
  if (r) return r;
  const biz = await loadBusinessContext(ctx);
  if (!biz) return redirect(ctx, '/get-started');
  if (biz.status === 'onboarding' && !opts.allowOnboarding) {
    if (biz.role === 'owner') return redirect(ctx, '/onboarding');
    throw new DomainError('business_inactive', 'This café is still being set up by its owner.', 403);
  }
  if (opts.owner) assertCan(biz, 'owner');
  if (opts.perm) assertCan(biz, opts.perm);
  return biz;
}

export function isReply(v: unknown): v is Reply {
  return Boolean(v && typeof v === 'object' && 'status' in (v as object) && 'body' in (v as object) && 'headers' in (v as object));
}
