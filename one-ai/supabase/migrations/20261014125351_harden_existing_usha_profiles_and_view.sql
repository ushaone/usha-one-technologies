-- REVIEW CANDIDATE: apply to a synthetic staging copy first, never via automatic CI deploy.
-- Existing browser profile creation/deletion and role management must move to a trusted
-- administrative backend before production. No customer rows are modified here.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.profiles FROM authenticated;
-- Table revokes do not remove pre-existing column-level grants.
DO $$
DECLARE columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns
  FROM pg_attribute WHERE attrelid='public.profiles'::regclass
    AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON public.profiles FROM anon, authenticated, PUBLIC', columns);
  EXECUTE format('REVOKE SELECT (%s) ON public.profiles FROM anon, PUBLIC', columns);
END $$;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, email, phone) ON TABLE public.profiles TO authenticated;
-- Keep existing RLS scope: own profile, or known active staff; authorization fields
-- can only be managed by the trusted backend/operator, regardless of browser role.

ALTER VIEW public.product_signals SET (security_invoker = true);
REVOKE ALL PRIVILEGES ON TABLE public.product_signals FROM anon, PUBLIC;
-- Existing authenticated SELECT remains, now subject to underlying opportunities RLS.
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog;

-- Fail/rollback if unexpected inherited privileges would defeat the profile boundary.
DO $$
BEGIN
  IF has_column_privilege('authenticated','public.profiles','role','UPDATE')
    OR has_column_privilege('authenticated','public.profiles','is_active','UPDATE')
    OR has_column_privilege('authenticated','public.profiles','id','UPDATE')
    OR has_any_column_privilege('authenticated','public.profiles','INSERT')
    OR has_table_privilege('authenticated','public.profiles','DELETE')
    OR has_table_privilege('authenticated','public.profiles','TRUNCATE')
    OR has_any_column_privilege('anon','public.product_signals','SELECT') THEN
    RAISE EXCEPTION 'Unexpected inherited privileges: review role grants before proceeding';
  END IF;
END $$;
COMMIT;
