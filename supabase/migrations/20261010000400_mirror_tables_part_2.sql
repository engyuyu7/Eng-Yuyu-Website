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
