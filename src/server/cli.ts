import { loadEnvFile } from './config';
import { closePool } from './db';

loadEnvFile();

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'migrate': {
      const { migrate } = await import('./db/migrate');
      await migrate();
      break;
    }
    case 'seed': {
      const { seedAll } = await import('./seed/seed');
      await seedAll();
      break;
    }
    case 'demo-reset': {
      const { resetDemo } = await import('./seed/seed');
      await resetDemo();
      break;
    }
    case 'bootstrap': {
      const { bootstrap } = await import('./seed/bootstrap');
      await bootstrap();
      break;
    }
    case 'create-admin': {
      const { createAdminCli } = await import('./seed/admin');
      await createAdminCli(args);
      break;
    }
    default:
      console.log('Usage: node dist/cli.cjs <migrate|bootstrap|seed|demo-reset|create-admin --email you@example.com --name "Your Name">');
      process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closePool());
