# Supabase

`migrations/` holds the database changes for this project, oldest first. The first one creates the `kv` table (all of the site's data) and the public `uploads` storage bucket. It is safe to run more than once.

The website itself connects with `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (set on the server, never in Git). This folder is only used when the project is linked to GitHub under Supabase > Project Settings > Integrations > GitHub.
