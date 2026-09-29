-- Per-member choice of which chat messages also arrive by email.
create table if not exists public.member_chat_email_prefs (
  member_id text primary key references public.members(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- No policies: only the server (service role) reads or writes these.
alter table public.member_chat_email_prefs enable row level security;
