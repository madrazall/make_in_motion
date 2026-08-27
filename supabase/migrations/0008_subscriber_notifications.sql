-- Tracks which subscribers have already been emailed about which event, so
-- clicking "Notify subscribers" a second time (a re-publish, a typo fix,
-- just double-checking) only reaches whoever hasn't heard yet.

create table subscriber_notifications (
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  event_id      uuid not null references events(id) on delete cascade,
  notified_at   timestamptz not null default now(),
  primary key (subscriber_id, event_id)
);

alter table subscriber_notifications enable row level security;
-- Service-role only, by omission — same as subscribers itself.
