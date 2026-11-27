-- 005: the plan a café preview is offered on (shown with its price; the free trial starts on it).
alter table businesses add column if not exists preview_plan_id text references plans (id) on delete set null;
