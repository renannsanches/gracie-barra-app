-- RLS policies on presencas, historico_graduacoes, avisos, qr_tokens and
-- others call is_staff()/is_admin()/is_tablet(). The functions exist with
-- SECURITY DEFINER but were missing GRANT EXECUTE for authenticated/anon,
-- so every SELECT by a non-staff user failed with
-- "permission denied for function is_staff" and the perfil page showed 0
-- aulas. Grant execute to restore reads.

GRANT EXECUTE ON FUNCTION public.is_staff()  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin()  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_tablet() TO authenticated, anon;
