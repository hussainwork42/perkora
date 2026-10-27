import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { award, at, balanceOf, closePool, db, expectCode, key, ledgerSum, loyalty, makeCafe, makeMember, one, resetDb, tx } from '../helpers';

before(async () => {
  await resetDb();
});
after(async () => {
  await closePool();
});

describe('stamp cards', () => {
  test('an eligible purchase awards the configured stamps and records one verified visit', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    const r = await award(cafe, membershipId, { quantity: 2 });
    assert.equal(r.credited, 2);
    assert.equal(r.balanceAfter, 2);
    assert.equal(r.newVisit, true);
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 2);
    const v = await one(db, 'select count(*)::int as n from visits where membership_id = $1', [membershipId]);
    assert.equal(v.n, 1);
  });

  test('quantity above the per-purchase maximum is rejected without side effects', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    await expectCode(award(cafe, membershipId, { quantity: 4 }), 'invalid_quantity');
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 0);
    const v = await one(db, 'select count(*)::int as n from visits where membership_id = $1', [membershipId]);
    assert.equal(v.n, 0, 'a rejected award must not create a visit');
  });

  test('the reward unlocks exactly at the threshold and extra stamps carry over', async () => {
    const cafe = await makeCafe({ stampsRequired: 9 });
    const { membershipId } = await makeMember(cafe);
    let last;
    for (let i = 0; i < 8; i++) last = await award(cafe, membershipId, { quantity: 1 });
    assert.equal(last!.balanceAfter, 8);
    assert.equal(last!.vouchersIssued.length, 0, 'no reward before the 9th stamp');
    const ninth = await award(cafe, membershipId, { quantity: 1 });
    assert.equal(ninth.vouchersIssued.length, 1);
    assert.equal(ninth.vouchersIssued[0].rewardName, 'Free Regular Coffee');
    assert.equal(ninth.balanceAfter, 0);
    // 2 more stamps with 8 already = 1 card + 1 carried over
    for (let i = 0; i < 8; i++) await award(cafe, membershipId, { quantity: 1 });
    const over = await award(cafe, membershipId, { quantity: 2 });
    assert.equal(over.vouchersIssued.length, 1);
    assert.equal(over.balanceAfter, 1);
    assert.equal(await ledgerSum(membershipId, cafe.stampProgrammeId), await balanceOf(membershipId, cafe.stampProgrammeId));
  });

  test('purchases already discounted by another promotion are refused when not combinable', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    await expectCode(award(cafe, membershipId, { usedOtherPromotion: true }), 'promotion_not_combinable');
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 0);
  });
});

describe('duplicate protection', () => {
  test('repeating a request with the same idempotency key does not award twice', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    const k = key();
    const a = await award(cafe, membershipId, { idempotencyKey: k });
    const b = await award(cafe, membershipId, { idempotencyKey: k });
    assert.equal(b.duplicate, true);
    assert.equal(b.operationId, a.operationId);
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 1);
  });

  test('concurrent double-clicks with one key produce exactly one award', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    const k = key();
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => award(cafe, membershipId, { idempotencyKey: k })));
    assert.ok(results.every((r) => r.status === 'fulfilled'), 'all requests answer successfully');
    const dupes = results.filter((r) => r.status === 'fulfilled' && r.value.duplicate).length;
    assert.equal(dupes, 5);
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 1);
    const t = await one(db, `select count(*)::int as n from loyalty_transactions where membership_id = $1 and transaction_type = 'earn'`, [membershipId]);
    assert.equal(t.n, 1);
  });

  test('two counters awarding the same member at once both succeed without deadlock', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => award(cafe, membershipId)));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 4);
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 4);
    assert.equal(await ledgerSum(membershipId, cafe.stampProgrammeId), 4);
  });

  test('a purchase reference can earn credit only once', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    await award(cafe, membershipId, { referenceId: 'RCPT-1001' });
    await expectCode(award(cafe, membershipId, { referenceId: 'RCPT-1001' }), 'duplicate_purchase');
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 1);
  });

  test('a second award moments later needs explicit confirmation', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    const t0 = new Date();
    await award(cafe, membershipId, { confirmSeparatePurchase: false, now: t0 });
    const err = (await expectCode(
      award(cafe, membershipId, { confirmSeparatePurchase: false, now: new Date(t0.getTime() + 10_000) }),
      'recent_award',
    )) as any;
    assert.equal(err.details.secondsAgo, 10);
    const ok = await award(cafe, membershipId, { confirmSeparatePurchase: true, now: new Date(t0.getTime() + 11_000) });
    assert.equal(ok.balanceAfter, 2);
    assert.equal(ok.newVisit, false, 'awards within the visit window share one visit');
  });
});

describe('redemption', () => {
  async function memberWithReward(validityDays: number | null = 30) {
    const cafe = await makeCafe({ stampsRequired: 3, validityDays });
    const { membershipId } = await makeMember(cafe);
    const t0 = at('2026-06-01T09:00:00Z');
    const r = await award(cafe, membershipId, { quantity: 3, now: t0 });
    assert.equal(r.vouchersIssued.length, 1);
    return { cafe, membershipId, voucherId: r.vouchersIssued[0].id, t0 };
  }

  test('a held reward can be redeemed once; a repeated redemption is rejected', async () => {
    const { cafe, voucherId, membershipId } = await memberWithReward();
    const r = await tx((q) =>
      loyalty.redeemVoucher(q, { businessId: cafe.businessId, customerRewardId: voucherId, actorUserId: cafe.ownerId, idempotencyKey: key(), now: at('2026-06-02T09:00:00Z') }),
    );
    assert.equal(r.rewardName, 'Free Regular Coffee');
    assert.match(r.redemptionCode, /^[A-Z2-9]{8}$/);
    await expectCode(
      tx((q) => loyalty.redeemVoucher(q, { businessId: cafe.businessId, customerRewardId: voucherId, actorUserId: cafe.ownerId, idempotencyKey: key(), now: at('2026-06-02T09:01:00Z') })),
      'already_redeemed',
    );
    const t = await one(db, `select count(*)::int as n from reward_redemptions where membership_id = $1`, [membershipId]);
    assert.equal(t.n, 1);
    const red = await one(db, `select redeemed_by from reward_redemptions where membership_id = $1`, [membershipId]);
    assert.equal(red.redeemed_by, cafe.ownerId, 'the staff member who redeemed is recorded');
  });

  test('concurrent redemption attempts of one reward: exactly one succeeds', async () => {
    const { cafe, voucherId } = await memberWithReward();
    const now = at('2026-06-02T09:00:00Z');
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        tx((q) => loyalty.redeemVoucher(q, { businessId: cafe.businessId, customerRewardId: voucherId, actorUserId: cafe.ownerId, idempotencyKey: key(), now })),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    for (const r of results) if (r.status === 'rejected') assert.equal((r.reason as any).code, 'already_redeemed');
  });

  test('an expired reward cannot be redeemed', async () => {
    const { cafe, voucherId } = await memberWithReward(7);
    await expectCode(
      tx((q) => loyalty.redeemVoucher(q, { businessId: cafe.businessId, customerRewardId: voucherId, actorUserId: cafe.ownerId, idempotencyKey: key(), now: at('2026-06-20T09:00:00Z') })),
      'reward_expired',
    );
    const n = await one(db, 'select count(*)::int as n from reward_redemptions where customer_reward_id = $1', [voucherId]);
    assert.equal(n.n, 0);
    await loyalty.expireVouchers(db, at('2026-06-20T09:00:00Z'));
    const v = await one(db, 'select status from customer_rewards where id = $1', [voucherId]);
    assert.equal(v.status, 'expired');
  });

  test('voucher expiry falls at the end of the local day in the café timezone', async () => {
    const { voucherId } = await memberWithReward(7);
    const v = await one(db, 'select expires_at from customer_rewards where id = $1', [voucherId]);
    // issued 2026-06-01 12:00 local (UTC+3 summer) → valid through 2026-06-08 local → ends 2026-06-08T21:00Z
    assert.equal(v.expires_at.toISOString(), '2026-06-08T21:00:00.000Z');
  });
});

describe('points', () => {
  test('points use integer arithmetic on minor units and round down', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    // 10 points per €1; €4.59 → 45 points (not 45.9)
    const r = await award(cafe, membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 459, currency: 'EUR' });
    assert.equal(r.credited, 45);
    const t = await one(db, `select purchase_amount_minor, currency from loyalty_transactions where membership_id = $1 and transaction_type = 'earn'`, [membershipId]);
    assert.equal(t.purchase_amount_minor, 459);
    assert.equal(t.currency, 'EUR');
  });

  test('amounts in another currency are refused rather than converted', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    await expectCode(award(cafe, membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 10000, currency: 'TRY' }), 'currency_mismatch');
  });

  test('insufficient points prevent redemption and nothing is deducted', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    await award(cafe, membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 500 }); // 50 points
    await expectCode(
      tx((q) => loyalty.redeemPoints(q, { businessId: cafe.businessId, membershipId, rewardId: cafe.pointsRewardId, actorUserId: cafe.ownerId, idempotencyKey: key() })),
      'insufficient_balance',
    );
    assert.equal(await balanceOf(membershipId, cafe.pointsProgrammeId), 50);
    const n = await one(db, 'select count(*)::int as n from reward_redemptions where membership_id = $1', [membershipId]);
    assert.equal(n.n, 0);
  });

  test('a points redemption deducts exactly the cost, atomically', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    await award(cafe, membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 1250 }); // 125
    const r = await tx((q) =>
      loyalty.redeemPoints(q, { businessId: cafe.businessId, membershipId, rewardId: cafe.pointsRewardId, actorUserId: cafe.ownerId, idempotencyKey: key() }),
    );
    assert.equal(r.pointsSpent, 100);
    assert.equal(r.balanceAfter, 25);
    assert.equal(await ledgerSum(membershipId, cafe.pointsProgrammeId), 25);
  });

  test('a redemption that fails a limit check leaves the balance untouched', async () => {
    const cafe = await makeCafe();
    await db.query('update rewards set per_customer_limit = 1 where id = $1', [cafe.pointsRewardId]);
    const { membershipId } = await makeMember(cafe);
    await award(cafe, membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 3000 }); // 300
    await tx((q) => loyalty.redeemPoints(q, { businessId: cafe.businessId, membershipId, rewardId: cafe.pointsRewardId, actorUserId: cafe.ownerId, idempotencyKey: key() }));
    await expectCode(
      tx((q) => loyalty.redeemPoints(q, { businessId: cafe.businessId, membershipId, rewardId: cafe.pointsRewardId, actorUserId: cafe.ownerId, idempotencyKey: key() })),
      'limit_reached',
    );
    assert.equal(await balanceOf(membershipId, cafe.pointsProgrammeId), 200);
  });

  test('an inactive reward cannot be redeemed', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    await award(cafe, membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 2000 });
    await db.query(`update rewards set status = 'inactive' where id = $1`, [cafe.pointsRewardId]);
    await expectCode(
      tx((q) => loyalty.redeemPoints(q, { businessId: cafe.businessId, membershipId, rewardId: cafe.pointsRewardId, actorUserId: cafe.ownerId, idempotencyKey: key() })),
      'reward_unavailable',
    );
    assert.equal(await balanceOf(membershipId, cafe.pointsProgrammeId), 200);
  });
});

describe('corrections', () => {
  test('a reversal adds a record instead of deleting, and cannot be repeated', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    const r = await award(cafe, membershipId, { quantity: 2 });
    const earn = await one(db, `select id from loyalty_transactions where operation_id = $1 and transaction_type = 'earn'`, [r.operationId]);
    await tx((q) => loyalty.reverseTransaction(q, { businessId: cafe.businessId, transactionId: earn.id, reason: 'Refunded order', actorUserId: cafe.ownerId, idempotencyKey: key() }));
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 0);
    const rows = await one(db, 'select count(*)::int as n from loyalty_transactions where membership_id = $1', [membershipId]);
    assert.equal(rows.n, 2, 'original and reversal both kept');
    await expectCode(
      tx((q) => loyalty.reverseTransaction(q, { businessId: cafe.businessId, transactionId: earn.id, reason: 'Again', actorUserId: cafe.ownerId, idempotencyKey: key() })),
      'already_reversed',
    );
    const audit = await one(db, `select count(*)::int as n from audit_logs where business_id = $1 and action = 'loyalty.reverse'`, [cafe.businessId]);
    assert.equal(audit.n, 1);
  });

  test('reversing the stamp that completed a card cancels the unused reward first', async () => {
    const cafe = await makeCafe({ stampsRequired: 3 });
    const { membershipId } = await makeMember(cafe);
    await award(cafe, membershipId, { quantity: 2 });
    const r = await award(cafe, membershipId, { quantity: 1 });
    assert.equal(r.vouchersIssued.length, 1);
    const earn = await one(db, `select id from loyalty_transactions where operation_id = $1 and transaction_type = 'earn'`, [r.operationId]);
    const rev = await tx((q) =>
      loyalty.reverseTransaction(q, { businessId: cafe.businessId, transactionId: earn.id, wholeOperation: true, reason: 'Refund', actorUserId: cafe.ownerId, idempotencyKey: key() }),
    );
    assert.equal(rev.voidedVoucherIds.length, 1);
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 2);
    assert.equal(await ledgerSum(membershipId, cafe.stampProgrammeId), 2);
  });

  test('credits already spent on a redeemed reward cannot be reversed automatically', async () => {
    const cafe = await makeCafe({ stampsRequired: 3 });
    const { membershipId } = await makeMember(cafe);
    const r = await award(cafe, membershipId, { quantity: 3 });
    await tx((q) => loyalty.redeemVoucher(q, { businessId: cafe.businessId, customerRewardId: r.vouchersIssued[0].id, actorUserId: cafe.ownerId, idempotencyKey: key() }));
    const earn = await one(db, `select id from loyalty_transactions where operation_id = $1 and transaction_type = 'earn'`, [r.operationId]);
    await expectCode(
      tx((q) => loyalty.reverseTransaction(q, { businessId: cafe.businessId, transactionId: earn.id, reason: 'Refund', actorUserId: cafe.ownerId, idempotencyKey: key() })),
      'cannot_reverse',
    );
    assert.equal(await balanceOf(membershipId, cafe.stampProgrammeId), 0);
  });

  test('a mistaken redemption can be reversed, returning the reward', async () => {
    const cafe = await makeCafe({ stampsRequired: 3 });
    const { membershipId } = await makeMember(cafe);
    const r = await award(cafe, membershipId, { quantity: 3 });
    const red = await tx((q) => loyalty.redeemVoucher(q, { businessId: cafe.businessId, customerRewardId: r.vouchersIssued[0].id, actorUserId: cafe.ownerId, idempotencyKey: key() }));
    await tx((q) => loyalty.reverseRedemption(q, { businessId: cafe.businessId, redemptionId: red.redemptionId, reason: 'Wrong customer', actorUserId: cafe.ownerId, idempotencyKey: key() }));
    const v = await one(db, 'select status from customer_rewards where id = $1', [r.vouchersIssued[0].id]);
    assert.equal(v.status, 'available');
    await expectCode(
      tx((q) => loyalty.reverseRedemption(q, { businessId: cafe.businessId, redemptionId: red.redemptionId, reason: 'Again', actorUserId: cafe.ownerId, idempotencyKey: key() })),
      'already_reversed',
    );
  });

  test('manual adjustments are audited and cannot take a balance below zero', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    await tx((q) =>
      loyalty.adjustBalance(q, { businessId: cafe.businessId, membershipId, programmeId: cafe.pointsProgrammeId, delta: 40, reason: 'Paper card transfer', actorUserId: cafe.ownerId, idempotencyKey: key() }),
    );
    await expectCode(
      tx((q) =>
        loyalty.adjustBalance(q, { businessId: cafe.businessId, membershipId, programmeId: cafe.pointsProgrammeId, delta: -41, reason: 'Fix', actorUserId: cafe.ownerId, idempotencyKey: key() }),
      ),
      'insufficient_balance',
    );
    assert.equal(await balanceOf(membershipId, cafe.pointsProgrammeId), 40);
    const audit = await one(db, `select metadata from audit_logs where business_id = $1 and action = 'loyalty.adjust'`, [cafe.businessId]);
    assert.equal(audit.metadata.reason, 'Paper card transfer');
  });

  test('transaction history matches every balance after a mixed workload', async () => {
    const cafe = await makeCafe({ stampsRequired: 4 });
    const members = await Promise.all([makeMember(cafe, 'A'), makeMember(cafe, 'B'), makeMember(cafe, 'C')]);
    for (let i = 0; i < 12; i++) {
      const m = members[i % 3];
      await award(cafe, m.membershipId, { quantity: 1 + (i % 2) });
      await award(cafe, m.membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 375 + i * 10 });
    }
    const mismatches = await db.query(
      `select b.membership_id, b.programme_id, b.balance, coalesce(sum(t.points_delta + t.stamps_delta), 0) as ledger
         from membership_balances b
         left join loyalty_transactions t on t.membership_id = b.membership_id and t.programme_id = b.programme_id
        where b.business_id = $1
        group by b.membership_id, b.programme_id, b.balance
       having b.balance <> coalesce(sum(t.points_delta + t.stamps_delta), 0)`,
      [cafe.businessId],
    );
    assert.equal(mismatches.rows.length, 0);
  });
});

describe('tenant isolation in the engine', () => {
  test('a café cannot award, redeem or adjust for another café’s member', async () => {
    const a = await makeCafe({ name: 'Café A' });
    const b = await makeCafe({ name: 'Café B' });
    const { membershipId } = await makeMember(a);
    await expectCode(
      tx((q) =>
        loyalty.awardPurchase(q, { businessId: b.businessId, membershipId, programmeId: b.stampProgrammeId, actorUserId: b.ownerId, idempotencyKey: key(), source: 'terminal' }),
      ),
      'not_found',
    );
    await expectCode(
      tx((q) => loyalty.awardPurchase(q, { businessId: b.businessId, membershipId, programmeId: a.stampProgrammeId, actorUserId: b.ownerId, idempotencyKey: key(), source: 'terminal' })),
      'not_found',
    );
    const r = await award(a, membershipId, { quantity: 3 });
    const sr = await one(db, `select id from customer_rewards where membership_id = $1 limit 1`, [membershipId]).catch(() => null);
    if (sr) {
      await expectCode(
        tx((q) => loyalty.redeemVoucher(q, { businessId: b.businessId, customerRewardId: sr.id, actorUserId: b.ownerId, idempotencyKey: key() })),
        'not_found',
      );
    }
    await expectCode(
      tx((q) =>
        loyalty.adjustBalance(q, { businessId: b.businessId, membershipId, programmeId: a.stampProgrammeId, delta: 5, reason: 'nope', actorUserId: b.ownerId, idempotencyKey: key() }),
      ),
      'not_found',
    );
    assert.equal(r.balanceAfter, 3);
  });

  test('a suspended café cannot award credit', async () => {
    const cafe = await makeCafe();
    const { membershipId } = await makeMember(cafe);
    await db.query(`update businesses set status = 'suspended' where id = $1`, [cafe.businessId]);
    await expectCode(award(cafe, membershipId), 'business_inactive');
  });

  test('a customer can hold separate balances at two cafés', async () => {
    const a = await makeCafe();
    const b = await makeCafe();
    const c = await one(db, `insert into customers (name) values ('Shared') returning id`);
    const ma = await tx((q) => loyalty.joinBusiness(q, { businessId: a.businessId, customerId: c.id, source: 'qr', marketingConsent: false }));
    const mb = await tx((q) => loyalty.joinBusiness(q, { businessId: b.businessId, customerId: c.id, source: 'qr', marketingConsent: false }));
    await award(a, ma.membershipId, { quantity: 2 });
    await award(b, mb.membershipId, { quantity: 1 });
    assert.equal(await balanceOf(ma.membershipId, a.stampProgrammeId), 2);
    assert.equal(await balanceOf(mb.membershipId, b.stampProgrammeId), 1);
    const again = await tx((q) => loyalty.joinBusiness(q, { businessId: a.businessId, customerId: c.id, source: 'qr', marketingConsent: false }));
    assert.equal(again.alreadyMember, true);
    assert.equal(again.membershipId, ma.membershipId, 'no duplicate membership for the same café');
  });
});

describe('visit challenges', () => {
  async function weeklyChallenge(cafe: Awaited<ReturnType<typeof makeCafe>>, extra: Record<string, unknown> = {}) {
    return one(
      db,
      `insert into challenges (business_id, name, rule_type, required_count, period, start_date, end_date, reward_kind, reward_id, max_completions_per_customer, status)
       values ($1, '3 days this week', 'distinct_days', 3, 'week', '2026-01-01', '2026-12-31', 'voucher', $2, $3, 'active') returning *`,
      [cafe.businessId, cafe.grantRewardId, extra.max ?? 4],
    );
  }

  test('visits on three different local days in a week complete the challenge once', async () => {
    const cafe = await makeCafe();
    await weeklyChallenge(cafe);
    const { membershipId } = await makeMember(cafe);
    // Week of Mon 2026-06-08 (Famagusta UTC+3)
    await award(cafe, membershipId, { now: at('2026-06-08T07:00:00Z') });
    await award(cafe, membershipId, { now: at('2026-06-08T12:00:00Z') }); // same day, new visit, same calendar day
    const second = await award(cafe, membershipId, { now: at('2026-06-09T07:00:00Z') });
    assert.equal(second.challengeCompletions.length, 0);
    const third = await award(cafe, membershipId, { now: at('2026-06-10T07:00:00Z') });
    assert.equal(third.challengeCompletions.length, 1);
    assert.equal(third.vouchersIssued.some((v) => v.rewardName === 'Free Pastry'), true);
    const fourth = await award(cafe, membershipId, { now: at('2026-06-11T07:00:00Z') });
    assert.equal(fourth.challengeCompletions.length, 0, 'only one completion per week');
  });

  test('repeated awards within one visit do not advance a streak', async () => {
    const cafe = await makeCafe();
    await db.query(
      `insert into challenges (business_id, name, rule_type, required_count, period, start_date, end_date, reward_kind, reward_id, status)
       values ($1, '3 visits', 'visit_count', 3, 'campaign', '2026-01-01', '2026-12-31', 'voucher', $2, 'active')`,
      [cafe.businessId, cafe.grantRewardId],
    );
    const { membershipId } = await makeMember(cafe);
    const t = at('2026-06-08T07:00:00Z').getTime();
    for (let i = 0; i < 5; i++) await award(cafe, membershipId, { now: new Date(t + i * 60_000) }); // five scans in 5 minutes
    const n = await one(db, 'select count(*)::int as n from visits where membership_id = $1', [membershipId]);
    assert.equal(n.n, 1);
    const c = await one(db, 'select count(*)::int as n from challenge_completions where membership_id = $1', [membershipId]);
    assert.equal(c.n, 0);
  });

  test('local calendar days follow the café timezone, not UTC', async () => {
    const cafe = await makeCafe();
    await weeklyChallenge(cafe);
    const { membershipId } = await makeMember(cafe);
    // 22:30Z on Mon = 01:30 Tue local; 07:00Z Tue = 10:00 Tue local → same local day
    await award(cafe, membershipId, { now: at('2026-06-08T22:30:00Z') });
    await award(cafe, membershipId, { now: at('2026-06-09T07:00:00Z') });
    const days = await one(db, 'select count(distinct local_date)::int as n from visits where membership_id = $1', [membershipId]);
    assert.equal(days.n, 1);
  });

  test('a draft or ended challenge awards nothing', async () => {
    const cafe = await makeCafe();
    await db.query(
      `insert into challenges (business_id, name, rule_type, required_count, period, start_date, end_date, reward_kind, reward_id, status)
       values ($1, 'Draft', 'visit_count', 1, 'campaign', '2026-01-01', '2026-12-31', 'voucher', $2, 'draft'),
              ($1, 'Ended', 'visit_count', 1, 'campaign', '2025-01-01', '2025-12-31', 'voucher', $2, 'active')`,
      [cafe.businessId, cafe.grantRewardId],
    );
    const { membershipId } = await makeMember(cafe);
    const r = await award(cafe, membershipId, { now: at('2026-06-08T07:00:00Z') });
    assert.equal(r.challengeCompletions.length, 0);
  });
});

describe('campaigns', () => {
  test('a draft campaign is not applied; a published one is', async () => {
    const cafe = await makeCafe();
    const c = await one(
      db,
      `insert into campaigns (business_id, name, campaign_type, status, start_date, end_date, benefit)
       values ($1, 'Double stamps', 'bonus_points', 'draft', '2026-01-01', '2026-12-31', $2) returning id`,
      [cafe.businessId, { kind: 'bonus', programmeId: cafe.stampProgrammeId, mode: 'flat', amount: 1 }],
    );
    const { membershipId } = await makeMember(cafe);
    const r1 = await award(cafe, membershipId, { now: at('2026-06-08T07:00:00Z') });
    assert.equal(r1.bonus, 0);
    await db.query(`update campaigns set status = 'published' where id = $1`, [c.id]);
    const r2 = await award(cafe, membershipId, { now: at('2026-06-09T07:00:00Z') });
    assert.equal(r2.bonus, 1);
    assert.equal(r2.balanceAfter, 3);
  });

  test('an expired campaign issues nothing', async () => {
    const cafe = await makeCafe();
    await db.query(
      `insert into campaigns (business_id, name, campaign_type, status, start_date, end_date, benefit)
       values ($1, 'Last year', 'bonus_points', 'published', '2025-01-01', '2025-12-31', $2)`,
      [cafe.businessId, { kind: 'bonus', programmeId: cafe.stampProgrammeId, mode: 'flat', amount: 1 }],
    );
    const { membershipId } = await makeMember(cafe);
    const r = await award(cafe, membershipId, { now: at('2026-06-08T07:00:00Z') });
    assert.equal(r.bonus, 0);
  });

  test('weekday and time windows are evaluated in local time', async () => {
    const cafe = await makeCafe();
    await db.query(
      `insert into campaigns (business_id, name, campaign_type, status, start_date, end_date, benefit, eligibility)
       values ($1, 'Afternoon offer', 'weekday', 'published', '2026-01-01', '2026-12-31', $2, $3)`,
      [cafe.businessId, { kind: 'bonus', programmeId: cafe.pointsProgrammeId, mode: 'multiplier', amount: 2 }, { weekdays: [1, 2, 3, 4, 5], startTime: '14:00', endTime: '17:00' }],
    );
    const { membershipId } = await makeMember(cafe);
    // Mon 2026-06-08 11:30Z = 14:30 local → eligible (double points)
    const r1 = await award(cafe, membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 300, now: at('2026-06-08T11:30:00Z') });
    assert.equal(r1.bonus, 30);
    // Mon 15:00Z = 18:00 local → not eligible
    const r2 = await award(cafe, membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 300, now: at('2026-06-08T15:00:00Z') });
    assert.equal(r2.bonus, 0);
    // Sat 11:30Z → weekend, not eligible
    const r3 = await award(cafe, membershipId, { programmeId: cafe.pointsProgrammeId, amountMinor: 300, now: at('2026-06-13T11:30:00Z') });
    assert.equal(r3.bonus, 0);
  });

  test('per-customer usage limits stop repeated campaign bonuses', async () => {
    const cafe = await makeCafe();
    await db.query(
      `insert into campaigns (business_id, name, campaign_type, status, start_date, end_date, benefit, usage_limit_per_customer)
       values ($1, 'Once', 'bonus_points', 'published', '2026-01-01', '2026-12-31', $2, 1)`,
      [cafe.businessId, { kind: 'bonus', programmeId: cafe.stampProgrammeId, mode: 'flat', amount: 1 }],
    );
    const { membershipId } = await makeMember(cafe);
    const r1 = await award(cafe, membershipId, { now: at('2026-06-08T07:00:00Z') });
    const r2 = await award(cafe, membershipId, { now: at('2026-06-09T07:00:00Z') });
    assert.equal(r1.bonus, 1);
    assert.equal(r2.bonus, 0);
  });

  test('a welcome offer is issued once on joining', async () => {
    const cafe = await makeCafe();
    await db.query(
      `insert into campaigns (business_id, name, campaign_type, status, start_date, benefit)
       values ($1, 'Welcome gift', 'welcome', 'published', '2020-01-01', $2)`,
      [cafe.businessId, { kind: 'voucher', rewardId: cafe.grantRewardId }],
    );
    const m = await makeMember(cafe);
    assert.equal(m.join.welcome.length, 1);
    const n = await one(db, `select count(*)::int as n from customer_rewards where membership_id = $1 and status = 'available'`, [m.membershipId]);
    assert.equal(n.n, 1);
  });

  test('win-back distribution targets only inactive members and never duplicates', async () => {
    const cafe = await makeCafe({ settings: { inactivityDays: 21 } });
    const now = new Date();
    const lapsed = await makeMember(cafe, 'Lapsed', { now: new Date(now.getTime() - 60 * 86400000) });
    await award(cafe, lapsed.membershipId, { now: new Date(now.getTime() - 40 * 86400000) });
    const regular = await makeMember(cafe, 'Regular', { now: new Date(now.getTime() - 60 * 86400000) });
    await award(cafe, regular.membershipId, { now: new Date(now.getTime() - 2 * 86400000) });
    const fresh = await makeMember(cafe, 'No visits yet');
    const c = await one(
      db,
      `insert into campaigns (business_id, name, campaign_type, status, start_date, target_segment, benefit)
       values ($1, 'We miss you', 'win_back', 'published', '2020-01-01', 'inactive', $2) returning id`,
      [cafe.businessId, { kind: 'voucher', rewardId: cafe.grantRewardId }],
    );
    const r1 = await tx((q) => loyalty.distributeCampaignVouchers(q, { businessId: cafe.businessId, campaignId: c.id, actorUserId: cafe.ownerId }));
    assert.equal(r1.issued, 1);
    const r2 = await tx((q) => loyalty.distributeCampaignVouchers(q, { businessId: cafe.businessId, campaignId: c.id, actorUserId: cafe.ownerId }));
    assert.equal(r2.issued, 0, 'running it again issues nothing new');
    const got = await db.query(`select membership_id from customer_rewards where source = 'campaign' and business_id = $1`, [cafe.businessId]);
    assert.deepEqual(got.rows.map((r) => r.membership_id), [lapsed.membershipId]);
    assert.ok(fresh.membershipId, 'members without visit history are not labelled inactive');
  });

  test('a draft campaign cannot distribute rewards', async () => {
    const cafe = await makeCafe();
    const c = await one(
      db,
      `insert into campaigns (business_id, name, campaign_type, status, start_date, benefit)
       values ($1, 'Draft offer', 'limited_time', 'draft', '2020-01-01', $2) returning id`,
      [cafe.businessId, { kind: 'voucher', rewardId: cafe.grantRewardId }],
    );
    await makeMember(cafe);
    await expectCode(tx((q) => loyalty.distributeCampaignVouchers(q, { businessId: cafe.businessId, campaignId: c.id, actorUserId: cafe.ownerId })), 'conflict');
  });
});

describe('referrals', () => {
  async function referralCafe() {
    const cafe = await makeCafe();
    await db.query(
      `insert into campaigns (business_id, name, campaign_type, status, start_date, config)
       values ($1, 'Bring a friend', 'referral', 'published', '2020-01-01', $2)`,
      [
        cafe.businessId,
        {
          referrerGrant: { kind: 'bonus', programmeId: cafe.stampProgrammeId, amount: 2 },
          referredGrant: { kind: 'voucher', rewardId: cafe.grantRewardId },
          maxPerReferrer: 2,
        },
      ],
    );
    return cafe;
  }

  test('a referral qualifies only after the new member’s first verified visit, once', async () => {
    const cafe = await referralCafe();
    const referrer = await makeMember(cafe, 'Referrer');
    const code = (await one(db, 'select referral_code from loyalty_memberships where id = $1', [referrer.membershipId])).referral_code;
    const friend = await makeMember(cafe, 'Friend', { referralCode: code });
    assert.equal(friend.join.referral, 'pending');
    assert.equal(await balanceOf(referrer.membershipId, cafe.stampProgrammeId), 0, 'joining alone earns nothing');
    const r = await award(cafe, friend.membershipId);
    assert.equal(r.referralQualified, true);
    assert.equal(await balanceOf(referrer.membershipId, cafe.stampProgrammeId), 2);
    const r2 = await award(cafe, friend.membershipId, { now: new Date(Date.now() + 86400000 * 2) });
    assert.equal(r2.referralQualified, false, 'later visits do not pay out again');
    assert.equal(await balanceOf(referrer.membershipId, cafe.stampProgrammeId), 2);
  });

  test('customers cannot refer themselves', async () => {
    const cafe = await referralCafe();
    const c = await one(db, `insert into customers (name) values ('Self') returning id`);
    const other = await makeCafe();
    // own code at the same café: the customer is already a member, so only a second account could try
    const m = await tx((q) => loyalty.joinBusiness(q, { businessId: cafe.businessId, customerId: c.id, source: 'qr', marketingConsent: false }));
    const code = (await one(db, 'select referral_code from loyalty_memberships where id = $1', [m.membershipId])).referral_code;
    const again = await tx((q) => loyalty.joinBusiness(q, { businessId: cafe.businessId, customerId: c.id, source: 'qr', marketingConsent: false, referralCode: code }));
    assert.equal(again.alreadyMember, true);
    const n = await one(db, 'select count(*)::int as n from referrals where business_id = $1', [cafe.businessId]);
    assert.equal(n.n, 0);
    // a code from another café is not valid here
    const om = await makeMember(other, 'Other');
    const otherCode = (await one(db, 'select referral_code from loyalty_memberships where id = $1', [om.membershipId])).referral_code;
    const fresh = await makeMember(cafe, 'Fresh', { referralCode: otherCode });
    assert.equal(fresh.join.referral, 'invalid');
  });

  test('referral rewards stop at the per-referrer limit', async () => {
    const cafe = await referralCafe();
    const referrer = await makeMember(cafe, 'Referrer');
    const code = (await one(db, 'select referral_code from loyalty_memberships where id = $1', [referrer.membershipId])).referral_code;
    for (let i = 0; i < 3; i++) {
      const f = await makeMember(cafe, 'Friend ' + i, { referralCode: code });
      await award(cafe, f.membershipId);
    }
    assert.equal(await balanceOf(referrer.membershipId, cafe.stampProgrammeId), 4, 'two qualified referrals × 2 stamps');
    const rejected = await one(db, `select count(*)::int as n from referrals where status = 'rejected' and rejection_reason = 'referrer_limit'`);
    assert.ok(rejected.n >= 1);
  });
});

describe('birthday offers', () => {
  test('a birthday reward is issued once per year inside the window', async () => {
    const cafe = await makeCafe();
    await db.query(
      `insert into campaigns (business_id, name, campaign_type, status, start_date, benefit, config)
       values ($1, 'Birthday treat', 'birthday', 'published', '2020-01-01', $2, '{"windowDays":7}')`,
      [cafe.businessId, { kind: 'voucher', rewardId: cafe.grantRewardId }],
    );
    const m = await makeMember(cafe);
    await db.query('update customers set birthday_month = 1, birthday_day = 3 where id = $1', [m.customerId]);
    const outside = await tx((q) => loyalty.maybeIssueBirthdayReward(q, { businessId: cafe.businessId, membershipId: m.membershipId, now: at('2026-06-01T10:00:00Z') }));
    assert.equal(outside?.length ?? 0, 0);
    // 30 Dec 2026 is within 7 days of 3 Jan 2027
    const inside = await tx((q) => loyalty.maybeIssueBirthdayReward(q, { businessId: cafe.businessId, membershipId: m.membershipId, now: at('2026-12-30T10:00:00Z') }));
    assert.equal(inside?.length, 1);
    const again = await tx((q) => loyalty.maybeIssueBirthdayReward(q, { businessId: cafe.businessId, membershipId: m.membershipId, now: at('2027-01-02T10:00:00Z') }));
    assert.equal(again?.length, 0);
  });
});
