-- READ ONLY. Run in the existing Supabase project's SQL Editor and export results.
-- No customer rows, passwords, API keys, auth.users rows, writes or schema changes.
SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('profiles','businesses','contacts','leads','opportunities','activity_log')
ORDER BY table_name,ordinal_position;
SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('profiles','businesses','contacts','leads','opportunities','activity_log')
ORDER BY tablename,policyname;
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('profiles','businesses','contacts','leads','opportunities','activity_log');
