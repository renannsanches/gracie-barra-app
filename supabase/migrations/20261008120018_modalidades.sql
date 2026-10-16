-- =====================================================================
-- Modalidades (Jiu-Jitsu, Capoeira, …)
-- - modalidades: catálogo com valor sugerido (adultos e menores de 16)
-- - aluno_modalidades: "plano" do aluno — modalidades + valor próprio de cada
-- - mensalidades.itens: composição da mensalidade (snapshot do plano)
-- - turmas.modalidade_id: cada turma pertence a uma modalidade
-- =====================================================================

CREATE TABLE modalidades (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text          NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 1 AND 40),
  valor          numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  valor_infantil numeric(10,2)          CHECK (valor_infantil >= 0),
  ativo          boolean       NOT NULL DEFAULT true,
  padrao         boolean       NOT NULL DEFAULT false,
  criado_em      timestamptz   NOT NULL DEFAULT now(),
  atualizado_em  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT modalidades_padrao_ativo CHECK (NOT padrao OR ativo)
);

CREATE UNIQUE INDEX modalidades_nome_unico ON modalidades (lower(btrim(nome)));
CREATE UNIQUE INDEX modalidades_um_padrao ON modalidades (padrao) WHERE padrao;

CREATE TRIGGER modalidades_set_atualizado_em
  BEFORE UPDATE ON modalidades
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

ALTER TABLE modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modalidades_select" ON modalidades
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "modalidades_insert" ON modalidades
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "modalidades_update" ON modalidades
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "modalidades_delete" ON modalidades
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );

-- ---------------------------------------------------------------------
-- aluno_modalidades — plano do aluno
-- ---------------------------------------------------------------------
CREATE TABLE aluno_modalidades (
  aluno_id      uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  modalidade_id uuid          NOT NULL REFERENCES modalidades(id) ON DELETE RESTRICT,
  valor         numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  criado_em     timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (aluno_id, modalidade_id)
);

CREATE INDEX aluno_modalidades_modalidade_idx ON aluno_modalidades (modalidade_id);

ALTER TABLE aluno_modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aluno_modalidades_select" ON aluno_modalidades
  FOR SELECT USING (
    auth.uid() = aluno_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
    OR EXISTS (SELECT 1 FROM dependentes WHERE responsavel_id = auth.uid() AND dependente_id = aluno_id)
  );
CREATE POLICY "aluno_modalidades_insert" ON aluno_modalidades
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "aluno_modalidades_update" ON aluno_modalidades
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "aluno_modalidades_delete" ON aluno_modalidades
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );

-- ---------------------------------------------------------------------
-- Colunas novas
-- ---------------------------------------------------------------------
-- Composição da mensalidade: [{ "modalidade_id", "nome", "valor" }]. `valor` continua a ser o total.
ALTER TABLE mensalidades ADD COLUMN itens jsonb;

ALTER TABLE turmas ADD COLUMN modalidade_id uuid REFERENCES modalidades(id) ON DELETE RESTRICT;
CREATE INDEX turmas_modalidade_idx ON turmas (modalidade_id);

-- ---------------------------------------------------------------------
-- Seed + backfill
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_jj uuid;
BEGIN
  INSERT INTO modalidades (nome, valor, valor_infantil, padrao)
  VALUES ('Jiu-Jitsu', 62, 55, true)
  RETURNING id INTO v_jj;

  INSERT INTO modalidades (nome, valor) VALUES ('Capoeira', 20);

  -- Turmas existentes são de Jiu-Jitsu; novas turmas sem modalidade também
  UPDATE turmas SET modalidade_id = v_jj WHERE modalidade_id IS NULL;
  EXECUTE format('ALTER TABLE turmas ALTER COLUMN modalidade_id SET DEFAULT %L::uuid', v_jj);
  ALTER TABLE turmas ALTER COLUMN modalidade_id SET NOT NULL;

  -- Todas as mensalidades até hoje foram de Jiu-Jitsu
  UPDATE mensalidades
     SET itens = jsonb_build_array(jsonb_build_object(
           'modalidade_id', v_jj, 'nome', 'Jiu-Jitsu', 'valor', valor))
   WHERE itens IS NULL;

  -- Plano: Jiu-Jitsu para quem treina, com o valor da última mensalidade
  -- (preserva descontos); sem mensalidades → valor sugerido pela idade.
  INSERT INTO aluno_modalidades (aluno_id, modalidade_id, valor)
  SELECT p.id, v_jj,
         COALESCE(
           (SELECT m.valor FROM mensalidades m
             WHERE m.aluno_id = p.id
             ORDER BY m.mes_referencia DESC LIMIT 1),
           CASE WHEN p.data_nascimento IS NOT NULL
                 AND p.data_nascimento > (CURRENT_DATE - INTERVAL '16 years')
                THEN 55 ELSE 62 END)
    FROM profiles p
   WHERE p.perfil NOT IN ('responsavel', 'tablet')
  ON CONFLICT DO NOTHING;
END $$;
