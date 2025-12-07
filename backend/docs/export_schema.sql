-- Export all PostgreSQL functions in public schema
SELECT 
  f.oid::regprocedure as function_name,
  pg_get_functiondef(f.oid) as function_definition
FROM pg_proc f
WHERE f.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY f.proname;

-- Export all triggers
SELECT 
  trigger_name,
  event_object_schema,
  event_object_table,
  action_statement,
  action_orientation,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY trigger_name;
