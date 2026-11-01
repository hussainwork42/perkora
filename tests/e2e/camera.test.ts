/**
 * Camera scanning end to end: a customer's live QR code is filmed by a (fake) camera,
 * and the staff terminal reads it with Perkora's own decoder (headless Chromium on Linux
 * has no BarcodeDetector, so this exercises the path iPhones and laptops use).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'perkora-demo-2026';

/** Rebuild the module grid from Perkora's QR SVG (one path of 1-module-high runs). */
function modulesFromSvg(svg: string): boolean[][] {
  const dim = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)![1]);
  const margin = 4;
  const n = dim - margin * 2;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  for (const [, x, y, w] of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) for (let i = 0; i < Number(w); i++) m[Number(y) - margin][Number(x) - margin + i] = true;
  return m;
}

/** A short Y4M video of the code held at an angle in front of the camera. */
function y4m(modules: boolean[][], file: string) {
  const W = 640;
  const H = 480;
  const n = modules.length + 8;
  const frames: Buffer[] = [];
  for (let t = 0; t < 20; t++) {
    const side = 250;
    const ang = 0.35 + Math.sin(t / 5) * 0.05;
    const cx = W / 2 + Math.sin(t / 3) * 10;
    const cy = H / 2;
    const corners = [
      [-1, -1, 0.95],
      [1, -1, 1.04],
      [1, 1, 1],
      [-1, 1, 0.97],
    ].map(([u, v, k]) => {
      const x = (u * side * k) / 2;
      const y = (v * side * k) / 2;
      return [cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)];
    });
    // image -> unit square (inverse of the square-to-quad homography)
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
    const dx3 = x0 - x1 + x2 - x3;
    const dy3 = y0 - y1 + y2 - y3;
    const den = (x1 - x2) * (y3 - y2) - (x3 - x2) * (y1 - y2);
    const g = (dx3 * (y3 - y2) - (x3 - x2) * dy3) / den;
    const h = ((x1 - x2) * dy3 - dx3 * (y1 - y2)) / den;
    const a = [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
    const [A, B, C, D, E, F, G, Hh, I] = a;
    const inv = [E * I - F * Hh, C * Hh - B * I, B * F - C * E, F * G - D * I, A * I - C * G, C * D - A * F, D * Hh - E * G, B * G - A * Hh, A * E - B * D];
    const Y = Buffer.alloc(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const w = inv[6] * x + inv[7] * y + inv[8];
        const u = (inv[0] * x + inv[1] * y + inv[2]) / w;
        const v = (inv[3] * x + inv[4] * y + inv[5]) / w;
        let lum = 90 + (x / W) * 50;
        if (u >= 0 && u < 1 && v >= 0 && v < 1) {
          const mx = Math.floor(u * n) - 4;
          const my = Math.floor(v * n) - 4;
          lum = mx >= 0 && my >= 0 && mx < modules.length && my < modules.length && modules[my][mx] ? 40 : 215;
        }
        Y[y * W + x] = Math.max(0, Math.min(255, lum + ((x * 7 + y * 13 + t * 5) % 9) - 4));
      }
    frames.push(Buffer.from('FRAME\n'), Y, Buffer.alloc((W * H) / 2, 128));
  }
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...frames]));
}

test('the staff terminal reads a customer’s QR code through the camera', async () => {
  const plain = await chromium.launch();
  const customer = await (await plain.newContext()).newPage();
  await customer.goto(`${BASE}/sign-in`);
  await customer.fill('main input[name=email]', 'maya.collins@example.com');
  await customer.fill('main input[name=password]', PASSWORD);
  await customer.locator('main form[action="/sign-in"]').first().locator('button[type=submit]').click();
  await customer.waitForURL(/\/wallet/);
  const qr = await (await customer.request.get(`${BASE}/api/wallet/perkora-demo-cafe/qr`)).json();
  await plain.close();

  const video = path.join(os.tmpdir(), `perkora-cam-${Date.now()}.y4m`);
  y4m(modulesFromSvg(qr.svg), video);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
  try {
    const staff = await (await browser.newContext({ permissions: ['camera'] })).newPage();
    await staff.goto(`${BASE}/sign-in`);
    await staff.fill('main input[name=email]', 'staff@demo.perkora.app');
    await staff.fill('main input[name=password]', PASSWORD);
    await staff.locator('main form[action="/sign-in"]').first().locator('button[type=submit]').click();
    await staff.waitForURL(/\/terminal/);
    await staff.getByRole('button', { name: /Scan customer QR/ }).click();
    await staff.getByText('Maya C.').first().waitFor({ timeout: 15000 });
    assert.ok(await staff.getByRole('button', { name: /Add stamp/ }).first().isVisible());
  } finally {
    await browser.close();
    fs.rmSync(video, { force: true });
  }
});

test('a customer scans a café’s counter QR code inside Perkora and lands on its join page', async () => {
  const { encodeQr } = await import('../../src/shared/qr/qrcode');
  const video = path.join(os.tmpdir(), `perkora-cam-cafe-${Date.now()}.y4m`);
  y4m(encodeQr(`${BASE}/c/perkora-demo-cafe`, 'Q').modules, video);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
  try {
    const page = await (await browser.newContext({ permissions: ['camera'], viewport: { width: 390, height: 844 } })).newPage();
    await page.goto(`${BASE}/cafes`);
    await page.getByRole('button', { name: /Scan a café’s QR code/ }).click();
    await page.waitForURL(/\/c\/perkora-demo-cafe$/, { timeout: 15000 });
    await page.getByRole('heading', { name: /Perkora Demo Café/ }).waitFor();
  } finally {
    await browser.close();
    fs.rmSync(video, { force: true });
  }
});
