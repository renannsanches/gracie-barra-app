-- Impressão digital do schema (T1 do roadmap SaaS).
--
-- Corre-se igual em dois projectos Supabase (ex.: produção e staging) e
-- comparam-se os resultados: uma linha por tipo de objecto, com o número de
-- objectos e um md5 de todos eles. Se um md5 diferir, trocar o SELECT final
-- pelo comentado no fim do ficheiro (filtrado por esse tipo) e comparar linha
-- a linha.
--
-- Só lê catálogos: não altera nada. Correr com o MCP do Supabase
-- (execute_sql) ou no SQL Editor.
--
-- Normalizações (diferenças cosméticas que não mudam o comportamento):
--   * corpo das funções sem `\r` — 2 funções de produção foram coladas no
--     Dashboard a partir do Windows e têm fins de linha CRLF;
--   * entradas das ACL (grants) ordenadas — a ordem no array depende de
--     quando cada GRANT foi feito.
--
-- Fora de propósito: os buckets `comprovativos` e `Gracie Barra Famalicao`
-- (vazios e sem uso no código; ficaram fora da baseline por decisão do dono
-- em 2026-11-12) e as extensões que o Supabase instala sozinho.

with itens(tipo, nome, detalhe) as (
  -- Colunas de public
  select 'coluna', c.table_name || '.' || c.column_name,
         concat_ws(' | ', c.ordinal_position::text, c.data_type, c.udt_name,
                   c.is_nullable, c.column_default, c.character_maximum_length::text,
                   c.is_identity, c.is_generated)
  from information_schema.columns c
  where c.table_schema = 'public'

  union all
  -- Tabelas, sequências e views de public: RLS e grants
  select 'relacao', c.relname,
         concat_ws(' | ', c.relkind::text, c.relrowsecurity::text,
                   c.relforcerowsecurity::text,
                   (select string_agg(a::text, ',' order by a::text) from unnest(c.relacl) a))
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')

  union all
  -- Constraints (PK, FK, unique, check)
  select 'constraint', conrelid::regclass::text || '.' || conname, pg_get_constraintdef(oid)
  from pg_constraint
  where connamespace = 'public'::regnamespace

  union all
  select 'indice', tablename || '.' || indexname, indexdef
  from pg_indexes
  where schemaname = 'public'

  union all
  -- Policies de public e de storage.objects
  select 'policy', schemaname || '.' || tablename || '.' || policyname,
         concat_ws(' | ', permissive, roles::text, cmd, qual, with_check)
  from pg_policies
  where schemaname in ('public', 'storage')

  union all
  -- Funções: corpo (md5), security definer, grants e search_path
  select 'funcao', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         concat_ws(' | ', md5(replace(pg_get_functiondef(p.oid), chr(13), '')), p.prosecdef::text,
                   (select string_agg(a::text, ',' order by a::text) from unnest(p.proacl) a),
                   p.proconfig::text)
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'

  union all
  -- Triggers de public e de auth.users (handle_new_user)
  select 'trigger', t.tgrelid::regclass::text || '.' || t.tgname, pg_get_triggerdef(t.oid)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (n.nspname = 'public' or t.tgrelid = 'auth.users'::regclass)

  union all
  select 'enum', t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder)
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  where t.typnamespace = 'public'::regnamespace
  group by t.typname

  union all
  -- Privilégios por defeito em public (afectam tabelas criadas no futuro)
  select 'default_acl', d.defaclrole::regrole::text || '.' || d.defaclobjtype::text,
         (select string_agg(a::text, ',' order by a::text) from unnest(d.defaclacl) a)
  from pg_default_acl d
  where d.defaclnamespace = 'public'::regnamespace

  union all
  select 'bucket', b.id,
         concat_ws(' | ', b.name, b.public::text, b.file_size_limit::text,
                   b.allowed_mime_types::text)
  from storage.buckets b
  where b.id not in ('comprovativos', 'Gracie Barra Famalicao')

  union all
  -- Só as extensões de que o schema depende
  select 'extensao', e.extname, n.nspname
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname in ('pgcrypto', 'uuid-ossp')
)
select tipo,
       count(*) as total,
       md5(string_agg(nome || ' => ' || coalesce(detalhe, ''), E'\n' order by nome)) as impressao
from itens
group by tipo
order by tipo;

-- Detalhe de um tipo (trocar pelo SELECT acima):
-- select tipo, nome, detalhe from itens where tipo = 'funcao' order by nome;
