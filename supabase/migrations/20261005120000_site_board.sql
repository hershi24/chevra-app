create table if not exists public.site_board (
  id int primary key default 1 check (id = 1),
  board jsonb not null default '{}'::jsonb
);

alter table public.site_board enable row level security;

insert into public.site_board (id) values (1) on conflict do nothing;
