// Development helper: report pages that scroll sideways at phone width, and the widest culprits.
// Usage: node scripts/dev/overflow.mjs <email|-> <path>...
import { chromium } from 'playwright';
const [, , email, ...paths] = process.argv;
const base = process.env.BASE ?? 'http://localhost:3000';
const W = +(process.env.W ?? 390);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: W, height: 844 } })).newPage();
if (email !== '-') {
  await page.goto(base + '/sign-in');
  await page.fill('main input[name=email]', email);
  await page.fill('main input[name=password]', process.env.PW ?? 'perkora-demo-2026');
  await page.locator('main form[action="/sign-in"]').first().locator('button[type=submit]').click();
  await page.waitForLoadState('networkidle');
}
for (const p of paths) {
  await page.goto(base + p, { waitUntil: 'networkidle' });
  const r = await page.evaluate((W) => {
    const sw = document.documentElement.scrollWidth;
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.right > W + 1 && b.width > 0) {
        let clipped = false;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { clipped = true; break; }
        }
        if (!clipped) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(b.right)}`);
      }
    }
    const scrollers = [...document.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowX)).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)} ${e.clientWidth}/${e.scrollWidth}`);
    return { sw, bad: bad.slice(0, 6), scrollers: scrollers.slice(0, 4) };
  }, W);
  console.log(`${r.sw > W ? 'OVERFLOW' : 'ok      '} ${p} (${r.sw})`);
  for (const b of r.bad) console.log('   page:', b);
  for (const s of r.scrollers) console.log('   inner scroll:', s);
}
await browser.close();
