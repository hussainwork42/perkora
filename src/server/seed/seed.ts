import { db } from '../db';
import { DEFAULT_PLANS } from '../domain/plans';

export async function seedPlans() {
  for (const p of DEFAULT_PLANS) {
    await db.query(
      `insert into plans (id, name, description, monthly_price_minor, currency, feature_configuration, is_recommended, sort_order)
       values ($1, $2, $3, $4, 'EUR', $5, $6, $7)
       on conflict (id) do nothing`,
      [p.id, p.name, p.description, p.monthly_price_minor, p.feature_configuration, p.is_recommended, p.sort_order],
    );
  }
}

export async function seedAll() {
  await seedPlans();
  console.log('plans ready');
  const { seedDemo } = await import('./demo');
  await seedDemo();
}

export async function resetDemo() {
  const { resetDemoData } = await import('./demo');
  await resetDemoData();
}
