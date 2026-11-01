-- 002: two plans (Basic, Premium), café branding (banner, layout, stamp icon), café directory opt-out,
--      and read-tracking for contact messages.

-- ---------------------------------------------------------------- plans
insert into plans (id, name, description, monthly_price_minor, currency, feature_configuration, is_recommended, sort_order, status)
values ('basic', 'Basic', 'A digital stamp card with rewards and referrals.', 900, 'EUR', '{"features": {"stamps": true, "referrals": true, "csvExport": true}, "limits": {"locations": 1, "programmes": 1, "staffSeats": 3, "activeCampaigns": 0}, "inheritsFrom": null, "highlights": ["Digital stamp card", "Rewards customers collect on their phone", "QR code to join, no app needed", "Bring-a-friend referral rewards", "Your own logo, colours and banner", "Customer list and visit reports", "Up to 3 staff accounts"], "highlightsTr": ["Dijital damga kartı", "Müşterilerin telefonda topladığı ödüller", "Katılım için QR kod, uygulama gerekmez", "Arkadaşını getir ödülleri", "Kendi logonuz, renkleriniz ve kapak görseliniz", "Müşteri listesi ve ziyaret raporları", "3 personel hesabına kadar"]}'::jsonb, false, 1, 'active')
on conflict (id) do update set name = excluded.name, description = excluded.description, monthly_price_minor = excluded.monthly_price_minor,
  feature_configuration = excluded.feature_configuration, is_recommended = excluded.is_recommended, sort_order = excluded.sort_order, status = 'active', updated_at = now();

insert into plans (id, name, description, monthly_price_minor, currency, feature_configuration, is_recommended, sort_order, status)
values ('premium', 'Premium', 'Points, campaigns and insights to bring regulars back more often.', 1900, 'EUR', '{"features": {"stamps": true, "points": true, "challenges": true, "offers": true, "campaigns": true, "referrals": true, "segments": true, "inactiveReport": true, "advancedInsights": true, "flexibleCampaignRules": true, "automatedWinback": true, "advancedReports": true, "csvExport": true, "prioritySupport": true}, "limits": {"locations": 1, "programmes": 4, "staffSeats": 15, "activeCampaigns": 20}, "inheritsFrom": "Basic", "highlights": ["Points programme as well as stamps", "Campaigns and offers with your own names", "Happy-hour and day-of-week offers", "Visit challenges", "Customer groups and win-back offers", "Full analytics", "Up to 15 staff accounts", "Priority support"], "highlightsTr": ["Damganın yanında puan programı", "Kendi adlarınızla kampanyalar ve teklifler", "Saat ve gün bazlı teklifler", "Ziyaret görevleri", "Müşteri grupları ve geri kazanma teklifleri", "Tam analizler", "15 personel hesabına kadar", "Öncelikli destek"]}'::jsonb, true, 2, 'active')
on conflict (id) do update set name = excluded.name, description = excluded.description, monthly_price_minor = excluded.monthly_price_minor,
  feature_configuration = excluded.feature_configuration, is_recommended = excluded.is_recommended, sort_order = excluded.sort_order, status = 'active', updated_at = now();

update subscriptions set plan_id = 'basic', updated_at = now() where plan_id = 'starter';
update subscriptions set plan_id = 'premium', updated_at = now() where plan_id = 'growth';
update subscriptions set requested_plan_id = 'basic' where requested_plan_id = 'starter';
update subscriptions set requested_plan_id = 'premium' where requested_plan_id = 'growth';
update subscriptions set requested_plan_id = null where requested_plan_id = plan_id;
delete from plans where id in ('starter', 'growth');

-- ---------------------------------------------------------------- branding
alter table uploads drop constraint if exists uploads_purpose_check;
alter table uploads add constraint uploads_purpose_check check (purpose in ('logo', 'reward', 'banner'));
alter table uploads drop constraint if exists uploads_byte_size_check;
alter table uploads add constraint uploads_byte_size_check check (byte_size > 0 and byte_size <= 2097152);

alter table businesses add column if not exists banner_upload_id uuid references uploads (id) on delete set null;
alter table businesses add column if not exists list_in_directory boolean not null default true;

-- ---------------------------------------------------------------- messages
alter table demo_requests add column if not exists read_at timestamptz;
