-- 1) RLS em public.academias
ALTER TABLE public.academias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "academias_read_authenticated" ON public.academias
  FOR SELECT TO authenticated USING (true);

-- 2) search_path nas funções restantes
ALTER FUNCTION public.set_atualizado_em() SET search_path = public, pg_temp;
ALTER FUNCTION public.verificar_bloqueio_financeiro(uuid) SET search_path = public, pg_temp;

-- 3) Revogar EXECUTE de SECURITY DEFINER expostas indevidamente
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_tablet() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verificar_bloqueio_financeiro(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.limpar_tokens_expirados() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerar_qr_token(uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_presenca_por_token(text) FROM anon, PUBLIC;

-- 4) Bucket avatars — remover SELECT amplo (URLs públicas continuam a servir directamente)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
