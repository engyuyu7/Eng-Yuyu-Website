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
