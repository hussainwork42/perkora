-- 004: café previews for sales visits.
-- The platform admin builds a café's card (name, logo, colours, reward) before the owner signs up,
-- and shares a private link. The café stays in status 'preview' (hidden from the public list,
-- nobody can join) until the owner claims it with their own account.
alter table businesses drop constraint if exists businesses_status_check;
alter table businesses add constraint businesses_status_check check (status in ('preview', 'onboarding', 'active', 'suspended'));
alter table businesses add column if not exists preview_token text unique;
alter table businesses add column if not exists preview_created_by uuid references users (id) on delete set null;
alter table businesses add column if not exists claimed_at timestamptz;
alter table businesses add column if not exists claimed_by uuid references users (id) on delete set null;
create index if not exists businesses_preview_idx on businesses (created_at desc) where preview_token is not null;
