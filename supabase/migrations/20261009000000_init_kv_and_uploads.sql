-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- One table holds all the site's data. Only the server (with the service key) can read or write it.
create table if not exists public.kv (
  name text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row level security ON with no policies = the public/anon key can do nothing.
alter table public.kv enable row level security;
revoke all on public.kv from anon, authenticated;

-- Storage bucket for pictures and ad videos (public so visitors can see them).
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;
