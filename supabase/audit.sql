-- ==========================================
-- SCRIPT DE AUDITORIA DO BANCO DE DADOS
-- ==========================================
-- Este script é apenas leitura.
-- Execute-o no SQL Editor do Supabase e copie o resultado para a IA.

-- 1. Listar Tabelas, Colunas e Tipos
SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema IN ('public', 'auth')
ORDER BY table_schema, table_name, ordinal_position;

-- 2. Listar Constraints
SELECT tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type,
    kcu.column_name, ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name, chk.check_clause
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.check_constraints AS chk ON chk.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public' ORDER BY tc.table_name, tc.constraint_type;

-- 3. Listar Índices
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- 4. Listar Triggers
SELECT event_object_schema as table_schema, event_object_table as table_name,
    trigger_schema, trigger_name, event_manipulation as event,
    action_statement as definition, action_timing as timing
FROM information_schema.triggers WHERE event_object_schema = 'public' ORDER BY table_name, trigger_name;

-- 5. Listar Funções RPC (Assinatura, Privilégios, Proprietário, Security)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    prosecdef as is_security_definer,
    proconfig as search_path,
    pg_get_userbyid(proowner) as owner,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' ORDER BY function_name;

-- 6. Listar Políticas RLS e Status RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

SELECT schemaname, tablename, rowsecurity 
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 7. Listar Privilégios/Grants em Tabelas (Incluindo authenticated e PUBLIC)
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants WHERE table_schema = 'public' ORDER BY table_name, grantee;

-- 8. Listar Privilégios em Funções
SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants WHERE routine_schema = 'public' ORDER BY routine_name, grantee;

-- 9. Listar Default Privileges
SELECT pg_get_userbyid(d.defaclrole) AS owner,
       n.nspname AS schema,
       CASE d.defaclobjtype WHEN 'r' THEN 'table' WHEN 'r' THEN 'view' WHEN 'S' THEN 'sequence' WHEN 'f' THEN 'function' WHEN 'T' THEN 'type' END AS object_type,
       aclexplode(d.defaclacl) AS privileges
FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace WHERE n.nspname = 'public';

-- 10. Listar Views e Materialized Views (incluindo security_invoker)
SELECT table_schema, table_name, view_definition, 
       (SELECT c.reloptions FROM pg_class c WHERE c.relname = v.table_name AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = v.table_schema)) as reloptions
FROM information_schema.views v WHERE table_schema = 'public';

SELECT schemaname, matviewname, definition FROM pg_matviews WHERE schemaname = 'public';

-- 11. Listar Schemas Expostos (normalmente via PostgREST)
-- (Neste caso apenas checamos schemas criados no banco)
SELECT schema_name FROM information_schema.schemata;

-- 12. Listar Sequences
SELECT sequence_schema, sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public';

-- 13. Checar Histórico de Migrations do Supabase (se a tabela existir)
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;
