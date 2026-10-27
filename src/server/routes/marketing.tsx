import { z } from 'zod';
import type { Router } from '../http/router';
import type { Ctx } from '../http/core';
import { field, formObject, readBody, redirect, safeNext, setCookie, reply } from '../http/core';
import { render } from '../http/render';
import { db } from '../db';
import { loadPlans } from '../domain/plans';
import { rateLimit } from '../auth/ratelimit';
import { isLocale } from '../../shared/i18n';
import { HomePage } from '../../ui/pages/marketing/Home';
import { DemoRequestPage, FeaturesPage, LegalPage, PricingPage } from '../../ui/pages/marketing/Pages';
import { DomainError } from '../domain/errors';

const demoSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  cafe_name: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
});

function zodErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = String(i.path[0] ?? 'form');
    out[k] ??= i.message;
  }
  return out;
}
export { zodErrors };

async function demoPost(ctx: Ctx, kind: 'demo' | 'contact') {
  const body = await readBody(ctx);
  const values = formObject(body);
  if (field(body, 'website')) return redirect(ctx, kind === 'demo' ? '/demo?sent=1' : '/contact?sent=1'); // honeypot
  const parsed = demoSchema.safeParse(values);
  const errors = parsed.success ? {} : zodErrors(parsed.error);
  if (kind === 'demo' && parsed.success && !parsed.data.cafe_name) errors.cafe_name = 'Enter your café’s name.';
  if (kind === 'contact' && parsed.success && !parsed.data.message) errors.message = 'Write a short message.';
  if (Object.keys(errors).length || !parsed.success) {
    return render(ctx, <DemoRequestPage kind={kind} values={values} errors={errors} />, { title: ctx.t.demo.metaTitle, status: 422 });
  }
  try {
    await rateLimit(`demo:${ctx.ip}`, 5, 3600);
  } catch (e) {
    if (e instanceof DomainError) return render(ctx, <DemoRequestPage kind={kind} values={values} errors={{ message: ctx.t.errors.tooMany }} />, { title: ctx.t.demo.metaTitle, status: 429 });
    throw e;
  }
  const d = parsed.data;
  await db.query(`insert into demo_requests (kind, name, email, cafe_name, city, phone, message) values ($1,$2,$3,$4,$5,$6,$7)`, [
    kind,
    d.name,
    d.email,
    d.cafe_name || null,
    d.city || null,
    d.phone || null,
    d.message || null,
  ]);
  return render(ctx, <DemoRequestPage kind={kind} done={d.email} />, { title: ctx.t.demo.metaTitle });
}

export function marketingRoutes(r: Router) {
  r.get('/', async (ctx) => {
    const plans = await loadPlans(db);
    return render(ctx, <HomePage plans={plans} />, { title: ctx.t.home.metaTitle, description: ctx.t.home.metaDescription });
  });
  r.get('/features', (ctx) => render(ctx, <FeaturesPage />, { title: ctx.t.featuresPage.metaTitle, description: ctx.t.home.metaDescription }));
  r.get('/how-it-works', (ctx) => redirect(ctx, '/#how-it-works', undefined, 302));
  r.get('/pricing', async (ctx) => {
    const plans = await loadPlans(db);
    return render(ctx, <PricingPage plans={plans} />, { title: ctx.t.pricing.metaTitle });
  });
  r.get('/demo', (ctx) => render(ctx, <DemoRequestPage kind="demo" />, { title: ctx.t.demo.metaTitle }));
  r.post('/demo', (ctx) => demoPost(ctx, 'demo'));
  r.get('/contact', (ctx) => render(ctx, <DemoRequestPage kind="contact" />, { title: ctx.t.demo.contactTitle }));
  r.post('/contact', (ctx) => demoPost(ctx, 'contact'));
  r.get('/privacy', (ctx) => render(ctx, <LegalPage kind="privacy" />, { title: ctx.t.nav.privacy }));
  r.get('/terms', (ctx) => render(ctx, <LegalPage kind="terms" />, { title: ctx.t.nav.terms }));
  r.post('/locale', async (ctx) => {
    const body = await readBody(ctx);
    const locale = field(body, 'locale');
    if (isLocale(locale)) {
      setCookie(ctx, 'pk_locale', locale, { maxAge: 365 * 86400 });
      if (ctx.user) await db.query('update users set locale = $2 where id = $1', [ctx.user.id, locale]);
    }
    return redirect(ctx, safeNext(field(body, 'next'), '/'));
  });
  r.get('/robots.txt', () => reply(200, 'User-agent: *\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /wallet\nDisallow: /terminal\n', { 'content-type': 'text/plain' }));
  r.get('/healthz', async () => {
    await db.query('select 1');
    return reply(200, 'ok', { 'content-type': 'text/plain', 'cache-control': 'no-store' });
  });
}
