-- Leitura de profiles restrita.
--
-- profiles_select_all (USING true) deixava qualquer aluno com sessão ler todas as colunas
-- de todos os perfis: IBAN, NIF, telefone, data de nascimento, contacto de emergência.
-- Passa a ver só: o próprio perfil, os dos seus dependentes e — staff — todos.
--
-- O que a app mostra de outros alunos (ranking, reservas em /aulas, nome do professor
-- no histórico de graduações) vem do servidor com o admin client, só com as colunas
-- necessárias. Funções SECURITY DEFINER (QR, is_staff…) não são afectadas.

-- A policy não pode consultar dependentes directamente: a policy de dependentes consulta
-- profiles e o Postgres acusaria recursão infinita. Este helper lê dependentes sem RLS.
CREATE OR REPLACE FUNCTION public.e_meu_dependente(p_aluno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dependentes
    WHERE responsavel_id = auth.uid() AND dependente_id = p_aluno_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.e_meu_dependente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_meu_dependente(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (
    id = auth.uid()
    OR is_staff()
    OR e_meu_dependente(id)
  );
