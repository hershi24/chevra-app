create table if not exists public.site_activity (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

alter table public.site_activity enable row level security;

insert into public.site_activity (id) values (1) on conflict do nothing;
