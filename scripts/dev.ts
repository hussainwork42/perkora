/**
 * Development loop: builds in development mode, starts the server, and rebuilds +
 * restarts whenever a file under src/, migrations/ or the stylesheet changes.
 * Usage: npm run dev
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'development';
const root = process.cwd();
let server: ChildProcess | null = null;
let timer: NodeJS.Timeout | null = null;

function build(): boolean {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/build.ts'], { stdio: 'inherit', env: process.env });
  return r.status === 0;
}

function start() {
  server = spawn(process.execPath, ['--enable-source-maps', 'dist/server.cjs'], { stdio: 'inherit', env: process.env });
}

async function restart() {
  if (!build()) {
    console.error('[dev] build failed, keeping the previous server running');
    return;
  }
  if (server && server.exitCode === null) {
    const old = server;
    await new Promise<void>((resolve) => {
      old.once('exit', () => resolve());
      old.kill('SIGTERM');
    });
  }
  start();
}

for (const dir of ['src', 'migrations']) {
  fs.watch(path.join(root, dir), { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void restart(), 150);
  });
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server?.kill('SIGTERM');
    process.exit(0);
  });
}

await restart();
console.log('[dev] watching src/ and migrations/ for changes');
