-- 003: replies to website messages, kept as a thread under each message.
create table if not exists message_replies (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references demo_requests (id) on delete cascade,
  author_user_id uuid references users (id) on delete set null,
  body           text not null check (length(body) between 1 and 5000),
  channel        text not null check (channel in ('email', 'email_app', 'whatsapp')),
  status         text not null check (status in ('sent', 'failed', 'opened')),
  error          text,
  created_at     timestamptz not null default now()
);
create index if not exists message_replies_request_idx on message_replies (request_id, created_at);
