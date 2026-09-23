-- Metadata for files stored in Cloudflare R2.
-- gathering_id is plain text (no FK) because gatherings still live in the app store.

create table if not exists public.media_files (
  id text primary key,
  url text not null,
  type public.media_type not null,
  name text,
  size bigint,
  gathering_id text,
  uploaded_by text references public.members(id),
  created_at timestamptz not null default now()
);

alter table public.media_files enable row level security;

drop policy if exists "media files readable" on public.media_files;
create policy "media files readable" on public.media_files for select using (true);
