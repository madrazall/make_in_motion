-- Restores the default table/sequence/function grants Supabase normally sets
-- up automatically on a new project. This project is missing them entirely —
-- that's why every query comes back "permission denied," even from the
-- service_role key, which should never be blocked by RLS or grants.
--
-- Safe to run any time; grants are additive and idempotent.

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all functions in schema public to postgres, service_role;

-- anon/authenticated still gated by the RLS policies already in the schema —
-- this just lets Postgres evaluate those policies instead of refusing outright.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- So the same thing doesn't happen again the next time a table/function is added.
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
