-- ============================================
-- FUNÇÃO HELPER: verifica se usuário é admin ou professor
-- ============================================

CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND perfil IN ('admin', 'professor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND perfil = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_tablet()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND perfil = 'tablet'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- HABILITAR RLS
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE albuns ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_graduacoes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES: profiles
-- ============================================

-- Qualquer autenticado pode ver profiles (pra exibir nome/foto em avisos, etc)
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Usuário atualiza seu próprio perfil (exceto campos sensíveis)
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Staff pode atualizar qualquer perfil (mudança de faixa, etc)
CREATE POLICY "profiles_update_staff" ON profiles
  FOR UPDATE TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- Admin pode deletar perfis
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE TO authenticated
  USING (is_admin());

-- ============================================
-- POLICIES: presencas
-- ============================================

-- Aluno vê só suas próprias presenças; staff vê tudo
CREATE POLICY "presencas_select" ON presencas
  FOR SELECT TO authenticated
  USING (aluno_id = auth.uid() OR is_staff());

-- Só tablet ou staff pode inserir presença
CREATE POLICY "presencas_insert" ON presencas
  FOR INSERT TO authenticated
  WITH CHECK (is_tablet() OR is_staff());

-- Só staff pode corrigir/deletar presenças
CREATE POLICY "presencas_modify_staff" ON presencas
  FOR UPDATE TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY "presencas_delete_staff" ON presencas
  FOR DELETE TO authenticated
  USING (is_staff());

-- ============================================
-- POLICIES: qr_tokens
-- ============================================

-- Aluno gera seus próprios tokens
CREATE POLICY "qr_tokens_insert_self" ON qr_tokens
  FOR INSERT TO authenticated
  WITH CHECK (aluno_id = auth.uid());

-- Aluno vê seus próprios tokens; tablet vê todos (pra validar)
CREATE POLICY "qr_tokens_select" ON qr_tokens
  FOR SELECT TO authenticated
  USING (aluno_id = auth.uid() OR is_tablet() OR is_staff());

-- Tablet marca token como usado
CREATE POLICY "qr_tokens_update_tablet" ON qr_tokens
  FOR UPDATE TO authenticated
  USING (is_tablet() OR is_staff())
  WITH CHECK (is_tablet() OR is_staff());

-- ============================================
-- POLICIES: avisos
-- ============================================

-- Todos autenticados leem avisos publicados
CREATE POLICY "avisos_select_published" ON avisos
  FOR SELECT TO authenticated
  USING (publicado = true OR is_staff());

-- Só staff cria/edita/deleta
CREATE POLICY "avisos_insert_staff" ON avisos
  FOR INSERT TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "avisos_update_staff" ON avisos
  FOR UPDATE TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY "avisos_delete_staff" ON avisos
  FOR DELETE TO authenticated
  USING (is_staff());

-- ============================================
-- POLICIES: albuns e fotos
-- ============================================

CREATE POLICY "albuns_select_all" ON albuns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "albuns_insert_staff" ON albuns
  FOR INSERT TO authenticated WITH CHECK (is_staff());

CREATE POLICY "albuns_update_staff" ON albuns
  FOR UPDATE TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY "albuns_delete_staff" ON albuns
  FOR DELETE TO authenticated USING (is_staff());

CREATE POLICY "fotos_select_all" ON fotos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fotos_insert_staff" ON fotos
  FOR INSERT TO authenticated WITH CHECK (is_staff());

CREATE POLICY "fotos_update_staff" ON fotos
  FOR UPDATE TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY "fotos_delete_staff" ON fotos
  FOR DELETE TO authenticated USING (is_staff());

-- ============================================
-- POLICIES: historico_graduacoes
-- ============================================

-- Aluno vê só seu próprio histórico; staff vê tudo
CREATE POLICY "graduacoes_select" ON historico_graduacoes
  FOR SELECT TO authenticated
  USING (aluno_id = auth.uid() OR is_staff());

-- Só staff registra graduações
CREATE POLICY "graduacoes_insert_staff" ON historico_graduacoes
  FOR INSERT TO authenticated WITH CHECK (is_staff());

CREATE POLICY "graduacoes_update_staff" ON historico_graduacoes
  FOR UPDATE TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY "graduacoes_delete_admin" ON historico_graduacoes
  FOR DELETE TO authenticated USING (is_admin());
