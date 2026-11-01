create table if not exists public.site_kibud (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

alter table public.site_kibud enable row level security;

insert into public.site_kibud (id) values (1) on conflict do nothing;
