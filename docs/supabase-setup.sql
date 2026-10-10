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

-- ---- version history and bucket limits (same as supabase/migrations/20261009000100) ----
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

-- ---- readable reports views (same as supabase/migrations/20261009000200) ----
-- Read-only, human-friendly views over the kv collections. Private: not exposed through the public API.
create schema if not exists reports;
revoke all on schema reports from public, anon, authenticated;

create or replace view reports.bookings with (security_invoker = true) as
select o.key as id,
       o.value->>'session' as session,
       o.value->>'name' as client_name,
       o.value->>'email' as client_email,
       o.value->>'lang' as lang,
       nullif(o.value->>'amount','')::numeric as amount,
       o.value->>'status' as status,
       to_timestamp(nullif(o.value->>'start','')::numeric / 1000) as session_start,
       to_timestamp(nullif(o.value->>'createdAt','')::numeric / 1000) as created_at,
       o.value->>'note' as note
from public.kv k, jsonb_each(case when jsonb_typeof(k.data) = 'object' then k.data else '{}'::jsonb end) o
where k.name = 'orders';

create or replace view reports.bookings_by_status with (security_invoker = true) as
select status, count(*) as bookings, coalesce(sum(amount), 0) as total_amount
from reports.bookings group by status order by bookings desc;

create or replace view reports.blog_posts with (security_invoker = true) as
select p->>'id' as id, p->>'slug' as slug, p->>'status' as status, p->>'cat' as category,
       p#>>'{en,title}' as title_en, p#>>'{so,title}' as title_so,
       coalesce(nullif(p->>'views','')::int, 0) as views,
       coalesce(p->>'authorName', 'Eng Yuyu') as author,
       p#>>'{review,state}' as review_state,
       coalesce((p->>'featured')::boolean, false) as featured,
       to_timestamp(nullif(p->>'publishedAt','')::numeric / 1000) as published_at,
       to_timestamp(nullif(p->>'updatedAt','')::numeric / 1000) as updated_at
from public.kv k, jsonb_array_elements(coalesce(k.data->'posts', '[]'::jsonb)) p
where k.name = 'blog';

create or replace view reports.blog_comments with (security_invoker = true) as
select c->>'id' as id, c->>'postId' as post_id, c->>'name' as author_name, c->>'email' as email,
       c->>'text' as comment, c->>'status' as status,
       to_timestamp(nullif(c->>'createdAt','')::numeric / 1000) as created_at
from public.kv k, jsonb_array_elements(coalesce(k.data->'comments', '[]'::jsonb)) c
where k.name = 'blog';

create or replace view reports.subscribers with (security_invoker = true) as
select s->>'id' as id, s->>'email' as email, s->>'lang' as lang, s->>'source' as source,
       coalesce((s->>'unsubscribed')::boolean, false) as unsubscribed,
       to_timestamp(nullif(s->>'createdAt','')::numeric / 1000) as subscribed_at
from public.kv k, jsonb_array_elements(case when jsonb_typeof(k.data) = 'array' then k.data else '[]'::jsonb end) s
where k.name = 'subscribers';

create or replace view reports.messages with (security_invoker = true) as
select m->>'id' as id, m->>'name' as sender, m->>'email' as email, m->>'type' as type,
       m->>'message' as message, coalesce((m->>'read')::boolean, false) as is_read,
       to_timestamp(nullif(m->>'createdAt','')::numeric / 1000) as received_at
from public.kv k, jsonb_array_elements(case when jsonb_typeof(k.data) = 'array' then k.data else '[]'::jsonb end) m
where k.name = 'messages';

create or replace view reports.events with (security_invoker = true) as
select e->>'id' as id, e->'en'->>0 as title_en, e->'so'->>0 as title_so, e->>'type' as type,
       e->>'place' as place, nullif(e->>'date','')::date as event_date,
       coalesce((e->>'feature')::boolean, false) as featured
from public.kv k, jsonb_array_elements(coalesce(k.data->'events', '[]'::jsonb)) e
where k.name = 'content';

create or replace view reports.writers with (security_invoker = true) as
select a->>'id' as id, a->>'name' as name, a->>'email' as email, a->>'status' as status,
       coalesce((a->>'trusted')::boolean, false) as trusted,
       to_timestamp(nullif(a->>'lastLogin','')::numeric / 1000) as last_login
from public.kv k, jsonb_array_elements(case when jsonb_typeof(k.data) = 'array' then k.data else '[]'::jsonb end) a
where k.name = 'authors';

create or replace view reports.activity_log with (security_invoker = true) as
select to_timestamp(nullif(a->>'t','')::numeric / 1000) as at, a->>'type' as type, a->>'text' as text
from public.kv k, jsonb_array_elements(case when jsonb_typeof(k.data) = 'array' then k.data else '[]'::jsonb end) a
where k.name = 'activity'
order by 1 desc;

revoke all on all tables in schema reports from public, anon, authenticated;
grant usage on schema reports to service_role;
grant select on all tables in schema reports to service_role;

-- ---- real tables that mirror the data (same as supabase/migrations/20261009000300) ----
-- Real tables that mirror the site's data. The website keeps saving into public.kv; a trigger copies each change here.
-- These tables are READ-ONLY copies: edit data in the dashboard, not here (edits here are overwritten on the next save).

create table if not exists public.bookings (
  id text primary key, session text, client_name text, client_email text, lang text,
  amount numeric, status text, session_start timestamptz, created_at timestamptz, note text
);
create table if not exists public.blog_posts (
  id text primary key, slug text, status text, category text, title_en text, title_so text,
  views int, author text, review_state text, featured boolean, published_at timestamptz, updated_at timestamptz
);
create table if not exists public.blog_comments (
  id text primary key, post_id text, author_name text, email text, comment text, status text, created_at timestamptz
);
create table if not exists public.subscribers (
  id text primary key, email text, lang text, source text, unsubscribed boolean, subscribed_at timestamptz
);
create table if not exists public.messages (
  id text primary key, sender text, email text, type text, message text, is_read boolean, received_at timestamptz
);
create table if not exists public.events (
  id text primary key, title_en text, title_so text, type text, place text, event_date date, featured boolean
);
create table if not exists public.writers (
  id text primary key, name text, email text, status text, trusted boolean, last_login timestamptz
);
create table if not exists public.activity_log (
  id bigint generated always as identity primary key, at timestamptz, type text, text text
);

create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_created_idx on public.bookings (created_at desc);
create index if not exists blog_posts_status_idx on public.blog_posts (status, published_at desc);
create index if not exists blog_comments_post_idx on public.blog_comments (post_id);
create index if not exists subscribers_email_idx on public.subscribers (lower(email));
create index if not exists activity_log_at_idx on public.activity_log (at desc);

do $$
declare t text;
begin
  foreach t in array array['bookings','blog_posts','blog_comments','subscribers','messages','events','writers','activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create or replace function public.sync_kv_tables()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare nm text; d jsonb;
begin
  if tg_op = 'DELETE' then nm := old.name; d := '{}'::jsonb; else nm := new.name; d := new.data; end if;
  -- a problem while copying must never block the website from saving its data
  begin
    if nm = 'orders' then
      delete from public.bookings;
      insert into public.bookings (id, session, client_name, client_email, lang, amount, status, session_start, created_at, note)
      select o.key, o.value->>'session', o.value->>'name', o.value->>'email', o.value->>'lang',
             nullif(o.value->>'amount','')::numeric, o.value->>'status',
             to_timestamp(nullif(o.value->>'start','')::numeric / 1000),
             to_timestamp(nullif(o.value->>'createdAt','')::numeric / 1000), o.value->>'note'
      from jsonb_each(case when jsonb_typeof(d) = 'object' then d else '{}'::jsonb end) o
      on conflict (id) do nothing;
    elsif nm = 'blog' then
      delete from public.blog_posts;
      insert into public.blog_posts (id, slug, status, category, title_en, title_so, views, author, review_state, featured, published_at, updated_at)
      select p->>'id', p->>'slug', p->>'status', p->>'cat', p#>>'{en,title}', p#>>'{so,title}',
             coalesce(nullif(p->>'views','')::int, 0), coalesce(p->>'authorName', 'Eng Yuyu'), p#>>'{review,state}',
             coalesce((p->>'featured')::boolean, false),
             to_timestamp(nullif(p->>'publishedAt','')::numeric / 1000), to_timestamp(nullif(p->>'updatedAt','')::numeric / 1000)
      from jsonb_array_elements(case when jsonb_typeof(d->'posts') = 'array' then d->'posts' else '[]'::jsonb end) p
      on conflict (id) do nothing;
      delete from public.blog_comments;
      insert into public.blog_comments (id, post_id, author_name, email, comment, status, created_at)
      select c->>'id', c->>'postId', c->>'name', c->>'email', c->>'text', c->>'status',
             to_timestamp(nullif(c->>'createdAt','')::numeric / 1000)
      from jsonb_array_elements(case when jsonb_typeof(d->'comments') = 'array' then d->'comments' else '[]'::jsonb end) c
      on conflict (id) do nothing;
    elsif nm = 'subscribers' then
      delete from public.subscribers;
      insert into public.subscribers (id, email, lang, source, unsubscribed, subscribed_at)
      select s->>'id', s->>'email', s->>'lang', s->>'source', coalesce((s->>'unsubscribed')::boolean, false),
             to_timestamp(nullif(s->>'createdAt','')::numeric / 1000)
      from jsonb_array_elements(case when jsonb_typeof(d) = 'array' then d else '[]'::jsonb end) s
      on conflict (id) do nothing;
    elsif nm = 'messages' then
      delete from public.messages;
      insert into public.messages (id, sender, email, type, message, is_read, received_at)
      select m->>'id', m->>'name', m->>'email', m->>'type', m->>'message', coalesce((m->>'read')::boolean, false),
             to_timestamp(nullif(m->>'createdAt','')::numeric / 1000)
      from jsonb_array_elements(case when jsonb_typeof(d) = 'array' then d else '[]'::jsonb end) m
      on conflict (id) do nothing;
    elsif nm = 'content' then
      delete from public.events;
      insert into public.events (id, title_en, title_so, type, place, event_date, featured)
      select e->>'id', e->'en'->>0, e->'so'->>0, e->>'type', e->>'place', nullif(e->>'date','')::date,
             coalesce((e->>'feature')::boolean, false)
      from jsonb_array_elements(case when jsonb_typeof(d->'events') = 'array' then d->'events' else '[]'::jsonb end) e
      on conflict (id) do nothing;
    elsif nm = 'authors' then
      delete from public.writers;
      insert into public.writers (id, name, email, status, trusted, last_login)
      select a->>'id', a->>'name', a->>'email', a->>'status', coalesce((a->>'trusted')::boolean, false),
             to_timestamp(nullif(a->>'lastLogin','')::numeric / 1000)
      from jsonb_array_elements(case when jsonb_typeof(d) = 'array' then d else '[]'::jsonb end) a
      on conflict (id) do nothing;
    elsif nm = 'activity' then
      delete from public.activity_log;
      insert into public.activity_log (at, type, text)
      select to_timestamp(nullif(a->>'t','')::numeric / 1000), a->>'type', a->>'text'
      from jsonb_array_elements(case when jsonb_typeof(d) = 'array' then d else '[]'::jsonb end) a;
    end if;
  exception when others then
    raise warning 'sync_kv_tables(%): %', nm, sqlerrm;
  end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.sync_kv_tables() from public, anon, authenticated;

drop trigger if exists kv_sync_trg on public.kv;
create trigger kv_sync_trg
after insert or update or delete on public.kv
for each row execute function public.sync_kv_tables();

-- copy whatever is already in kv
update public.kv set data = data;

-- ---- more mirror tables: settings, sessions, visitors, audience, partners, media, ads (same as supabase/migrations/20261010000400) ----
-- More read-only mirror tables, kept in sync from public.kv (settings, analytics, stats, content). Edit data in the dashboard, not here.
create table if not exists public.site_settings (key text primary key, value jsonb);
create table if not exists public.consulting_sessions (id text primary key, slug text, name_en text, name_so text, minutes int, price numeric, enabled boolean, service text, position int);
create table if not exists public.page_views_daily (day date primary key, page_views int, visitors int, pages jsonb, referrers jsonb, languages jsonb, devices jsonb, events jsonb);
create table if not exists public.audience_stats (metric text primary key, value bigint, source text, updated_at timestamptz);
create table if not exists public.partners (id bigint generated always as identity primary key, position int, name text, logo text, url text);
create table if not exists public.testimonials (id text primary key, name text, role text, text_en text, text_so text);
create table if not exists public.media_items (id text primary key, kind text, outlet text, url text, title_en text, title_so text, published_on date);
create table if not exists public.partner_ads (id text primary key, enabled boolean, partner text, title_en text, title_so text, url text, theme text);
create table if not exists public.proof_points (id text primary key, metric text, title_en text, title_so text);
create table if not exists public.community_links (id bigint generated always as identity primary key, position int, name text, icon text, text_en text, text_so text, href text);

do $$
declare t text;
begin
  foreach t in array array['site_settings','consulting_sessions','page_views_daily','audience_stats','partners','testimonials','media_items','partner_ads','proof_points','community_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create or replace function public.sync_kv_extra_for(nm text, d jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nm = 'settings' then
    delete from public.site_settings;
    insert into public.site_settings (key, value)
    select e.key, e.value from jsonb_each(case when jsonb_typeof(d) = 'object' then d else '{}'::jsonb end) e;
    delete from public.consulting_sessions;
    insert into public.consulting_sessions (id, slug, name_en, name_so, minutes, price, enabled, service, position)
    select s->>'id', s->>'slug', s->'en'->>0, s->'so'->>0, nullif(s->>'min','')::int, nullif(s->>'price','')::numeric,
           coalesce((s->>'enabled')::boolean, true), s->>'service', (o - 1)::int
    from jsonb_array_elements(case when jsonb_typeof(d->'sessionList') = 'array' then d->'sessionList' else '[]'::jsonb end) with ordinality as t(s, o)
    on conflict (id) do nothing;
  elsif nm = 'analytics' then
    delete from public.page_views_daily;
    insert into public.page_views_daily (day, page_views, visitors, pages, referrers, languages, devices, events)
    select e.key::date, nullif(e.value->>'pv','')::int,
           coalesce(jsonb_array_length(case when jsonb_typeof(e.value->'vis') = 'array' then e.value->'vis' else '[]'::jsonb end), 0),
           e.value->'pages', e.value->'refs', e.value->'langs', e.value->'dev', e.value->'ev'
    from jsonb_each(case when jsonb_typeof(d->'days') = 'object' then d->'days' else '{}'::jsonb end) e
    on conflict (day) do nothing;
  elsif nm = 'stats' then
    delete from public.audience_stats;
    insert into public.audience_stats (metric, value, source, updated_at)
    select e.key, nullif(e.value,'')::bigint, d->>'source', to_timestamp(nullif(d->>'updatedAt','')::numeric / 1000)
    from jsonb_each_text(case when jsonb_typeof(d->'current') = 'object' then d->'current' else '{}'::jsonb end) e;
  elsif nm = 'content' then
    delete from public.partners;
    insert into public.partners (position, name, logo, url)
    select (o - 1)::int, case when jsonb_typeof(p) = 'string' then p #>> '{}' else p->>'name' end,
           case when jsonb_typeof(p) = 'object' then p->>'logo' end, case when jsonb_typeof(p) = 'object' then p->>'url' end
    from jsonb_array_elements(case when jsonb_typeof(d->'partners') = 'array' then d->'partners' else '[]'::jsonb end) with ordinality as t(p, o);
    delete from public.testimonials;
    insert into public.testimonials (id, name, role, text_en, text_so)
    select x->>'id', x->>'name', x->>'role', x->>'en', x->>'so'
    from jsonb_array_elements(case when jsonb_typeof(d->'testimonials') = 'array' then d->'testimonials' else '[]'::jsonb end) x on conflict (id) do nothing;
    delete from public.media_items;
    insert into public.media_items (id, kind, outlet, url, title_en, title_so, published_on)
    select x->>'id', x->>'kind', x->>'outlet', x->>'url', x->>'en', x->>'so', nullif(x->>'date','')::date
    from jsonb_array_elements(case when jsonb_typeof(d->'media') = 'array' then d->'media' else '[]'::jsonb end) x on conflict (id) do nothing;
    delete from public.partner_ads;
    insert into public.partner_ads (id, enabled, partner, title_en, title_so, url, theme)
    select x->>'id', coalesce((x->>'enabled')::boolean, true), x->>'partner', x->'en'->>0, x->'so'->>0, x->>'url', x->>'theme'
    from jsonb_array_elements(case when jsonb_typeof(d->'ads') = 'array' then d->'ads' else '[]'::jsonb end) x on conflict (id) do nothing;
    delete from public.proof_points;
    insert into public.proof_points (id, metric, title_en, title_so)
    select x->>'id', x->>'metric', x->'en'->>0, x->'so'->>0
    from jsonb_array_elements(case when jsonb_typeof(d->'proof') = 'array' then d->'proof' else '[]'::jsonb end) x on conflict (id) do nothing;
    delete from public.community_links;
    insert into public.community_links (position, name, icon, text_en, text_so, href)
    select (o - 1)::int, x->>'name', x->>'icon', x->>'en', x->>'so', x->>'href'
    from jsonb_array_elements(case when jsonb_typeof(d->'community') = 'array' then d->'community' else '[]'::jsonb end) with ordinality as t(x, o);
  end if;
end;
$$;
revoke all on function public.sync_kv_extra_for(text, jsonb) from public, anon, authenticated;

create or replace function public.sync_kv_extra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare nm text;
begin
  nm := case when tg_op = 'DELETE' then old.name else new.name end;
  -- a problem while copying must never block the website from saving its data
  begin
    perform public.sync_kv_extra_for(nm, case when tg_op = 'DELETE' then '{}'::jsonb else new.data end);
  exception when others then
    raise warning 'sync_kv_extra(%): %', nm, sqlerrm;
  end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.sync_kv_extra() from public, anon, authenticated;

drop trigger if exists kv_sync_extra_trg on public.kv;
create trigger kv_sync_extra_trg
after insert or update or delete on public.kv
for each row execute function public.sync_kv_extra();

-- copy whatever is already saved
do $$
declare r record;
begin
  for r in select name, data from public.kv where name in ('settings','analytics','stats','content') loop
    begin
      perform public.sync_kv_extra_for(r.name, r.data);
    exception when others then
      raise warning 'backfill(%): %', r.name, sqlerrm;
    end;
  end loop;
end $$;
