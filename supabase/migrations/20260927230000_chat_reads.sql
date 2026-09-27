create table if not exists public.chat_reads (
  member_id text not null references public.members(id) on delete cascade,
  channel_id text not null,
  read_at timestamptz not null default now(),
  primary key (member_id, channel_id)
);

alter table public.chat_reads enable row level security;
