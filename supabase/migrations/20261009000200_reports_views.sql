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
