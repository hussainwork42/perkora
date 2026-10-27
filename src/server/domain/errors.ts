export type DomainErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'validation'
  | 'business_inactive'
  | 'membership_inactive'
  | 'programme_inactive'
  | 'invalid_quantity'
  | 'invalid_amount'
  | 'below_min_spend'
  | 'amount_too_large'
  | 'currency_mismatch'
  | 'promotion_not_combinable'
  | 'duplicate_purchase'
  | 'recent_award'
  | 'insufficient_balance'
  | 'reward_unavailable'
  | 'reward_not_started'
  | 'reward_expired'
  | 'already_redeemed'
  | 'voucher_void'
  | 'limit_reached'
  | 'cannot_reverse'
  | 'already_reversed'
  | 'idempotency_conflict'
  | 'plan_feature'
  | 'plan_limit'
  | 'conflict'
  | 'rate_limited'
  | 'invalid_token'
  | 'token_expired'
  | 'other_cafe';

export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message: string,
    public status = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const notFound = (what = 'Record') => new DomainError('not_found', `${what} not found`, 404);
export const forbidden = (message = 'You do not have permission to do that') => new DomainError('forbidden', message, 403);
