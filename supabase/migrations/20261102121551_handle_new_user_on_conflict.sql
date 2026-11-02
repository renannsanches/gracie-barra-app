-- Já aplicada em produção pelo MCP do Supabase em 2026-11-02 (versão 20261102121551).
--
-- O trigger de signup passa a ignorar perfis que já existem. Assim dá para
-- recriar no Auth um utilizador apagado com o mesmo id e voltar a ligá-lo ao
-- perfil antigo (mensalidades, presenças, graduações) sem o insert rebentar.
-- Signups novos não mudam: o perfil não existe e é criado como antes.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- ON CONFLICT: permite religar um utilizador Auth a um perfil que já existe
  -- (ex.: recuperar uma conta apagada do Auth com o mesmo id).
  INSERT INTO profiles (id, nome_completo, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email),
    'aluno'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
