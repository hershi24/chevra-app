-- מיין חברה · schema for Supabase (Postgres + Realtime + Storage)
-- Run in the SQL editor after creating a project. The app works without
-- this while NEXT_PUBLIC_SUPABASE_URL is unset (local JSON store).

create extension if not exists "pgcrypto";

create type public.member_role as enum ('admin', 'leader', 'member');
create type public.rsvp_status as enum ('yes', 'no', 'maybe', 'pending');
create type public.media_type as enum ('image', 'video', 'audio', 'file');
create type public.channel_type as enum ('group', 'dm', 'announcements');
create type public.gathering_status as enum ('upcoming', 'past', 'cancelled');

create table public.members (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text not null,
  role public.member_role not null default 'member',
  phone text,
  email text,
  avatar_color text not null default '#0F766E',
  initials text not null,
  created_at timestamptz not null default now()
);

create table public.gatherings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  location text not null,
  host_id uuid references public.members(id),
  kibud_id uuid references public.members(id),
  lecturer_id uuid references public.members(id),
  topic text,
  notes text,
  summary text,
  audio_url text,
  status public.gathering_status not null default 'upcoming',
  created_at timestamptz not null default now()
);

create table public.rsvps (
  gathering_id uuid references public.gatherings(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  status public.rsvp_status not null default 'pending',
  updated_at timestamptz not null default now(),
  primary key (gathering_id, member_id)
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  gathering_id uuid references public.gatherings(id) on delete cascade,
  type public.media_type not null,
  url text not null,
  caption text,
  uploaded_by uuid references public.members(id),
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.channel_type not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.channel_members (
  channel_id uuid references public.channels(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  primary key (channel_id, member_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  author_id uuid references public.members(id),
  text text not null default '',
  quote jsonb,
  attachments jsonb not null default '[]'::jsonb,
  voice_url text,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.message_reactions (
  message_id uuid references public.messages(id) on delete cascade,
  emoji text not null,
  member_id uuid references public.members(id) on delete cascade,
  primary key (message_id, emoji, member_id)
);

create table public.rsvp_tokens (
  token text primary key,
  gathering_id uuid references public.gatherings(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  unique (gathering_id, member_id)
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  group_name text not null default 'מיין חברה',
  background_image_id uuid,
  backgrounds jsonb not null default '[]'::jsonb
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  gathering_id uuid references public.gatherings(id),
  sent_at timestamptz not null default now(),
  recipients text[] not null,
  subject text not null
);

create table public.ivr_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  phone text not null,
  action text not null,
  member_id uuid references public.members(id),
  gathering_id uuid references public.gatherings(id),
  result text not null
);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.rsvps;
alter publication supabase_realtime add table public.gatherings;

alter table public.members enable row level security;
alter table public.gatherings enable row level security;
alter table public.rsvps enable row level security;
alter table public.media enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.rsvp_tokens enable row level security;
alter table public.settings enable row level security;
alter table public.email_log enable row level security;
alter table public.ivr_log enable row level security;

-- Simple policies: members of the chevra can read; writes are scoped by role.
-- Swap `auth.uid()` for your mapped member id when wiring real Supabase Auth.

create policy "members readable" on public.members for select using (true);
create policy "gatherings readable" on public.gatherings for select using (true);
create policy "rsvps readable" on public.rsvps for select using (true);
create policy "media readable" on public.media for select using (true);
create policy "channels readable" on public.channels for select using (true);
create policy "messages readable" on public.messages for select using (true);
create policy "settings readable" on public.settings for select using (true);

insert into public.settings (id) values (1) on conflict do nothing;

-- Storage buckets (run in dashboard or via API):
--   chevra-media  (public read, authenticated write) for photos/videos/voice
-- Enable image/video streaming via public URLs; do not force downloads.
