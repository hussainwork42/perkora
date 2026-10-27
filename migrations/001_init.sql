-- Perkora initial schema
-- Conventions:
--   * every tenant-owned table carries business_id and is always queried with it
--   * money is stored as integer minor units (cents/kuruş) with an explicit currency
--   * loyalty balances change only through loyalty_transactions (append-only);
--     membership_balances is a cache updated in the same database transaction
--   * all timestamps are timestamptz (UTC); local dates use the café's timezone

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users & auth
create table users (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(name) between 1 and 120),
  email           text not null check (length(email) between 3 and 254),
  platform_role   text check (platform_role in ('admin')),
  locale          text not null default 'en' check (locale in ('en', 'tr')),
  status          text not null default 'active' check (status in ('active', 'disabled', 'deleted')),
  is_demo         boolean not null default false,
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index users_email_key on users (lower(email));

-- Password hashes live apart from the profile so profile queries never touch them.
create table user_credentials (
  user_id       uuid primary key references users (id) on delete cascade,
  password_hash text not null,
  updated_at    timestamptz not null default now()
);

create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  token_hash   text not null unique,
  csrf_token   text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expiry_idx on sessions (expires_at);

-- ---------------------------------------------------------------- plans
create table plans (
  id                    text primary key check (id ~ '^[a-z0-9_-]{2,32}$'),
  name                  text not null,
  description           text not null default '',
  monthly_price_minor   integer not null check (monthly_price_minor >= 0),
  currency              text not null default 'EUR' check (currency in ('EUR', 'TRY')),
  feature_configuration jsonb not null default '{}'::jsonb,
  is_recommended        boolean not null default false,
  sort_order            integer not null default 0,
  status                text not null default 'active' check (status in ('active', 'hidden', 'retired')),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------- businesses
create table businesses (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(name) between 1 and 120),
  slug             text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  owner_user_id    uuid not null references users (id),
  owner_name       text,
  business_email   text,
  phone            text,
  website          text,
  description      text,
  city             text,
  address          text,
  logo_upload_id   uuid,
  primary_colour   text not null default '#3B2925' check (primary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_colour text not null default '#B86F52' check (secondary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  timezone         text not null default 'Asia/Famagusta',
  default_currency text not null default 'EUR' check (default_currency in ('EUR', 'TRY')),
  status           text not null default 'onboarding' check (status in ('onboarding', 'active', 'suspended')),
  onboarding_step  integer not null default 1 check (onboarding_step between 1 and 6),
  settings         jsonb not null default '{}'::jsonb,
  is_demo          boolean not null default false,
  activated_at     timestamptz,
  suspended_at     timestamptz,
  suspended_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index businesses_owner_idx on businesses (owner_user_id);

create table uploads (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid references businesses (id) on delete cascade,
  uploaded_by  uuid references users (id) on delete set null,
  purpose      text not null check (purpose in ('logo', 'reward')),
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size    integer not null check (byte_size > 0 and byte_size <= 1048576),
  sha256       text not null,
  data         bytea not null,
  created_at   timestamptz not null default now()
);
create index uploads_business_idx on uploads (business_id);
alter table businesses add constraint businesses_logo_fk foreign key (logo_upload_id) references uploads (id) on delete set null;

create table business_members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  role        text not null check (role in ('owner', 'staff')),
  status      text not null default 'active' check (status in ('active', 'deactivated')),
  permissions jsonb not null default '{}'::jsonb,
  invited_by  uuid references users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, user_id)
);
create index business_members_user_idx on business_members (user_id);

create table staff_invitations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  email       text not null,
  name        text,
  permissions jsonb not null default '{}'::jsonb,
  token_hash  text not null unique,
  invited_by  uuid not null references users (id),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references users (id),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index staff_invitations_business_idx on staff_invitations (business_id);

create table subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null unique references businesses (id) on delete cascade,
  plan_id              text not null references plans (id),
  requested_plan_id    text references plans (id),
  status               text not null check (status in ('demo', 'trialing', 'pending_activation', 'active', 'past_due', 'cancelled')),
  payment_status       text not null default 'not_configured' check (payment_status in ('not_configured', 'not_collected', 'paid', 'failed')),
  provider             text not null default 'manual',
  provider_reference   text,
  trial_ends_at        timestamptz,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------- customers & memberships
-- A customer is a person. They may have a user account (self-registered) or
-- be added at the counter by a café (user_id null). Contact details are optional.
create table customers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid unique references users (id) on delete set null,
  name           text not null check (length(name) between 1 and 120),
  email          text,
  phone          text,
  birthday_month smallint check (birthday_month between 1 and 12),
  birthday_day   smallint check (birthday_day between 1 and 31),
  is_demo        boolean not null default false,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index customers_email_idx on customers (lower(email));
create index customers_phone_idx on customers (phone);

create table loyalty_programmes (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses (id) on delete cascade,
  name           text not null check (length(name) between 1 and 80),
  programme_type text not null check (programme_type in ('stamps', 'points')),
  config         jsonb not null,
  terms          text,
  status         text not null default 'active' check (status in ('draft', 'active', 'paused', 'archived')),
  start_date     date,
  end_date       date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  unique (business_id, id)
);
create index loyalty_programmes_business_idx on loyalty_programmes (business_id);

create table loyalty_memberships (
  id                        uuid primary key default gen_random_uuid(),
  business_id               uuid not null references businesses (id) on delete cascade,
  customer_id               uuid not null references customers (id) on delete cascade,
  member_code               text not null unique check (member_code ~ '^[A-Z2-9]{8}$'),
  referral_code             text not null unique check (referral_code ~ '^[A-Z2-9]{6,10}$'),
  status                    text not null default 'active' check (status in ('active', 'paused', 'closed')),
  source                    text not null check (source in ('qr', 'dashboard', 'referral', 'demo', 'claim')),
  marketing_consent         boolean not null default false,
  consent_updated_at        timestamptz,
  referred_by_membership_id uuid references loyalty_memberships (id) on delete set null,
  joined_at                 timestamptz not null default now(),
  last_visit_at             timestamptz,
  visit_count               integer not null default 0 check (visit_count >= 0),
  last_birthday_year        integer,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (business_id, customer_id),
  unique (business_id, id)
);
create index loyalty_memberships_business_joined_idx on loyalty_memberships (business_id, joined_at desc);
create index loyalty_memberships_business_visit_idx on loyalty_memberships (business_id, last_visit_at);

create table membership_balances (
  membership_id   uuid not null references loyalty_memberships (id) on delete cascade,
  programme_id    uuid not null references loyalty_programmes (id) on delete cascade,
  business_id     uuid not null references businesses (id) on delete cascade,
  balance         integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent  integer not null default 0 check (lifetime_spent >= 0),
  updated_at      timestamptz not null default now(),
  primary key (membership_id, programme_id)
);
create index membership_balances_business_idx on membership_balances (business_id, programme_id);

-- Every state-changing loyalty request is an operation with a client-supplied
-- idempotency key. A repeated key returns the stored result instead of acting twice.
create table loyalty_operations (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses (id) on delete cascade,
  membership_id   uuid references loyalty_memberships (id) on delete cascade,
  kind            text not null check (kind in ('award', 'redeem_voucher', 'redeem_points', 'reverse', 'adjust', 'void_voucher', 'join', 'campaign_issue')),
  idempotency_key text not null check (length(idempotency_key) between 8 and 120),
  actor_user_id   uuid references users (id) on delete set null,
  result          jsonb,
  created_at      timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table visits (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses (id) on delete cascade,
  membership_id uuid not null references loyalty_memberships (id) on delete cascade,
  verified_by   uuid references users (id) on delete set null,
  source        text not null check (source in ('terminal', 'dashboard', 'seed')),
  reference_id  text,
  occurred_at   timestamptz not null,
  local_date    date not null,
  created_at    timestamptz not null default now()
);
create index visits_business_time_idx on visits (business_id, occurred_at);
create index visits_membership_time_idx on visits (membership_id, occurred_at desc);

create table rewards (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses (id) on delete cascade,
  programme_id       uuid references loyalty_programmes (id) on delete restrict,
  name               text not null check (length(name) between 1 and 80),
  description        text,
  reward_type        text not null check (reward_type in ('free_item', 'discount', 'free_upgrade', 'custom')),
  icon               text not null default 'coffee',
  image_upload_id    uuid references uploads (id) on delete set null,
  points_cost        integer check (points_cost > 0),
  stamps_cost        integer check (stamps_cost > 0),
  configuration      jsonb not null default '{}'::jsonb,
  validity_days      integer check (validity_days between 1 and 730),
  start_date         date,
  end_date           date,
  per_customer_limit integer check (per_customer_limit > 0),
  total_limit        integer check (total_limit > 0),
  terms              text,
  is_card_reward     boolean not null default false,
  status             text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (points_cost is null or stamps_cost is null),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index rewards_business_idx on rewards (business_id, status);

-- A reward issued to a specific member: a filled stamp card, a campaign gift,
-- a challenge prize, a referral bonus, or a points purchase (redeemed at once).
create table customer_rewards (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses (id) on delete cascade,
  membership_id uuid not null references loyalty_memberships (id) on delete cascade,
  reward_id     uuid not null references rewards (id) on delete restrict,
  source        text not null check (source in ('stamp_card', 'campaign', 'challenge', 'referral', 'points', 'manual')),
  source_ref_id uuid,
  operation_id  uuid references loyalty_operations (id) on delete set null,
  status        text not null default 'available' check (status in ('available', 'redeemed', 'expired', 'void')),
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz,
  redeemed_at   timestamptz,
  voided_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index customer_rewards_membership_idx on customer_rewards (membership_id, status);
create index customer_rewards_business_issued_idx on customer_rewards (business_id, issued_at);

create table reward_redemptions (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses (id) on delete cascade,
  membership_id      uuid not null references loyalty_memberships (id) on delete cascade,
  reward_id          uuid not null references rewards (id) on delete restrict,
  customer_reward_id uuid not null unique references customer_rewards (id) on delete cascade,
  programme_id       uuid references loyalty_programmes (id) on delete set null,
  points_spent       integer not null default 0 check (points_spent >= 0),
  stamps_spent       integer not null default 0 check (stamps_spent >= 0),
  status             text not null default 'completed' check (status in ('completed', 'reversed')),
  redemption_code    text not null unique,
  operation_id       uuid references loyalty_operations (id) on delete set null,
  redeemed_by        uuid references users (id) on delete set null,
  redeemed_at        timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
create index reward_redemptions_business_time_idx on reward_redemptions (business_id, redeemed_at);

create table loyalty_transactions (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references businesses (id) on delete cascade,
  membership_id           uuid not null references loyalty_memberships (id) on delete cascade,
  programme_id            uuid references loyalty_programmes (id) on delete set null,
  operation_id            uuid references loyalty_operations (id) on delete set null,
  transaction_type        text not null check (transaction_type in (
                            'earn', 'bonus', 'card_completed', 'redeem', 'adjustment', 'reversal',
                            'voucher_void', 'welcome', 'referral', 'challenge', 'voucher_issued')),
  points_delta            integer not null default 0,
  stamps_delta            integer not null default 0,
  balance_after           integer,
  source                  text not null check (source in ('terminal', 'dashboard', 'campaign', 'challenge', 'referral', 'system', 'seed')),
  reference_id            text,
  purchase_amount_minor   bigint check (purchase_amount_minor >= 0),
  currency                text check (currency in ('EUR', 'TRY')),
  visit_id                uuid references visits (id) on delete set null,
  campaign_id             uuid,
  challenge_id            uuid,
  customer_reward_id      uuid references customer_rewards (id) on delete set null,
  redemption_id           uuid references reward_redemptions (id) on delete set null,
  reverses_transaction_id uuid unique references loyalty_transactions (id) on delete restrict,
  actor_user_id           uuid references users (id) on delete set null,
  description             text not null,
  created_at              timestamptz not null default now(),
  check (points_delta = 0 or stamps_delta = 0)
);
create index loyalty_transactions_business_time_idx on loyalty_transactions (business_id, created_at desc);
create index loyalty_transactions_membership_time_idx on loyalty_transactions (membership_id, created_at desc);
create index loyalty_transactions_operation_idx on loyalty_transactions (operation_id);
-- one purchase reference can earn credit only once per programme
create unique index loyalty_transactions_purchase_ref_key
  on loyalty_transactions (business_id, programme_id, reference_id)
  where transaction_type = 'earn' and reference_id is not null;

-- ---------------------------------------------------------------- challenges (visit streaks)
create table challenges (
  id                           uuid primary key default gen_random_uuid(),
  business_id                  uuid not null references businesses (id) on delete cascade,
  name                         text not null check (length(name) between 1 and 80),
  description                  text,
  rule_type                    text not null check (rule_type in ('distinct_days', 'visit_count')),
  required_count               integer not null check (required_count between 1 and 100),
  period                       text not null check (period in ('campaign', 'week', 'month')),
  start_date                   date not null,
  end_date                     date not null,
  reward_kind                  text not null check (reward_kind in ('voucher', 'bonus')),
  reward_id                    uuid references rewards (id) on delete restrict,
  bonus_programme_id           uuid references loyalty_programmes (id) on delete restrict,
  bonus_amount                 integer check (bonus_amount > 0),
  max_completions_per_customer integer not null default 1 check (max_completions_per_customer between 1 and 520),
  eligible_segment             text not null default 'all',
  visibility                   text not null default 'public' check (visibility in ('public', 'invite_only')),
  status                       text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  check (end_date >= start_date),
  check ((reward_kind = 'voucher' and reward_id is not null) or (reward_kind = 'bonus' and bonus_programme_id is not null and bonus_amount is not null))
);
create index challenges_business_idx on challenges (business_id, status);

create table challenge_enrolments (
  challenge_id  uuid not null references challenges (id) on delete cascade,
  membership_id uuid not null references loyalty_memberships (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (challenge_id, membership_id)
);

create table challenge_completions (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses (id) on delete cascade,
  challenge_id       uuid not null references challenges (id) on delete cascade,
  membership_id      uuid not null references loyalty_memberships (id) on delete cascade,
  period_key         text not null,
  operation_id       uuid references loyalty_operations (id) on delete set null,
  customer_reward_id uuid references customer_rewards (id) on delete set null,
  transaction_id     uuid references loyalty_transactions (id) on delete set null,
  completed_at       timestamptz not null default now(),
  unique (challenge_id, membership_id, period_key)
);

-- ---------------------------------------------------------------- campaigns & referrals
create table campaigns (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references businesses (id) on delete cascade,
  name                     text not null check (length(name) between 1 and 80),
  description              text,
  campaign_type            text not null check (campaign_type in ('welcome', 'bonus_points', 'limited_time', 'weekday', 'birthday', 'referral', 'win_back', 'custom')),
  status                   text not null default 'draft' check (status in ('draft', 'published', 'paused', 'completed')),
  start_date               date not null,
  end_date                 date,
  target_segment           text not null default 'all',
  benefit                  jsonb not null default '{"kind":"none"}'::jsonb,
  eligibility              jsonb not null default '{}'::jsonb,
  config                   jsonb not null default '{}'::jsonb,
  usage_limit_per_customer integer check (usage_limit_per_customer > 0),
  total_limit              integer check (total_limit > 0),
  redemption_instructions  text,
  is_public                boolean not null default true,
  published_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index campaigns_business_idx on campaigns (business_id, status);

create table campaign_events (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses (id) on delete cascade,
  campaign_id   uuid not null references campaigns (id) on delete cascade,
  membership_id uuid references loyalty_memberships (id) on delete cascade,
  customer_id   uuid references customers (id) on delete set null,
  event_type    text not null check (event_type in ('voucher_issued', 'bonus_awarded', 'viewed', 'redeemed', 'referral_qualified')),
  dedupe_key    text not null,
  operation_id  uuid references loyalty_operations (id) on delete set null,
  event_data    jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (campaign_id, membership_id, event_type, dedupe_key)
);
create index campaign_events_campaign_idx on campaign_events (campaign_id, event_type);

create table referrals (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references businesses (id) on delete cascade,
  campaign_id            uuid references campaigns (id) on delete set null,
  referrer_membership_id uuid not null references loyalty_memberships (id) on delete cascade,
  referred_membership_id uuid not null unique references loyalty_memberships (id) on delete cascade,
  referral_code          text not null,
  status                 text not null default 'pending' check (status in ('pending', 'qualified', 'rejected')),
  rejection_reason       text,
  qualifying_operation_id uuid references loyalty_operations (id) on delete set null,
  qualified_at           timestamptz,
  created_at             timestamptz not null default now(),
  check (referrer_membership_id <> referred_membership_id)
);
create index referrals_business_idx on referrals (business_id, status);
create index referrals_referrer_idx on referrals (referrer_membership_id);

-- Counter-added customers can attach their membership to a self-service account
-- with a one-time claim link generated by the café.
create table membership_claims (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses (id) on delete cascade,
  membership_id uuid not null references loyalty_memberships (id) on delete cascade,
  token_hash    text not null unique,
  created_by    uuid references users (id) on delete set null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- platform
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references businesses (id) on delete cascade,
  actor_user_id uuid references users (id) on delete set null,
  action        text not null,
  target_type   text,
  target_id     text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_business_time_idx on audit_logs (business_id, created_at desc);

create table error_logs (
  id         uuid primary key default gen_random_uuid(),
  level      text not null default 'error',
  message    text not null,
  path       text,
  method     text,
  error_code text,
  stack      text,
  created_at timestamptz not null default now()
);
create index error_logs_time_idx on error_logs (created_at desc);

create table demo_requests (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('demo', 'contact')),
  name        text not null,
  email       text not null,
  cafe_name   text,
  city        text,
  phone       text,
  message     text,
  status      text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at  timestamptz not null default now()
);

create table rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);
create index rate_limits_window_idx on rate_limits (window_start);
