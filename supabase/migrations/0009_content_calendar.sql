-- Content calendar: a private planning tool, not a publisher. Nothing here
-- ever posts anywhere on its own — it's just where a post idea lives between
-- "thought of it" and "actually posted it by hand."

create table content_posts (
  id             uuid primary key default gen_random_uuid(),
  platform       text not null check (platform in ('instagram', 'email')),
  status         text not null default 'idea'
                   check (status in ('idea', 'drafted', 'scheduled', 'posted')),
  scheduled_date date not null,
  caption        text not null default '',
  image_url      text,
  notes          text,
  -- Optional — a post doesn't have to be about a specific event. Set null
  -- (not cascaded) if the event gets deleted, so the post idea survives it.
  event_id       uuid references events(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index content_posts_date_idx on content_posts (scheduled_date);

create trigger content_posts_touch before update on content_posts
  for each row execute function touch_updated_at();

alter table content_posts enable row level security;
-- Service-role only, by omission — same as everything else admin-only.
