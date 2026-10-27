/** Environment configuration, validated once at startup. */
import fs from 'node:fs';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_CA_CERT: z.string().optional(),
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  DEMO_PASSWORD: z.string().min(8).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof schema>;

let cached: Config | null = null;

export function loadEnvFile(path = '.env') {
  // Minimal .env loader (KEY=value lines). Real environment variables win.
  try {
    if (!fs.existsSync(path)) return;
    for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || line.trim().startsWith('#')) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch {
    /* ignore */
  }
}

export function config(): Config {
  if (cached) return cached;
  const env: Record<string, string | undefined> = { ...process.env };
  // On Render, fall back to the service's own public URL and trust its proxy.
  if (!env.APP_URL && env.RENDER_EXTERNAL_URL) env.APP_URL = env.RENDER_EXTERNAL_URL;
  if (env.TRUST_PROXY === undefined && env.RENDER === 'true') env.TRUST_PROXY = 'true';
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${msg}\nSee .env.example for the required variables.`);
  }
  cached = parsed.data;
  if (cached.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(cached.APP_URL)) {
    console.warn(`[config] APP_URL is ${cached.APP_URL}. QR codes and links will not open on other devices; set APP_URL to the public address.`);
  }
  return cached;
}

export const isProd = () => config().NODE_ENV === 'production';
