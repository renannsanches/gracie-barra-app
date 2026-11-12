-- Reconstruído a partir do schema em produção — não havia registo de migration
-- para esta tabela (drift). Fase 13: dependentes (filhos sem login próprio).
-- academia_id é adicionado depois, pela migration multi_tenant_academias.

CREATE TABLE dependentes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  responsavel_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dependente_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (responsavel_id, dependente_id)
);

ALTER TABLE dependentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Responsável vê seus dependentes" ON dependentes
  FOR SELECT TO authenticated
  USING (responsavel_id = auth.uid());

CREATE POLICY "Staff gerencia dependentes" ON dependentes
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
