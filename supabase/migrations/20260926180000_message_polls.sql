alter table public.messages
  add column if not exists poll jsonb;
