alter table public.gatherings
  add column if not exists attended_ids text[] not null default '{}';
