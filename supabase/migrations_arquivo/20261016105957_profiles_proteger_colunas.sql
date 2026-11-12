-- Impede que um aluno altere colunas sensíveis do próprio perfil.
--
-- A policy profiles_update_self deixa o aluno fazer UPDATE da sua linha e o role
-- authenticated tem UPDATE em todas as colunas: sem isto, qualquer aluno podia
-- fazer supabase.from("profiles").update({ perfil: "admin" }) pela consola do
-- browser e entrar no /admin.
--
-- O aluno só altera, pelo cliente, nome, telefone, data de nascimento e foto
-- (PerfilView). Tudo o resto passa por server actions com o admin client
-- (service_role) ou é feito por staff — esses casos não são afectados.
-- Funções SECURITY DEFINER correm como o dono (current_user <> 'authenticated'),
-- por isso também não são afectadas.

CREATE OR REPLACE FUNCTION public.proteger_colunas_profiles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_permitidas text[] := ARRAY['nome_completo', 'telefone', 'data_nascimento', 'foto_url', 'updated_at'];
BEGIN
  IF current_user <> 'authenticated' OR public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - v_permitidas) IS DISTINCT FROM (to_jsonb(OLD) - v_permitidas) THEN
    RAISE EXCEPTION 'Sem permissão para alterar estes dados do perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_profiles_proteger_colunas ON public.profiles;
CREATE TRIGGER tg_profiles_proteger_colunas
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_colunas_profiles();
