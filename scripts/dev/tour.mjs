// Development helper: sign in (optionally) and screenshot pages.
// Usage: node scripts/dev/tour.mjs <outdir> <email|-> <width> <height> <path>...
import { chromium } from 'playwright';

const [, , outdir, email, w, h, ...paths] = process.argv;
const base = process.env.BASE ?? 'http://localhost:3000';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, locale: process.env.LOCALE ?? 'en-GB' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${page.url()} ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${page.url()} ${e}`));
if (email !== '-') {
  await page.goto(base + '/sign-in');
  await page.fill('main input[name=email]', email);
  await page.fill('main input[name=password]', process.env.PW ?? 'perkora-demo-2026');
  await page.locator('main form[action="/sign-in"]').first().locator('button[type=submit]').click();
  await page.waitForLoadState('networkidle');
}
for (const p of paths) {
  const res = await page.goto(base + p, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
  await page.screenshot({ path: `${outdir}/${name}-${w}.png`, fullPage: process.env.FULL !== '0' });
  console.log(res?.status(), p, '->', `${name}-${w}.png`);
}
if (errors.length) console.log(errors.join('\n'));
await browser.close();
