import type { Router } from '../http/router';
import type { Ctx } from '../http/core';
import { field, formObject, readBody, redirect, safeNext } from '../http/core';
import { render } from '../http/render';
import { db, maybeOne, tx } from '../db';
import { config } from '../config';
import { authenticate, createUser, signUpSchema } from '../domain/accounts';
import { createSession, destroySession } from '../auth/session';
import { rateLimit } from '../auth/ratelimit';
import { DomainError } from '../domain/errors';
import { SignInPage, SignUpPage, type DemoAccounts } from '../../ui/pages/auth/AuthPages';
import { zodErrors } from './marketing';
import { loadBusinessContext } from '../auth/guards';

export function demoAccounts(): DemoAccounts | null {
  const cfg = config();
  if (!cfg.DEMO_MODE) return null;
  return {
    password: cfg.DEMO_PASSWORD ?? 'perkora-demo-2026',
    owner: 'owner@demo.perkora.app',
    staff: 'staff@demo.perkora.app',
    customer: 'maya.collins@example.com',
  };
}

/** Where a signed-in user lands. */
export async function homeFor(ctx: Ctx): Promise<string> {
  if (!ctx.user) return '/sign-in';
  if (ctx.user.platformRole === 'admin') return '/admin';
  const biz = await loadBusinessContext(ctx);
  if (biz) {
    if (biz.status === 'onboarding') return biz.role === 'owner' ? '/onboarding' : '/wallet';
    return biz.role === 'owner' ? '/dashboard' : '/terminal';
  }
  return '/wallet';
}

export function authRoutes(r: Router) {
  r.get('/home', async (ctx) => redirect(ctx, await homeFor(ctx), undefined, 302));

  r.get('/sign-in', async (ctx) => {
    if (ctx.user) return redirect(ctx, safeNext(ctx.query.get('next'), await homeFor(ctx)), undefined, 302);
    return render(ctx, <SignInPage next={safeNext(ctx.query.get('next'), '')} demo={demoAccounts()} />, { title: ctx.t.common.signIn, noindex: true });
  });

  r.post('/sign-in', async (ctx) => {
    const body = await readBody(ctx);
    const email = field(body, 'email').trim().toLowerCase().slice(0, 254);
    const password = field(body, 'password').slice(0, 200);
    const next = safeNext(field(body, 'next'), '');
    try {
      await rateLimit(`signin:ip:${ctx.ip}`, 30, 600);
      await rateLimit(`signin:email:${email}`, 8, 600);
    } catch (e) {
      if (e instanceof DomainError) {
        return render(ctx, <SignInPage next={next} email={email} error={ctx.t.errors.tooMany} demo={demoAccounts()} />, { title: ctx.t.common.signIn, status: 429 });
      }
      throw e;
    }
    const user = email && password ? await authenticate(email, password) : null;
    if (!user) {
      return render(ctx, <SignInPage next={next} email={email} error={ctx.t.auth.invalid} demo={demoAccounts()} />, { title: ctx.t.common.signIn, status: 401 });
    }
    await createSession(ctx, user.id);
    const u = await maybeOne<any>(db, 'select id, name, email, platform_role, locale, is_demo from users where id = $1', [user.id]);
    ctx.user = { id: u.id, name: u.name, email: u.email, platformRole: u.platform_role, locale: u.locale, isDemo: u.is_demo };
    ctx.state = {};
    return redirect(ctx, next || (await homeFor(ctx)));
  });

  r.post('/sign-out', async (ctx) => {
    await destroySession(ctx);
    return redirect(ctx, '/');
  });

  const signUpGet = (business: boolean) => async (ctx: Ctx) => {
    if (ctx.user) {
      if (business) return redirect(ctx, (await loadBusinessContext(ctx)) ? '/dashboard' : '/onboarding', undefined, 302);
      return redirect(ctx, safeNext(ctx.query.get('next'), '/wallet'), undefined, 302);
    }
    return render(ctx, <SignUpPage business={business} next={safeNext(ctx.query.get('next'), '')} plan={ctx.query.get('plan') ?? undefined} />, {
      title: business ? ctx.t.auth.businessSignUpTitle : ctx.t.common.signUp,
    });
  };

  const signUpPost = (business: boolean) => async (ctx: Ctx) => {
    const body = await readBody(ctx);
    const values = formObject(body);
    const next = safeNext(field(body, 'next'), '');
    const plan = field(body, 'plan');
    const parsed = signUpSchema.safeParse(values);
    const page = (errors: Record<string, string>, status: number) =>
      render(ctx, <SignUpPage business={business} next={next} plan={plan || undefined} values={values} errors={errors} />, { title: ctx.t.common.signUp, status });
    if (!parsed.success) return page(zodErrors(parsed.error), 422);
    try {
      await rateLimit(`signup:${ctx.ip}`, 10, 3600);
    } catch (e) {
      if (e instanceof DomainError) return page({ form: ctx.t.errors.tooMany }, 429);
      throw e;
    }
    let userId: string;
    try {
      userId = (await tx((q) => createUser(q, { ...parsed.data, locale: ctx.locale }))).id;
    } catch (e) {
      if (e instanceof DomainError && e.code === 'conflict') return page({ email: ctx.t.auth.emailTaken }, 409);
      throw e;
    }
    await createSession(ctx, userId);
    if (business) return redirect(ctx, plan ? `/onboarding?plan=${encodeURIComponent(plan)}` : '/onboarding');
    return redirect(ctx, next || '/wallet');
  };

  r.get('/sign-up', signUpGet(false));
  r.post('/sign-up', signUpPost(false));
  r.get('/get-started', signUpGet(true));
  r.post('/get-started', signUpPost(true));
}
