import http from 'node:http';
import { config, loadEnvFile } from './config';
import { closePool, db } from './db';
import { purgeExpiredSessions } from './auth/session';
import { expireVouchers } from './domain/loyalty';

loadEnvFile();

async function main() {
  const cfg = config();
  const { createApp } = await import('./app');
  await db.query('select 1');
  const server = http.createServer(createApp());
  server.headersTimeout = 20000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  server.listen(cfg.PORT, cfg.HOST, () => {
    console.log(`Perkora listening on ${cfg.APP_URL} (port ${cfg.PORT}, ${cfg.NODE_ENV})`);
    // first boot with DEMO_MODE=true: build the fictional demo cafés without delaying start-up
    import('./seed/bootstrap')
      .then(({ ensureDemo }) => ensureDemo())
      .catch((e) => console.error('demo setup failed', e));
  });

  // light housekeeping
  const housekeeping = setInterval(() => {
    purgeExpiredSessions().catch((e) => console.error('housekeeping', e));
    expireVouchers(db).catch((e) => console.error('housekeeping', e));
  }, 15 * 60 * 1000);
  housekeeping.unref();

  const shutdown = (sig: string) => {
    console.log(`${sig} received, shutting down`);
    server.close(() => closePool().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
