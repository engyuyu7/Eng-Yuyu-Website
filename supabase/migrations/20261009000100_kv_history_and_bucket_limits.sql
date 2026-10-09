-- Keeps previous versions of each saved collection so a bad save can be rolled back.
create table if not exists public.kv_history (
  id bigint generated always as identity primary key,
  name text not null,
  data jsonb not null,
  saved_at timestamptz not null default now()
);
create index if not exists kv_history_name_saved_idx on public.kv_history (name, saved_at desc);
alter table public.kv_history enable row level security;
revoke all on public.kv_history from anon, authenticated;

create or replace function public.kv_keep_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- big, low-value collections are not versioned
  if old.name in ('analytics') then
    return new;
  end if;
  -- at most one snapshot per collection every 10 minutes
  if not exists (
    select 1 from public.kv_history h
    where h.name = old.name and h.saved_at > now() - interval '10 minutes'
  ) then
    insert into public.kv_history (name, data, saved_at) values (old.name, old.data, now());
    -- keep the newest 100 versions per collection
    delete from public.kv_history h
    where h.name = old.name
      and h.id not in (
        select id from public.kv_history where name = old.name order by saved_at desc, id desc limit 100
      );
  end if;
  return new;
end;
$$;
revoke all on function public.kv_keep_history() from public, anon, authenticated;

drop trigger if exists kv_history_trg on public.kv;
create trigger kv_history_trg
before update on public.kv
for each row execute function public.kv_keep_history();

-- Uploads bucket: 15 MB per file, only the picture and video types the site uses.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml','video/mp4','video/webm']
where id = 'uploads';
