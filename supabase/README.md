# Supabase

`migrations/` holds the database changes for this project, oldest first. The first one creates the `kv` table (all of the site's data) and the public `uploads` storage bucket. It is safe to run more than once.

The website itself connects with `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (set on the server, never in Git). This folder is only used when the project is linked to GitHub under Supabase > Project Settings > Integrations > GitHub.

## Restoring an older version of a collection

Every saved collection keeps up to 100 older versions (at most one per 10 minutes) in `kv_history`. To look at them in the SQL Editor:

```sql
select id, name, saved_at from public.kv_history where name = 'orders' order by saved_at desc limit 20;
```

To put one back (replace 123 with the id, and stop the website first so it does not overwrite your change):

```sql
update public.kv set data = (select data from public.kv_history where id = 123), updated_at = now() where name = 'orders';
```

## Reading your data in Supabase (the `reports` views)

Your website keeps its data as documents in `kv`. The `reports` schema turns them into plain tables you can browse and query (read only):
`bookings`, `bookings_by_status`, `blog_posts`, `blog_comments`, `subscribers`, `messages`, `events`, `writers`, `activity_log`.

In the SQL Editor, for example: `select * from reports.bookings order by created_at desc;`
They are private. The public key cannot see them, and the website does not use them.

## The real tables (`public.bookings`, `blog_posts`, `blog_comments`, `subscribers`, `messages`, `events`, `writers`, `activity_log`)

These are normal tables you can browse in Supabase's Table Editor, filter, sort and export. They are **read-only copies**: every time the website saves, a trigger refreshes them from `kv`. Do not edit rows here (the next save overwrites them); change data in the dashboard instead. If a record has data the copy cannot read, the website still saves normally and only the copy skips that save (see Logs > Postgres for a warning). Blog post bodies are not copied, only the details (title, author, views, dates).

## More read-only tables

`site_settings`, `consulting_sessions`, `page_views_daily`, `audience_stats`, `partners`, `testimonials`, `media_items`, `partner_ads`, `proof_points` and `community_links` are copied from the site's settings, visitor stats, audience figures and content in the same way. Sensitive collections (the admin login, payment keys and the cookie secret) are never copied into tables; they stay only in `kv`.
