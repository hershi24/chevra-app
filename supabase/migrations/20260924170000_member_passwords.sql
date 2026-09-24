alter table public.members
  add column if not exists password_hash text,
  add column if not exists must_change_password boolean not null default true;
