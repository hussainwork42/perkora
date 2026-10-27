/**
 * Production build:
 *   dist/server.cjs   – the bundled HTTP server (React, Zod etc. included)
 *   dist/cli.cjs      – migrations, seed, demo reset, admin creation
 *   public/assets/    – hashed client JS chunks and CSS
 *   dist/manifest.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import { compile } from 'tailwindcss';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const prod = process.env.NODE_ENV !== 'development';

async function buildCss(): Promise<string> {
  const input = fs.readFileSync(path.join(root, 'src/styles/app.css'), 'utf8');
  const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
  const compiler = await compile(input, {
    base: path.join(root, 'src/styles'),
    loadStylesheet: async (id: string, base: string) => {
      const file =
        id === 'tailwindcss'
          ? path.join(twDir, 'index.css')
          : id.startsWith('tailwindcss/')
            ? path.join(twDir, id.slice('tailwindcss/'.length) + (id.endsWith('.css') ? '' : '.css'))
            : path.resolve(base, id);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  // candidate scan: every token in source files that could be a class name
  const candidates = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(e.name)) {
        for (const tok of fs.readFileSync(p, 'utf8').split(/[\s"'`{}()<>,;\\]+/)) if (tok && tok.length < 120) candidates.add(tok);
      }
    }
  };
  walk(path.join(root, 'src'));
  let css = compiler.build([...candidates]);
  if (prod) {
    const min = await esbuild.transform(css, { loader: 'css', minify: true });
    css = min.code;
  }
  return css;
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const assets = path.join(root, 'public/assets');
  fs.rmSync(assets, { recursive: true, force: true });
  fs.mkdirSync(assets, { recursive: true });

  const define = { 'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development') };

  const client = await esbuild.build({
    absWorkingDir: root,
    entryPoints: { client: 'src/client/entry.tsx' },
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020', 'safari15'],
    outdir: assets,
    entryNames: '[name]-[hash]',
    chunkNames: 'c/[name]-[hash]',
    minify: prod,
    sourcemap: false,
    jsx: 'automatic',
    metafile: true,
    define,
    legalComments: 'none',
    logLevel: 'warning',
  });
  const entry = Object.entries(client.metafile.outputs).find(([, o]) => o.entryPoint === 'src/client/entry.tsx');
  if (!entry) throw new Error('client entry missing');
  const jsUrl = '/assets/' + path.relative(assets, path.join(root, entry[0])).split(path.sep).join('/');

  const css = await buildCss();
  const cssHash = crypto.createHash('sha256').update(css).digest('hex').slice(0, 10);
  fs.writeFileSync(path.join(assets, `app-${cssHash}.css`), css);

  fs.writeFileSync(path.join(root, 'dist/manifest.json'), JSON.stringify({ js: jsUrl, css: `/assets/app-${cssHash}.css` }, null, 2));

  const common: esbuild.BuildOptions = {
    absWorkingDir: root,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    jsx: 'automatic',
    sourcemap: 'linked',
    define,
    logLevel: 'warning',
    legalComments: 'none',
  };
  await esbuild.build({ ...common, entryPoints: ['src/server/index.ts'], outfile: 'dist/server.cjs' });
  await esbuild.build({ ...common, entryPoints: ['src/server/cli.ts'], outfile: 'dist/cli.cjs' });

  // pre-compress static assets
  const { gzipSync } = await import('node:zlib');
  const walkGz = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkGz(p);
      else if (/\.(js|css)$/.test(e.name)) fs.writeFileSync(p + '.gz', gzipSync(fs.readFileSync(p), { level: 9 }));
    }
  };
  walkGz(assets);

  const kb = (f: string) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
  console.log(`built in ${Date.now() - t0}ms — client ${kb(path.join(root, entry[0]))}, css ${(css.length / 1024).toFixed(0)} KB, server ${kb(path.join(root, 'dist/server.cjs'))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
