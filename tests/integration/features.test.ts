/**
 * Engine-level tests for the November changes: the simplified referral programme
 * (reward on join or first visit, optional friend reward, Basic plan), and the
 * two-plan catalogue.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { award, balanceOf, closePool, db, makeCafe, makeMember, one, resetDb, tx } from '../helpers';

const { saveReferralProgramme, loadReferralProgramme, referralStats } = await import('../../src/server/domain/referrals');

async function referralCode(membershipId: string): Promise<string> {
  return (await one<{ referral_code: string }>(db, 'select referral_code from loyalty_memberships where id = $1', [membershipId])).referral_code;
}

before(async () => {
  await resetDb();
});
after(async () => {
  await closePool();
});

describe('referral programme', () => {
  test('rewarding on join gives the inviter their stamps immediately, once', async () => {
    const cafe = await makeCafe();
    await tx((q) =>
      saveReferralProgramme(q, { id: cafe.businessId, timezone: 'Asia/Famagusta' }, {
        enabled: true,
        name: 'Coffee buddies',
        description: null,
        config: { referrerGrant: { kind: 'bonus', programmeId: cafe.stampProgrammeId, amount: 2 }, referredGrant: { kind: 'none' }, maxPerReferrer: 10, qualifyOn: 'join' },
      }),
    );
    const inviter = await makeMember(cafe, 'Inviter One');
    const friend = await makeMember(cafe, 'Friend One', { referralCode: await referralCode(inviter.membershipId) });
    assert.equal(friend.join.referral, 'qualified');
    assert.equal(await balanceOf(inviter.membershipId, cafe.stampProgrammeId), 2);
    // the friend reward is "nothing"
    assert.equal(await balanceOf(friend.membershipId, cafe.stampProgrammeId), 0);
    // a later purchase by the friend does not pay the inviter again
    await award(cafe, friend.membershipId);
    assert.equal(await balanceOf(inviter.membershipId, cafe.stampProgrammeId), 2);
    const stats = await referralStats(db, cafe.businessId);
    assert.equal(stats.qualified, 1);
    assert.equal(stats.top[0].name, 'Inviter One');
  });

  test('rewarding on first visit waits for a verified purchase', async () => {
    const cafe = await makeCafe();
    await tx((q) =>
      saveReferralProgramme(q, { id: cafe.businessId, timezone: 'Asia/Famagusta' }, {
        enabled: true,
        name: 'Bring a friend',
        description: null,
        config: {
          referrerGrant: { kind: 'bonus', programmeId: cafe.stampProgrammeId, amount: 1 },
          referredGrant: { kind: 'bonus', programmeId: cafe.stampProgrammeId, amount: 1 },
          maxPerReferrer: 10,
          qualifyOn: 'first_visit',
        },
      }),
    );
    const inviter = await makeMember(cafe, 'Inviter Two');
    const friend = await makeMember(cafe, 'Friend Two', { referralCode: await referralCode(inviter.membershipId) });
    assert.equal(friend.join.referral, 'pending');
    assert.equal(await balanceOf(inviter.membershipId, cafe.stampProgrammeId), 0);
    const r = await award(cafe, friend.membershipId);
    assert.equal(r.referralQualified, true);
    assert.equal(await balanceOf(inviter.membershipId, cafe.stampProgrammeId), 1);
    assert.equal(await balanceOf(friend.membershipId, cafe.stampProgrammeId), 2); // purchase + friend reward
  });

  test('turning the programme off stops new rewards; saving again reuses one programme', async () => {
    const cafe = await makeCafe();
    const base = { referrerGrant: { kind: 'bonus' as const, programmeId: cafe.stampProgrammeId, amount: 1 }, referredGrant: { kind: 'none' as const }, maxPerReferrer: 10, qualifyOn: 'join' as const };
    const id1 = await tx((q) => saveReferralProgramme(q, { id: cafe.businessId, timezone: 'Asia/Famagusta' }, { enabled: true, name: 'A', description: null, config: base }));
    const id2 = await tx((q) => saveReferralProgramme(q, { id: cafe.businessId, timezone: 'Asia/Famagusta' }, { enabled: false, name: 'B', description: null, config: base }));
    assert.equal(id1, id2);
    const p = await loadReferralProgramme(db, cafe.businessId);
    assert.equal(p?.enabled, false);
    assert.equal(p?.name, 'B');
    const inviter = await makeMember(cafe, 'Inviter Three');
    const friend = await makeMember(cafe, 'Friend Three', { referralCode: await referralCode(inviter.membershipId) });
    assert.notEqual(friend.join.referral, 'qualified');
    assert.equal(await balanceOf(inviter.membershipId, cafe.stampProgrammeId), 0);
  });

  test('the per-member limit applies to join-time rewards', async () => {
    const cafe = await makeCafe();
    await tx((q) =>
      saveReferralProgramme(q, { id: cafe.businessId, timezone: 'Asia/Famagusta' }, {
        enabled: true,
        name: 'Limited',
        description: null,
        config: { referrerGrant: { kind: 'bonus', programmeId: cafe.stampProgrammeId, amount: 1 }, referredGrant: { kind: 'none' }, maxPerReferrer: 2, qualifyOn: 'join' },
      }),
    );
    const inviter = await makeMember(cafe, 'Busy Inviter');
    const code = await referralCode(inviter.membershipId);
    for (let i = 0; i < 4; i++) await makeMember(cafe, `Friend ${i}`, { referralCode: code });
    assert.equal(await balanceOf(inviter.membershipId, cafe.stampProgrammeId), 2);
  });

  test('referral rewards work on the Basic plan', async () => {
    const cafe = await makeCafe();
    await db.query(`update subscriptions set plan_id = 'basic' where business_id = $1`, [cafe.businessId]);
    const plan = await one<{ feature_configuration: any }>(db, `select feature_configuration from plans where id = 'basic'`);
    assert.equal(plan.feature_configuration.features.referrals, true);
    assert.equal(Boolean(plan.feature_configuration.features.campaigns), false);
    await tx((q) =>
      saveReferralProgramme(q, { id: cafe.businessId, timezone: 'Asia/Famagusta' }, {
        enabled: true,
        name: 'Bring a friend',
        description: null,
        config: { referrerGrant: { kind: 'bonus', programmeId: cafe.stampProgrammeId, amount: 1 }, referredGrant: { kind: 'none' }, maxPerReferrer: 5, qualifyOn: 'join' },
      }),
    );
    const inviter = await makeMember(cafe, 'Basic Inviter');
    await makeMember(cafe, 'Basic Friend', { referralCode: await referralCode(inviter.membershipId) });
    assert.equal(await balanceOf(inviter.membershipId, cafe.stampProgrammeId), 1);
  });
});

describe('plans', () => {
  test('there are exactly two plans: Basic and Premium (recommended)', async () => {
    const rows = await db.query(`select id, name, monthly_price_minor, is_recommended from plans where status = 'active' order by sort_order`);
    assert.deepEqual(
      rows.rows.map((r: any) => [r.id, r.name, r.monthly_price_minor, r.is_recommended]),
      [
        ['basic', 'Basic', 900, false],
        ['premium', 'Premium', 1900, true],
      ],
    );
  });
});
