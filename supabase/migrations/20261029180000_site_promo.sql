create table if not exists public.site_promo (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

alter table public.site_promo enable row level security;

insert into public.site_promo (id) values (1) on conflict do nothing;
