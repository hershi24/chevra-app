-- Payments marked between members, and private bank details for transfers.
alter table public.expense_ledger
  add column if not exists payments jsonb not null default '[]'::jsonb;

create table if not exists public.member_bank_accounts (
  member_id text primary key references public.members(id) on delete cascade,
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- No policies: only the server (service role) reads or writes bank details.
alter table public.member_bank_accounts enable row level security;
