/**
 * QR code reader for camera frames (no browser APIs needed, so it works on iPhone Safari,
 * Firefox and desktop browsers that lack BarcodeDetector).
 *
 * Pipeline, following the approach of ZXing (Apache-2.0) and jsQR:
 *   1. luminance + local (block) thresholding,
 *   2. finder-pattern search with 1:1:3:1:1 run ratios and cross-checks,
 *   3. pick the three patterns forming the best right-angled triangle,
 *   4. estimate size, look for the bottom-right alignment pattern, build a perspective transform,
 *   5. sample the module grid, read format/version info, unmask, de-interleave,
 *   6. Reed–Solomon error correction, then decode numeric/alphanumeric/byte segments.
 */

export interface ImageLike {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/* ------------------------------------------------------------------ */
/* 1. Binarisation                                                     */
/* ------------------------------------------------------------------ */

class BitImage {
  readonly bits: Uint8Array;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.bits = new Uint8Array(width * height);
  }
  get(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.bits[y * this.width + x] === 1;
  }
}

function luminance(img: ImageLike): Uint8Array {
  const { data, width, height } = img;
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  return out;
}

const BLOCK = 8;
const MIN_DYNAMIC_RANGE = 24;

function binarize(lum: Uint8Array, width: number, height: number, invert = false): BitImage {
  const bw = Math.ceil(width / BLOCK);
  const bh = Math.ceil(height / BLOCK);
  const black = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let min = 255;
      let max = 0;
      let sum = 0;
      let n = 0;
      for (let y = by * BLOCK; y < Math.min(height, (by + 1) * BLOCK); y++) {
        for (let x = bx * BLOCK; x < Math.min(width, (bx + 1) * BLOCK); x++) {
          const v = lum[y * width + x];
          sum += v;
          n++;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      let avg = sum / Math.max(1, n);
      if (max - min <= MIN_DYNAMIC_RANGE) {
        // flat block: treat as light unless the neighbourhood says otherwise
        avg = min / 2;
        if (bx > 0 && by > 0) {
          const nb = (black[(by - 1) * bw + bx] + 2 * black[by * bw + bx - 1] + black[(by - 1) * bw + bx - 1]) / 4;
          if (min < nb) avg = nb;
        }
      }
      black[by * bw + bx] = avg;
    }
  }
  const out = new BitImage(width, height);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const cx = Math.min(Math.max(bx, 2), bw - 3);
      const cy = Math.min(Math.max(by, 2), bh - 3);
      let sum = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = cx + dx;
          const yy = cy + dy;
          if (xx >= 0 && yy >= 0 && xx < bw && yy < bh) {
            sum += black[yy * bw + xx];
            n++;
          }
        }
      const threshold = sum / n;
      for (let y = by * BLOCK; y < Math.min(height, (by + 1) * BLOCK); y++) {
        for (let x = bx * BLOCK; x < Math.min(width, (bx + 1) * BLOCK); x++) {
          const dark = lum[y * width + x] <= threshold;
          out.bits[y * width + x] = dark !== invert ? 1 : 0;
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 2–3. Finder patterns                                                */
/* ------------------------------------------------------------------ */

interface Point {
  x: number;
  y: number;
}
interface Finder extends Point {
  size: number; // estimated module size
  count: number;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function ratioOk(s: number[]): boolean {
  const total = s[0] + s[1] + s[2] + s[3] + s[4];
  if (total < 7 || s.some((v) => v === 0)) return false;
  const m = total / 7;
  const v = m / 1.5;
  return Math.abs(m - s[0]) < v && Math.abs(m - s[1]) < v && Math.abs(3 * m - s[2]) < 3 * v && Math.abs(m - s[3]) < v && Math.abs(m - s[4]) < v;
}

function centerFromEnd(s: number[], end: number): number {
  return end - s[4] - s[3] - s[2] / 2;
}

/** Walk out from (cx, cy) along (dx, dy) and return the five run lengths of a finder pattern. */
function runsAlong(img: BitImage, cx: number, cy: number, dx: number, dy: number, maxCount: number): number[] | null {
  const s = [0, 0, 0, 0, 0];
  const x = Math.floor(cx);
  const y = Math.floor(cy);
  if (!img.get(x, y)) return null;
  // centre run, backwards
  let i = 0;
  while (img.get(x - dx * i, y - dy * i)) {
    s[2]++;
    i++;
    if (i > maxCount * 3) return null;
  }
  let j = i;
  while (j < maxCount * 7 && !img.get(x - dx * j, y - dy * j) && inside(img, x - dx * j, y - dy * j)) {
    s[1]++;
    j++;
  }
  if (!s[1]) return null;
  let k = j;
  while (k < maxCount * 7 && img.get(x - dx * k, y - dy * k)) {
    s[0]++;
    k++;
  }
  if (!s[0]) return null;
  // forwards
  i = 1;
  while (img.get(x + dx * i, y + dy * i)) {
    s[2]++;
    i++;
    if (i > maxCount * 3) return null;
  }
  j = i;
  while (j < maxCount * 7 && !img.get(x + dx * j, y + dy * j) && inside(img, x + dx * j, y + dy * j)) {
    s[3]++;
    j++;
  }
  if (!s[3]) return null;
  k = j;
  while (k < maxCount * 7 && img.get(x + dx * k, y + dy * k)) {
    s[4]++;
    k++;
  }
  if (!s[4]) return null;
  return s;
}

function inside(img: BitImage, x: number, y: number) {
  return x >= 0 && y >= 0 && x < img.width && y < img.height;
}

/** Re-centre along one axis: returns the refined coordinate, or null. */
function crossCheck(img: BitImage, cx: number, cy: number, vertical: boolean, moduleGuess: number): { c: number; size: number } | null {
  const maxCount = Math.ceil(moduleGuess * 2) + 2;
  const dx = vertical ? 0 : 1;
  const dy = vertical ? 1 : 0;
  const s = runsAlong(img, cx, cy, dx, dy, maxCount);
  if (!s || !ratioOk(s)) return null;
  // compute the centre of the middle run along the axis
  const origin = vertical ? Math.floor(cy) : Math.floor(cx);
  let back = 0;
  while (img.get(vertical ? Math.floor(cx) : origin - back - 1, vertical ? origin - back - 1 : Math.floor(cy))) back++;
  const start = origin - back;
  const c = start + s[2] / 2;
  const total = s.reduce((a, b) => a + b, 0);
  return { c, size: total / 7 };
}

function findFinders(img: BitImage): Finder[] {
  const found: Finder[] = [];
  const { width, height } = img;
  const step = Math.max(1, Math.floor(height / 600));
  for (let y = 0; y < height; y += step) {
    const s = [0, 0, 0, 0, 0];
    let state = 0;
    for (let x = 0; x <= width; x++) {
      const dark = x < width && img.get(x, y);
      if (dark) {
        if (state & 1) state++; // white -> black
        s[state]++;
      } else {
        if (!(state & 1)) {
          // black -> white
          if (state === 4) {
            if (ratioOk(s)) {
              const cx = centerFromEnd(s, x);
              const moduleGuess = (s[0] + s[1] + s[2] + s[3] + s[4]) / 7;
              const v = crossCheck(img, cx, y, true, moduleGuess);
              if (v) {
                const h = crossCheck(img, cx, v.c, false, v.size);
                if (h) {
                  const v2 = crossCheck(img, h.c, v.c, true, h.size);
                  if (v2) addFinder(found, h.c, v2.c, (h.size + v2.size) / 2);
                }
              }
              // shift the window by two runs
              s[0] = s[2];
              s[1] = s[3];
              s[2] = s[4];
              s[3] = 1;
              s[4] = 0;
              state = 3;
              continue;
            }
            s[0] = s[2];
            s[1] = s[3];
            s[2] = s[4];
            s[3] = 1;
            s[4] = 0;
            state = 3;
            continue;
          }
          state++;
          s[state]++;
        } else s[state]++;
      }
    }
  }
  return found;
}

function addFinder(list: Finder[], x: number, y: number, size: number) {
  for (const f of list) {
    if (Math.abs(f.x - x) <= Math.max(size, f.size) * 1.5 && Math.abs(f.y - y) <= Math.max(size, f.size) * 1.5 && Math.abs(f.size - size) <= Math.max(1, f.size)) {
      const n = f.count + 1;
      f.x = (f.x * f.count + x) / n;
      f.y = (f.y * f.count + y) / n;
      f.size = (f.size * f.count + size) / n;
      f.count = n;
      return;
    }
  }
  list.push({ x, y, size, count: 1 });
}

/** Best triples first: an isosceles right triangle with similar module sizes. */
function candidateTriples(finders: Finder[]): [Finder, Finder, Finder][] {
  let pool = finders.filter((f) => f.count >= 2);
  if (pool.length < 3) pool = finders.slice();
  pool.sort((a, b) => b.count - a.count);
  pool = pool.slice(0, 12);
  const scored: { t: [Finder, Finder, Finder]; score: number }[] = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++) {
        const a = pool[i];
        const b = pool[j];
        const c = pool[k];
        const sizes = [a.size, b.size, c.size];
        const ms = (sizes[0] + sizes[1] + sizes[2]) / 3;
        const sizeVar = Math.max(...sizes.map((s) => Math.abs(s - ms))) / ms;
        if (sizeVar > 0.5) continue;
        const d = [dist(a, b), dist(b, c), dist(a, c)].sort((p, q) => p - q);
        if (d[0] < ms * 7) continue;
        const right = Math.abs(d[2] * d[2] - (d[0] * d[0] + d[1] * d[1])) / (d[2] * d[2]);
        const iso = Math.abs(d[0] - d[1]) / d[1];
        // prefer patterns confirmed on many scan lines
        const score = right + iso + sizeVar + 1 / Math.min(a.count, b.count, c.count);
        if (right < 0.6 && iso < 0.5) scored.push({ t: [a, b, c], score });
      }
  scored.sort((p, q) => p.score - q.score);
  return scored.slice(0, 6).map((s) => s.t);
}

/** Returns [topLeft, topRight, bottomLeft]. */
function orderFinders(t: [Finder, Finder, Finder]): [Finder, Finder, Finder] {
  const [a, b, c] = t;
  const ab = dist(a, b);
  const bc = dist(b, c);
  const ac = dist(a, c);
  let tl: Finder;
  let p: Finder;
  let q: Finder;
  if (bc >= ab && bc >= ac) [tl, p, q] = [a, b, c];
  else if (ac >= ab && ac >= bc) [tl, p, q] = [b, a, c];
  else [tl, p, q] = [c, a, b];
  // in image coordinates (y down) top-right is clockwise from top-left
  const cross = (p.x - tl.x) * (q.y - tl.y) - (p.y - tl.y) * (q.x - tl.x);
  return cross > 0 ? [tl, p, q] : [tl, q, p];
}

/* ------------------------------------------------------------------ */
/* 4. Geometry                                                         */
/* ------------------------------------------------------------------ */

type Mat = number[]; // 3x3, row-major

function squareToQuad(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): Mat {
  const dx3 = x0 - x1 + x2 - x3;
  const dy3 = y0 - y1 + y2 - y3;
  if (dx3 === 0 && dy3 === 0) return [x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0, 1];
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const a13 = (dx3 * dy2 - dx2 * dy3) / den;
  const a23 = (dx1 * dy3 - dx3 * dy1) / den;
  return [x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0, y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0, a13, a23, 1];
}

function adjugate(m: Mat): Mat {
  const [a, b, c, d, e, f, g, h, i] = m;
  return [e * i - f * h, c * h - b * i, b * f - c * e, f * g - d * i, a * i - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d];
}

function mul(m: Mat, n: Mat): Mat {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += m[i * 3 + k] * n[k * 3 + j];
  return r;
}

/** Transform mapping module-grid coordinates to image coordinates. */
function gridToImage(src: Point[], dst: Point[]): (x: number, y: number) => Point {
  // quad(src) -> unit square -> quad(dst); with column vectors p' = M p
  const sToQ = (q: Point[]) => {
    const m = squareToQuad(q[0].x, q[0].y, q[1].x, q[1].y, q[2].x, q[2].y, q[3].x, q[3].y);
    return m;
  };
  const a = sToQ(src); // unit -> src
  const b = sToQ(dst); // unit -> dst
  // squareToQuad returns matrix M where [x y w]^T = M [u v 1]^T ... laid out as rows:
  // x = m0*u + m1*v + m2 ; y = m3*u + m4*v + m5 ; w = m6*u + m7*v + m8
  const M = mul(b, adjugate(a)); // src -> unit -> dst
  return (x: number, y: number) => {
    const w = M[6] * x + M[7] * y + M[8];
    return { x: (M[0] * x + M[1] * y + M[2]) / w, y: (M[3] * x + M[4] * y + M[5]) / w };
  };
}

function findAlignment(img: BitImage, est: Point, moduleSize: number, allowances = [4, 8, 14]): Point | null {
  for (const allowance of allowances) {
    const r = Math.ceil(allowance * moduleSize);
    const x0 = Math.max(0, Math.floor(est.x - r));
    const x1 = Math.min(img.width - 1, Math.ceil(est.x + r));
    const y0 = Math.max(0, Math.floor(est.y - r));
    const y1 = Math.min(img.height - 1, Math.ceil(est.y + r));
    let best: Point | null = null;
    let bestD = Infinity;
    const ok = (a: number) => Math.abs(a - moduleSize) < moduleSize * 0.7;
    for (let y = y0; y <= y1; y++) {
      // runs along the row: look for white-black-white with each ≈ one module, inside dark ring
      let x = x0;
      const runs: { dark: boolean; len: number; end: number }[] = [];
      while (x <= x1) {
        const dark = img.get(x, y);
        let len = 0;
        while (x <= x1 && img.get(x, y) === dark) {
          len++;
          x++;
        }
        runs.push({ dark, len, end: x });
      }
      for (let i = 1; i + 1 < runs.length; i++) {
        const w1 = runs[i - 1];
        const b = runs[i];
        const w2 = runs[i + 1];
        if (!b.dark || w1.dark || w2.dark) continue;
        if (!ok(w1.len) || !ok(b.len) || !ok(w2.len)) continue;
        const cx = b.end - b.len / 2;
        // vertical check: centre black run ≈ module, flanked by white ≈ module
        const v = vRuns(img, Math.floor(cx), y, moduleSize);
        if (!v) continue;
        const c = { x: cx, y: v };
        const d = dist(c, est);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function vRuns(img: BitImage, x: number, y: number, m: number): number | null {
  if (!img.get(x, y)) return null;
  let up = 0;
  while (img.get(x, y - up - 1) && up < m * 2) up++;
  let down = 0;
  while (img.get(x, y + down + 1) && down < m * 2) down++;
  const len = up + down + 1;
  if (Math.abs(len - m) > m * 0.7) return null;
  let wu = 0;
  while (!img.get(x, y - up - 1 - wu) && wu < m * 2) wu++;
  let wd = 0;
  while (!img.get(x, y + down + 1 + wd) && wd < m * 2) wd++;
  if (Math.abs(wu - m) > m * 0.7 || Math.abs(wd - m) > m * 0.7) return null;
  return y - up + len / 2;
}

/* ------------------------------------------------------------------ */
/* 5. Reading the grid                                                 */
/* ------------------------------------------------------------------ */

const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
// format "ecc bits" -> table index (L=1, M=0, Q=3, H=2 in the symbol; tables are ordered L, M, Q, H)
const ECC_FROM_BITS = [1, 0, 3, 2];

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const pos = [6];
  for (let p = size - 7; pos.length < numAlign; p -= step) pos.splice(1, 0, p);
  return pos;
}

function functionMask(version: number): boolean[][] {
  const size = version * 4 + 17;
  const f: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < size && y < size) f[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    mark(6, i);
    mark(i, 6);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy);
  const ap = alignmentPositions(version);
  const na = ap.length;
  for (let i = 0; i < na; i++)
    for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(ap[i] + dx, ap[j] + dy);
    }
  for (let i = 0; i <= 8; i++) {
    mark(8, i);
    mark(i, 8);
  }
  for (let i = 0; i < 8; i++) mark(size - 1 - i, 8);
  for (let i = 0; i < 8; i++) mark(8, size - 1 - i);
  if (version >= 7)
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const c = Math.floor(i / 3);
      mark(a, c);
      mark(c, a);
    }
  return f;
}

const popcount = (n: number) => {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
};

const FORMAT_CODES: { code: number; ecc: number; mask: number }[] = [];
for (let d = 0; d < 32; d++) {
  let rem = d;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  FORMAT_CODES.push({ code: ((d << 10) | rem) ^ 0x5412, ecc: d >> 3, mask: d & 7 });
}
const VERSION_CODES: { code: number; version: number }[] = [];
for (let v = 7; v <= 40; v++) {
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  VERSION_CODES.push({ code: (v << 12) | rem, version: v });
}

function readFormat(m: boolean[][]): { ecc: number; mask: number } | null {
  const size = m.length;
  const bit = (x: number, y: number) => (m[y][x] ? 1 : 0);
  let a = 0;
  let b = 0;
  for (let i = 0; i <= 5; i++) a |= bit(8, i) << i;
  a |= bit(8, 7) << 6;
  a |= bit(8, 8) << 7;
  a |= bit(7, 8) << 8;
  for (let i = 9; i < 15; i++) a |= bit(14 - i, 8) << i;
  for (let i = 0; i < 8; i++) b |= bit(size - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) b |= bit(8, size - 15 + i) << i;
  let best: (typeof FORMAT_CODES)[number] | null = null;
  let bestD = 99;
  for (const fc of FORMAT_CODES) {
    for (const v of [a, b]) {
      const d = popcount(v ^ fc.code);
      if (d < bestD) {
        bestD = d;
        best = fc;
      }
    }
  }
  return best && bestD <= 3 ? { ecc: best.ecc, mask: best.mask } : null;
}

function readVersion(m: boolean[][]): number | null {
  const size = m.length;
  let a = 0;
  let b = 0;
  for (let i = 0; i < 18; i++) {
    const p = size - 11 + (i % 3);
    const c = Math.floor(i / 3);
    if (m[c][p]) a |= 1 << i;
    if (m[p][c]) b |= 1 << i;
  }
  let best: number | null = null;
  let bestD = 99;
  for (const vc of VERSION_CODES)
    for (const v of [a, b]) {
      const d = popcount(v ^ vc.code);
      if (d < bestD) {
        bestD = d;
        best = vc.version;
      }
    }
  return bestD <= 3 ? best : null;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/* ------------------------------------------------------------------ */
/* 6. Reed–Solomon over GF(256), primitive 0x11d, generator base 0     */
/* ------------------------------------------------------------------ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const gmul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
const ginv = (a: number) => {
  if (a === 0) throw new Error('inverse of 0');
  return EXP[255 - LOG[a]];
};

/** Polynomials as coefficient arrays, highest degree first, no leading zeros (except [0]). */
type Poly = number[];
const norm = (p: Poly): Poly => {
  let i = 0;
  while (i < p.length - 1 && p[i] === 0) i++;
  return p.slice(i);
};
const deg = (p: Poly) => p.length - 1;
const isZero = (p: Poly) => p[0] === 0;
const coef = (p: Poly, d: number) => p[p.length - 1 - d];
const add = (a: Poly, b: Poly): Poly => {
  if (isZero(a)) return b;
  if (isZero(b)) return a;
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  const r = l.slice();
  const off = l.length - s.length;
  for (let i = 0; i < s.length; i++) r[off + i] ^= s[i];
  return norm(r);
};
const pmul = (a: Poly, b: Poly): Poly => {
  if (isZero(a) || isZero(b)) return [0];
  const r = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j] ^= gmul(a[i], b[j]);
  return norm(r);
};
const scale = (a: Poly, s: number): Poly => (s === 0 ? [0] : norm(a.map((c) => gmul(c, s))));
const monomial = (d: number, c: number): Poly => (c === 0 ? [0] : [c, ...new Array(d).fill(0)]);
const mulMono = (a: Poly, d: number, c: number): Poly => (c === 0 ? [0] : norm([...a.map((x) => gmul(x, c)), ...new Array(d).fill(0)]));
const evalAt = (p: Poly, x: number): number => {
  if (x === 0) return coef(p, 0);
  let r = p[0];
  for (let i = 1; i < p.length; i++) r = gmul(r, x) ^ p[i];
  return r;
};

function rsCorrect(block: number[], ecLen: number): boolean {
  const syn = new Array(ecLen).fill(0);
  let clean = true;
  for (let i = 0; i < ecLen; i++) {
    const v = evalAt(block, EXP[i]);
    syn[ecLen - 1 - i] = v;
    if (v) clean = false;
  }
  if (clean) return true;
  // Euclidean algorithm
  let rLast: Poly = monomial(ecLen, 1);
  let r: Poly = norm(syn);
  let tLast: Poly = [0];
  let t: Poly = [1];
  while (2 * deg(r) >= ecLen) {
    const rLastLast = rLast;
    const tLastLast = tLast;
    rLast = r;
    tLast = t;
    if (isZero(rLast)) return false;
    r = rLastLast;
    let q: Poly = [0];
    const dlt = ginv(coef(rLast, deg(rLast)));
    while (deg(r) >= deg(rLast) && !isZero(r)) {
      const dd = deg(r) - deg(rLast);
      const sc = gmul(coef(r, deg(r)), dlt);
      q = add(q, monomial(dd, sc));
      r = add(r, mulMono(rLast, dd, sc));
    }
    t = add(pmul(q, tLast), tLastLast);
    if (deg(r) >= deg(rLast)) return false;
  }
  const s0 = coef(t, 0);
  if (s0 === 0) return false;
  const inv = ginv(s0);
  const sigma = scale(t, inv);
  const omega = scale(r, inv);
  // Chien search
  const nErr = deg(sigma);
  const locs: number[] = [];
  if (nErr === 1) locs.push(coef(sigma, 1));
  else
    for (let i = 1; i < 256 && locs.length < nErr; i++) {
      if (evalAt(sigma, i) === 0) locs.push(ginv(i));
    }
  if (locs.length !== nErr) return false;
  // Forney
  for (let i = 0; i < locs.length; i++) {
    const xiInv = ginv(locs[i]);
    let den = 1;
    for (let j = 0; j < locs.length; j++) {
      if (i === j) continue;
      const term = gmul(locs[j], xiInv);
      den = gmul(den, (term & 1) === 0 ? term | 1 : term & ~1);
    }
    const mag = gmul(evalAt(omega, xiInv), ginv(den));
    const pos = block.length - 1 - LOG[locs[i]];
    if (pos < 0) return false;
    block[pos] ^= mag;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Data segments                                                       */
/* ------------------------------------------------------------------ */

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function parseData(bytes: number[], version: number): string | null {
  let pos = 0;
  const total = bytes.length * 8;
  const read = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const bit = (bytes[(pos + i) >> 3] >> (7 - ((pos + i) & 7))) & 1;
      v = (v << 1) | bit;
    }
    pos += n;
    return v;
  };
  const sizeClass = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  const out: number[] = [];
  let text = '';
  const flushBytes = () => {
    if (!out.length) return;
    try {
      text += new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(out));
    } catch {
      text += String.fromCharCode(...out);
    }
    out.length = 0;
  };
  while (pos + 4 <= total) {
    const mode = read(4);
    if (mode === 0) break;
    if (mode === 1) {
      flushBytes();
      let count = read([10, 12, 14][sizeClass]);
      while (count >= 3) {
        const v = read(10);
        text += String(v).padStart(3, '0');
        count -= 3;
      }
      if (count === 2) text += String(read(7)).padStart(2, '0');
      else if (count === 1) text += String(read(4));
    } else if (mode === 2) {
      flushBytes();
      let count = read([9, 11, 13][sizeClass]);
      while (count >= 2) {
        const v = read(11);
        text += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45];
        count -= 2;
      }
      if (count === 1) text += ALNUM[read(6)];
    } else if (mode === 4) {
      const count = read([8, 16, 16][sizeClass]);
      if (pos + count * 8 > total) return null;
      for (let i = 0; i < count; i++) out.push(read(8));
    } else if (mode === 7) {
      // ECI designator: assume UTF-8 / ignore
      const first = read(8);
      if ((first & 0x80) === 0) {
        /* 1 byte */
      } else if ((first & 0xc0) === 0x80) read(8);
      else read(16);
    } else if (mode === 3) {
      read(16); // structured append header
    } else if (mode === 5 || mode === 9) {
      if (mode === 9) read(8);
    } else {
      return null; // kanji or unknown: not used by Perkora
    }
  }
  flushBytes();
  return text;
}

function decodeMatrix(m: boolean[][]): string | null {
  const size = m.length;
  let version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40) return null;
  if (version >= 7) {
    const v = readVersion(m);
    if (v === null || v !== version) return null;
  }
  const fmt = readFormat(m);
  if (!fmt) return null;
  const e = ECC_FROM_BITS[fmt.ecc];
  const func = functionMask(version);
  // read codewords in placement order
  const raw = Math.floor(numRawDataModules(version) / 8);
  const cw: number[] = [];
  let cur = 0;
  let nbits = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (func[y][x]) continue;
        let bit = m[y][x];
        if (maskBit(fmt.mask, x, y)) bit = !bit;
        cur = (cur << 1) | (bit ? 1 : 0);
        nbits++;
        if (nbits === 8) {
          if (cw.length < raw) cw.push(cur);
          cur = 0;
          nbits = 0;
        }
      }
    }
  }
  if (cw.length < raw) return null;
  // de-interleave
  const numBlocks = NUM_BLOCKS[e][version];
  const ecLen = ECC_CODEWORDS_PER_BLOCK[e][version];
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const blocks: number[][] = Array.from({ length: numBlocks }, () => new Array(shortLen + 1).fill(0));
  let k = 0;
  for (let i = 0; i < shortLen + 1; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i === shortLen - ecLen && j < numShort) continue;
      blocks[j][i] = cw[k++];
    }
  }
  const data: number[] = [];
  for (let j = 0; j < numBlocks; j++) {
    const blk = j < numShort ? [...blocks[j].slice(0, shortLen - ecLen), ...blocks[j].slice(shortLen - ecLen + 1)] : blocks[j];
    if (!rsCorrect(blk, ecLen)) return null;
    data.push(...blk.slice(0, blk.length - ecLen));
  }
  return parseData(data, version);
}

function sampleGrid(img: BitImage, map: (x: number, y: number) => Point, dimension: number): boolean[][] | null {
  const m: boolean[][] = [];
  for (let y = 0; y < dimension; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < dimension; x++) {
      const p = map(x + 0.5, y + 0.5);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      const px = Math.floor(p.x);
      const py = Math.floor(p.y);
      if (px < -1 || py < -1 || px > img.width || py > img.height) return null;
      row.push(img.get(px, py));
    }
    m.push(row);
  }
  return m;
}

/** Outer corners of a finder pattern [tl, tr, br, bl] in symbol orientation (u = right, v = down). */
function finderCorners(img: BitImage, f: Finder, u: Point, v: Point): Point[] | null {
  // walk from the centre to the outer dark ring
  const dirs = [
    { x: -u.x - v.x, y: -u.y - v.y },
    { x: u.x, y: u.y },
    { x: v.x, y: v.y },
    { x: -u.x, y: -u.y },
  ];
  const R = f.size * 5.2;
  for (const d0 of dirs) {
    const len = Math.hypot(d0.x, d0.y);
    const d = { x: d0.x / len, y: d0.y / len };
    let t = 0;
    let phase = 0; // 0 = core, 1 = white ring, 2 = found
    let start: [number, number] | null = null;
    while (t < R) {
      const x = Math.floor(f.x + d.x * t);
      const y = Math.floor(f.y + d.y * t);
      const dark = img.get(x, y);
      if (phase === 0 && !dark) phase = 1;
      else if (phase === 1 && dark) {
        start = [x, y];
        break;
      }
      t += 0.5;
    }
    if (!start) continue;
    // flood fill the ring
    const seen = new Set<number>();
    const stack = [start];
    const pts: Point[] = [];
    const r2 = R * R;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      const key = y * img.width + x;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!img.get(x, y)) continue;
      const dx = x + 0.5 - f.x;
      const dy = y + 0.5 - f.y;
      if (dx * dx + dy * dy > r2) continue;
      pts.push({ x: x + 0.5, y: y + 0.5 });
      if (pts.length > 40000) return null;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    // the ring should be roughly 24 modules of area
    const area = pts.length / (f.size * f.size);
    if (area < 12 || area > 40) continue;
    const combos = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const corners = combos.map(([a, b]) => {
      const dir = { x: a * u.x + b * v.x, y: a * u.y + b * v.y };
      let best = pts[0];
      let bestDot = -Infinity;
      for (const p of pts) {
        const dot = (p.x - f.x) * dir.x + (p.y - f.y) * dir.y;
        if (dot > bestDot) {
          bestDot = dot;
          best = p;
        }
      }
      // push half a pixel outwards to reach the pixel's outer corner
      const l = Math.hypot(dir.x, dir.y) || 1;
      return { x: best.x + (dir.x / l) * 0.5, y: best.y + (dir.y / l) * 0.5 };
    });
    return corners;
  }
  return null;
}

function intersect(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-9) return null;
  const a = p1.x * p2.y - p1.y * p2.x;
  const b = p3.x * p4.y - p3.y * p4.x;
  return { x: (a * (p3.x - p4.x) - (p1.x - p2.x) * b) / d, y: (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / d };
}

/** Least-squares homography (grid -> image) from point pairs. */
function fitHomography(pairs: { g: Point; p: Point }[]): ((x: number, y: number) => Point) | null {
  if (pairs.length < 4) return null;
  // normalise image coordinates for numerical stability
  let mx = 0;
  let my = 0;
  for (const { p } of pairs) {
    mx += p.x;
    my += p.y;
  }
  mx /= pairs.length;
  my /= pairs.length;
  let sd = 0;
  for (const { p } of pairs) sd += Math.hypot(p.x - mx, p.y - my);
  sd = sd / pairs.length || 1;
  let gx = 0;
  let gy = 0;
  for (const { g } of pairs) {
    gx += g.x;
    gy += g.y;
  }
  gx /= pairs.length;
  gy /= pairs.length;
  let gs = 0;
  for (const { g } of pairs) gs += Math.hypot(g.x - gx, g.y - gy);
  gs = gs / pairs.length || 1;
  const N = new Array(64).fill(0);
  const B = new Array(8).fill(0);
  const addRow = (row: number[], rhs: number) => {
    for (let i = 0; i < 8; i++) {
      B[i] += row[i] * rhs;
      for (let j = 0; j < 8; j++) N[i * 8 + j] += row[i] * row[j];
    }
  };
  for (const { g, p } of pairs) {
    const x = (g.x - gx) / gs;
    const y = (g.y - gy) / gs;
    const X = (p.x - mx) / sd;
    const Y = (p.y - my) / sd;
    addRow([x, y, 1, 0, 0, 0, -x * X, -y * X], X);
    addRow([0, 0, 0, x, y, 1, -x * Y, -y * Y], Y);
  }
  // Gaussian elimination with partial pivoting
  const M = N.slice();
  const h = B.slice();
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(M[r * 8 + c]) > Math.abs(M[piv * 8 + c])) piv = r;
    if (Math.abs(M[piv * 8 + c]) < 1e-12) return null;
    if (piv !== c) {
      for (let k = 0; k < 8; k++) [M[c * 8 + k], M[piv * 8 + k]] = [M[piv * 8 + k], M[c * 8 + k]];
      [h[c], h[piv]] = [h[piv], h[c]];
    }
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = M[r * 8 + c] / M[c * 8 + c];
      if (!f) continue;
      for (let k = c; k < 8; k++) M[r * 8 + k] -= f * M[c * 8 + k];
      h[r] -= f * h[c];
    }
  }
  for (let c = 0; c < 8; c++) h[c] /= M[c * 8 + c];
  return (x: number, y: number) => {
    const nx = (x - gx) / gs;
    const ny = (y - gy) / gs;
    const w = h[6] * nx + h[7] * ny + 1;
    return { x: ((h[0] * nx + h[1] * ny + h[2]) / w) * sd + mx, y: ((h[3] * nx + h[4] * ny + h[5]) / w) * sd + my };
  };
}

/** Sample and decode using every point we can pin down: finder corners and centres, then alignment patterns. */
function tryFitted(img: BitImage, dimension: number, tl: Finder, tr: Finder, bl: Finder, cTL: Point[], cTR: Point[], cBL: Point[], moduleSize: number): string | null {
  const d = dimension;
  const pairs: { g: Point; p: Point }[] = [];
  const addFinder = (c: Point[], f: Finder, ox: number, oy: number) => {
    const gs = [
      { x: ox, y: oy },
      { x: ox + 7, y: oy },
      { x: ox + 7, y: oy + 7 },
      { x: ox, y: oy + 7 },
    ];
    gs.forEach((g, i) => pairs.push({ g, p: c[i] }));
    pairs.push({ g: { x: ox + 3.5, y: oy + 3.5 }, p: f }, { g: { x: ox + 3.5, y: oy + 3.5 }, p: f });
  };
  addFinder(cTL, tl, 0, 0);
  addFinder(cTR, tr, d - 7, 0);
  addFinder(cBL, bl, 0, d - 7);
  let map = fitHomography(pairs);
  if (!map) return null;
  const attempt = () => {
    const grid = sampleGrid(img, map!, d);
    return grid ? decodeMatrix(grid) : null;
  };
  let text = attempt();
  if (text !== null) return text;
  const version = (d - 17) / 4;
  if (version < 2) return null;
  // add alignment patterns, nearest first, refitting as we go
  const ap = alignmentPositions(version);
  const centres: Point[] = [];
  for (const ax of ap)
    for (const ay of ap) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === ap[ap.length - 1]) || (ax === ap[ap.length - 1] && ay === 6)) continue;
      centres.push({ x: ax + 0.5, y: ay + 0.5 });
    }
  centres.sort((a, b) => b.x + b.y - (a.x + a.y)); // bottom-right first: it constrains perspective most
  let added = 0;
  for (const c of centres) {
    const est = map(c.x, c.y);
    const found = findAlignment(img, est, moduleSize, [2, 4]);
    if (!found) continue;
    pairs.push({ g: c, p: found }, { g: c, p: found }, { g: c, p: found });
    added++;
    const m2 = fitHomography(pairs);
    if (m2) map = m2;
    if (added === 1 || added % 4 === 0) {
      text = attempt();
      if (text !== null) return text;
    }
  }
  return added ? attempt() : null;
}

function tryTriple(img: BitImage, triple: [Finder, Finder, Finder]): string | null {
  const [tl, tr, bl] = orderFinders(triple);
  const moduleSize = (tl.size + tr.size + bl.size) / 3;
  const est = Math.round((dist(tl, tr) / moduleSize + dist(tl, bl) / moduleSize) / 2) + 7;
  const dims = new Set<number>();
  const base = est - ((est - 17) % 4 + 4) % 4; // nearest 4k+1 at or below
  for (const d of [base, base + 4, base - 4, base + 8]) if (d >= 21 && d <= 177) dims.add(d);
  // the closest candidate first
  const ordered = [...dims].sort((a, b) => Math.abs(a - est) - Math.abs(b - est));
  // corner-based geometry handles perspective even without an alignment pattern
  const norm2 = (p: Point) => {
    const l = Math.hypot(p.x, p.y) || 1;
    return { x: p.x / l, y: p.y / l };
  };
  const u = norm2({ x: tr.x - tl.x, y: tr.y - tl.y });
  const v = norm2({ x: bl.x - tl.x, y: bl.y - tl.y });
  const cTL = finderCorners(img, tl, u, v);
  const cTR = finderCorners(img, tr, u, v);
  const cBL = finderCorners(img, bl, u, v);
  const brCorner = cTR && cBL ? intersect(cTR[1], cTR[2], cBL[3], cBL[2]) : null;
  for (const dimension of ordered) {
    if (cTL && cTR && cBL) {
      const text = tryFitted(img, dimension, tl, tr, bl, cTL, cTR, cBL, moduleSize);
      if (text !== null) return text;
    }
    if (cTL && cTR && cBL && brCorner) {
      const src = [
        { x: 0, y: 0 },
        { x: dimension, y: 0 },
        { x: dimension, y: dimension },
        { x: 0, y: dimension },
      ];
      const dst = [cTL[0], cTR[1], brCorner, cBL[3]];
      let map = gridToImage(src, dst);
      let grid = sampleGrid(img, map, dimension);
      if (grid) {
        const text = decodeMatrix(grid);
        if (text !== null) return text;
      }
      if (dimension >= 25) {
        // refine with the alignment pattern predicted by the corner fit
        const est = map(dimension - 6.5, dimension - 6.5);
        const ap = findAlignment(img, est, moduleSize);
        if (ap) {
          map = gridToImage([src[0], src[1], { x: dimension - 6.5, y: dimension - 6.5 }, src[3]], [cTL[0], cTR[1], ap, cBL[3]]);
          grid = sampleGrid(img, map, dimension);
          if (grid) {
            const text = decodeMatrix(grid);
            if (text !== null) return text;
          }
        }
      }
    }
    const corners: Point[] = [
      { x: 3.5, y: 3.5 },
      { x: dimension - 3.5, y: 3.5 },
      { x: 3.5, y: dimension - 3.5 },
    ];
    const brGuess = { x: tr.x - tl.x + bl.x, y: tr.y - tl.y + bl.y };
    const attempts: { src: Point; dst: Point }[] = [];
    if (dimension >= 25) {
      const modulesBetween = dimension - 7;
      const corr = 1 - 3 / modulesBetween;
      const estAlign = { x: tl.x + corr * (brGuess.x - tl.x), y: tl.y + corr * (brGuess.y - tl.y) };
      const ap = findAlignment(img, estAlign, moduleSize);
      if (ap) attempts.push({ src: { x: dimension - 6.5, y: dimension - 6.5 }, dst: ap });
      attempts.push({ src: { x: dimension - 6.5, y: dimension - 6.5 }, dst: estAlign });
    } else {
      attempts.push({ src: { x: dimension - 3.5, y: dimension - 3.5 }, dst: brGuess });
    }
    for (const a of attempts) {
      // gridToImage expects quads in order p0, p1, p2, p3 going around: TL, TR, BR, BL
      const src = [corners[0], corners[1], a.src, corners[2]];
      const dst = [tl, tr, a.dst, bl];
      const map = gridToImage(src, dst);
      const grid = sampleGrid(img, map, dimension);
      if (!grid) continue;
      const text = decodeMatrix(grid);
      if (text !== null) return text;
      // version info may say a different size than estimated
      if (dimension >= 45) {
        const v = readVersion(grid);
        if (v && v * 4 + 17 !== dimension && !dims.has(v * 4 + 17)) {
          dims.add(v * 4 + 17);
          ordered.push(v * 4 + 17);
        }
      }
    }
  }
  return null;
}

/** Decode the most prominent QR code in an RGBA image, or return null. */
export function decodeQrFromImage(img: ImageLike, opts: { tryInverted?: boolean } = {}): string | null {
  const lum = luminance(img);
  for (const invert of opts.tryInverted ? [false, true] : [false]) {
    const bits = binarize(lum, img.width, img.height, invert);
    const finders = findFinders(bits);
    if (finders.length < 3) continue;
    for (const t of candidateTriples(finders)) {
      const text = tryTriple(bits, t);
      if (text !== null) return text;
    }
  }
  return null;
}

/** Decode a perfect module matrix (used by tests). */
export function decodeQrMatrix(modules: boolean[][]): string | null {
  return decodeMatrix(modules);
}

