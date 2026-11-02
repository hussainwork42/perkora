// Dev check: open the mobile menu on a phone-sized screen and screenshot it.
import { chromium } from 'playwright';
const out = process.argv[2] ?? '/tmp/claude-0/shots/menu.png';
const path = process.argv[3] ?? '/';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: process.env.LOCALE ?? 'en-GB' })).newPage();
await p.goto('http://localhost:3000' + path, { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /menu/i }).first().click();
await p.waitForTimeout(400);
await p.screenshot({ path: out });
await b.close();
