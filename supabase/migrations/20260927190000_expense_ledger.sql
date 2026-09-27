create table if not exists public.expense_ledger (
  id int primary key default 1 check (id = 1),
  visible boolean not null default true,
  items jsonb not null default '[]'::jsonb
);

alter table public.expense_ledger enable row level security;

drop policy if exists "expense ledger readable" on public.expense_ledger;
create policy "expense ledger readable" on public.expense_ledger for select using (true);

insert into public.expense_ledger (id) values (1) on conflict do nothing;
