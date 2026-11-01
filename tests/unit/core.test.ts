import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

process.env.APP_SECRET ??= 'unit-test-secret-value-that-is-long-enough-123';
process.env.DATABASE_URL ??= 'postgres://localhost/unused';

const { issueMemberToken, verifyMemberToken, extractToken } = await import('../../src/server/domain/qrtoken');
const { encodeQr, qrSvg } = await import('../../src/shared/qr/qrcode');
const { decodeQrFromImage, decodeQrMatrix } = await import('../../src/shared/qr/qrdecode');
const { parseMoneyToMinor, money, shortName, formatMemberCode } = await import('../../src/shared/format');
const { isoWeekKey, weekRange, monthRange, localParts, addDays } = await import('../../src/shared/time');
const { slugify } = await import('../../src/server/routes/onboarding');
const { csvReply } = await import('../../src/server/routes/dashboard-core');
const { hashPassword, verifyPassword, randomCode } = await import('../../src/server/auth/crypto');
const { parseArray, serializeParam, parseConnectionString } = await import('../../src/server/db/pg/driver');
const { fmt, plural, getMessages } = await import('../../src/shared/i18n');
const { en } = await import('../../src/shared/i18n/en');
const { tr } = await import('../../src/shared/i18n/tr');

describe('member QR tokens', () => {
  const id = '3f2a9c1e-8b7d-4e6f-9a0b-1c2d3e4f5a6b';
  test('round-trip and contain no personal data', () => {
    const { token } = issueMemberToken(id);
    assert.match(token, /^PK1\.[A-Za-z0-9_-]{22}\.[a-z0-9]+\.[A-Za-z0-9_-]{22}$/);
    assert.deepEqual(verifyMemberToken(token), { ok: true, membershipId: id });
  });
  test('expire after five minutes', () => {
    const { token } = issueMemberToken(id, new Date(Date.now() - 6 * 60 * 1000));
    assert.deepEqual(verifyMemberToken(token), { ok: false, reason: 'expired' });
  });
  test('reject tampering', () => {
    const { token } = issueMemberToken(id);
    const parts = token.split('.');
    const other = issueMemberToken('00000000-0000-4000-8000-000000000000').token.split('.');
    assert.equal(verifyMemberToken([parts[0], other[1], parts[2], parts[3]].join('.')).ok, false);
    assert.equal(verifyMemberToken([parts[0], parts[1], (parseInt(parts[2], 36) + 600).toString(36), parts[3]].join('.')).ok, false);
    assert.equal(verifyMemberToken('nonsense').ok, false);
  });
  test('can be extracted from a scanned URL', () => {
    const { token } = issueMemberToken(id);
    assert.equal(extractToken(`https://perkora.example/t/m/${token}`), token);
    assert.equal(extractToken('K7M29QXA'), null);
  });
});

describe('QR encoder', () => {
  test('chooses the smallest version and has the right size', () => {
    const m = encodeQr('https://perkora.app/c/perkora-demo-cafe', 'Q');
    assert.equal(m.size, m.version * 4 + 17);
    assert.ok(m.version <= 4);
  });
  test('produces SVG', () => {
    assert.match(qrSvg('hello'), /^<svg[^>]+viewBox="0 0 29 29"/);
  });
  const py = spawnSync('python3', ['-c', 'import cv2, numpy'], { encoding: 'utf8' });
  test('decodes correctly with an independent reader (OpenCV)', { skip: py.status !== 0 ? 'python3 with OpenCV not available' : false }, () => {
    const samples = ['https://perkora.app/c/perkora-demo-cafe', `https://perkora.app/t/m/${issueMemberToken('3f2a9c1e-8b7d-4e6f-9a0b-1c2d3e4f5a6b', new Date('2026-10-27T10:00:00Z')).token}`, 'Türkçe ğüşıöç €₺'];
    for (const s of samples) {
      for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
        const { modules } = encodeQr(s, ecc);
        const rows = modules.map((r) => r.map((x) => (x ? '1' : '0')).join('')).join('\n');
        const out = spawnSync(
          'python3',
          [
            '-c',
            `import sys, numpy as np, cv2
rows = sys.stdin.read().strip().split('\\n')
m = np.array([[int(c) for c in r] for r in rows], dtype=np.uint8)
base = np.pad((1 - m) * 255, 4, constant_values=255)
# OpenCV's finder-pattern detector is scale-sensitive; a correct code decodes at some scale
for f in (8, 6, 10, 12, 5):
    data, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.resize(base, None, fx=f, fy=f, interpolation=cv2.INTER_NEAREST))
    if data:
        break
sys.stdout.write(data)`,
          ],
          { input: rows, encoding: 'utf8' },
        );
        assert.equal(out.stdout, s, `ECC ${ecc}`);
      }
    }
  });
});

describe('QR reader (camera scanning)', () => {
  // deterministic pseudo-random numbers
  const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  /** Unit square -> quad, as a 3x3 matrix (row-major, column vectors). */
  const sq2quad = (q: number[][]) => {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx3 = x0 - x1 + x2 - x3, dy3 = y0 - y1 + y2 - y3;
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    const a13 = (dx3 * dy2 - dx2 * dy3) / den, a23 = (dx1 * dy3 - dx3 * dy1) / den;
    return [x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0, y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0, a13, a23, 1];
  };
  const adj = (m: number[]) => {
    const [a, b, c, d, e, f, g, h, i] = m;
    return [e * i - f * h, c * h - b * i, b * f - c * e, f * g - d * i, a * i - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d];
  };

  /** Draw a QR code into a W×H "camera frame" with perspective, lighting and noise. */
  function frame(text: string, opts: { seed: number; ecc?: 'L' | 'M' | 'Q' | 'H'; size?: number; tilt?: number; noise?: number }) {
    const r = rng(opts.seed);
    const W = 480, H = 360;
    const { modules } = encodeQr(text, opts.ecc ?? 'M');
    const n = modules.length + 8; // with quiet zone
    const side = opts.size ?? 230;
    const ang = r() * Math.PI * 2;
    const cx = W / 2 + (r() - 0.5) * 60, cy = H / 2 + (r() - 0.5) * 40;
    const tilt = opts.tilt ?? 0.08;
    const quad = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => {
      const x = (u * side) / 2 + (r() - 0.5) * tilt * side, y = (v * side) / 2 + (r() - 0.5) * tilt * side;
      return [cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)];
    });
    const inv = adj(sq2quad(quad)); // image -> unit square
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const w = inv[6] * x + inv[7] * y + inv[8];
        const u = (inv[0] * x + inv[1] * y + inv[2]) / w, v = (inv[3] * x + inv[4] * y + inv[5]) / w;
        let lum = 95 + 40 * (x / W); // background
        if (u >= 0 && u < 1 && v >= 0 && v < 1) {
          const mx = Math.floor(u * n) - 4, my = Math.floor(v * n) - 4;
          const dark = mx >= 0 && my >= 0 && mx < modules.length && my < modules.length && modules[my][mx];
          lum = dark ? 35 : 225;
        }
        lum = lum * (0.8 + 0.3 * (y / H)) + (r() - 0.5) * 2 * (opts.noise ?? 12);
        const i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = lum;
        data[i + 3] = 255;
      }
    return { data, width: W, height: H };
  }

  test('reads perfect and damaged module grids (error correction)', () => {
    for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
      const text = 'https://perkora.example/t/m/PK1.abcdefghijklmnopqrstuv.k3j4h5.ABCDEFGHIJKLMNOPQRSTUV';
      const m = encodeQr(text, ecc).modules.map((row) => row.slice());
      assert.equal(decodeQrMatrix(m), text);
      m[12][20] = !m[12][20];
      m[25][14] = !m[25][14];
      assert.equal(decodeQrMatrix(m), text, `with damage, ECC ${ecc}`);
    }
  });

  test('reads codes from camera-like frames: rotated, tilted, uneven light, noise', () => {
    const texts = [
      'https://perkora.example/c/kahve-kosesi-girne',
      `https://perkora.example/t/m/${issueMemberToken('3f2a9c1e-8b7d-4e6f-9a0b-1c2d3e4f5a6b', new Date('2026-10-27T10:00:00Z')).token}`,
      'K7M29QXA',
      'Türkçe ğüşıöç €₺',
    ];
    let seed = 7;
    for (const t of texts)
      for (let k = 0; k < 4; k++) {
        const img = frame(t, { seed: seed++, size: 200 + k * 25 });
        assert.equal(decodeQrFromImage(img), t, `seed ${seed - 1}`);
      }
  });

  test('never invents a result from a frame without a code', () => {
    const r = rng(3);
    const data = new Uint8ClampedArray(320 * 240 * 4).map((_, i) => (i % 4 === 3 ? 255 : 100 + r() * 60));
    assert.equal(decodeQrFromImage({ data, width: 320, height: 240 }), null);
  });
});

describe('money and formatting', () => {
  test('parses typed amounts into integer minor units', () => {
    assert.equal(parseMoneyToMinor('4.50'), 450);
    assert.equal(parseMoneyToMinor('4,5'), 450);
    assert.equal(parseMoneyToMinor('€12'), 1200);
    assert.equal(parseMoneyToMinor('0.1'), 10);
    assert.equal(parseMoneyToMinor('1.005'), null);
    assert.equal(parseMoneyToMinor('-3'), null);
    assert.equal(parseMoneyToMinor('abc'), null);
  });
  test('formats EUR and TRY without converting', () => {
    assert.equal(money(450, 'EUR', 'en'), '€4.50');
    assert.match(money(12550, 'TRY', 'tr'), /125,50/);
  });
  test('shows staff only a first name and initial', () => {
    assert.equal(shortName('Deniz Arslan'), 'Deniz A.');
    assert.equal(shortName('Maya'), 'Maya');
    assert.equal(formatMemberCode('K7M29QXA'), 'K7M2 9QXA');
  });
});

describe('calendar helpers', () => {
  test('ISO weeks and ranges', () => {
    assert.equal(isoWeekKey('2026-10-27'), '2026-W44');
    assert.equal(isoWeekKey('2027-01-01'), '2026-W53');
    assert.deepEqual(weekRange('2026-10-27'), ['2026-10-26', '2026-11-01']);
    assert.deepEqual(monthRange('2026-02-10'), ['2026-02-01', '2026-02-28']);
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });
  test('local time follows the café timezone, including DST changes', () => {
    // Northern Cyprus: UTC+3 in summer, UTC+2 in winter (clocks went back 25 Oct 2026)
    assert.equal(localParts(new Date('2026-07-01T21:30:00Z'), 'Asia/Famagusta').date, '2026-07-02');
    assert.equal(localParts(new Date('2026-11-01T21:30:00Z'), 'Asia/Famagusta').date, '2026-11-01');
    assert.equal(localParts(new Date('2026-10-26T12:00:00Z'), 'Asia/Famagusta').weekday, 1);
  });
});

describe('security helpers', () => {
  test('passwords are salted scrypt hashes', async () => {
    const h1 = await hashPassword('correct horse battery');
    const h2 = await hashPassword('correct horse battery');
    assert.notEqual(h1, h2);
    assert.equal(await verifyPassword('correct horse battery', h1), true);
    assert.equal(await verifyPassword('wrong', h1), false);
  });
  test('member codes use an unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) assert.match(randomCode(8), /^[A-HJKMNP-Z2-9]{8}$/);
  });
  test('CSV export neutralises spreadsheet formulas', () => {
    const r = csvReply('x.csv', ['name'], [['=HYPERLINK("http://evil")'], ['Ayşe, "Ali"']]);
    const body = String(r.body);
    assert.ok(body.includes(`"'=HYPERLINK(""http://evil"")"`));
    assert.ok(body.includes('"Ayşe, ""Ali"""'));
  });
  test('slugs handle Turkish characters', () => {
    assert.equal(slugify('Kahve Köşesi Girne'), 'kahve-kosesi-girne');
    assert.equal(slugify('Çınar Ağacı'), 'cinar-agaci');
  });
});

describe('database driver serialisation', () => {
  test('arrays, JSON and dates are serialised safely', () => {
    assert.equal(serializeParam(['a', 'b"c', null]), '{"a","b\\"c",NULL}');
    assert.equal(serializeParam({ a: 1 }), '{"a":1}');
    assert.equal(serializeParam(new Date('2026-01-01T00:00:00Z')), '2026-01-01T00:00:00.000Z');
    assert.deepEqual(parseArray('{a,"b c",NULL,"d\\"e"}', (x) => x), ['a', 'b c', null, 'd"e']);
  });
  test('connection strings are parsed with sslmode', () => {
    const c = parseConnectionString('postgresql://u:p%40ss@db.example.com:6543/app?sslmode=require');
    assert.deepEqual([c.host, c.port, c.user, c.password, c.database, c.sslmode], ['db.example.com', 6543, 'u', 'p@ss', 'app', 'require']);
  });
});

describe('localisation', () => {
  test('Turkish and English dictionaries have the same keys', () => {
    const keys = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    assert.deepEqual(keys(tr).sort(), keys(en).sort());
  });
  test('interpolation and plurals', () => {
    assert.equal(fmt('{have} of {need}', { have: 7, need: 9 }), '7 of 9');
    assert.equal(plural('{n} stamp|{n} stamps', 1), '1 stamp');
    assert.equal(plural('{n} stamp|{n} stamps', 2), '2 stamps');
    assert.match(getMessages('tr').wallet.title, /kartlarım/);
  });
});
