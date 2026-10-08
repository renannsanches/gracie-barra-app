-- =====================================================================
-- Local das modalidades + descontos por aluno
-- - modalidades.grupo_id: onde a modalidade é dada (Academia, Colégio…).
--   O(s) grupo(s) do aluno passam a vir das suas modalidades.
-- - modalidades.desconta_noutro_local: quem também treina noutro local
--   recebe o valor desta modalidade como desconto (ex.: Colégio 13 €).
-- - aluno_modalidades.cobrar: falso = pago fora da app (no próprio local).
-- - aluno_descontos: descontos do aluno (automáticos ou manuais).
-- =====================================================================

-- ---------------------------------------------------------------------
-- modalidades.grupo_id + desconta_noutro_local
-- ---------------------------------------------------------------------
ALTER TABLE modalidades ADD COLUMN grupo_id uuid REFERENCES grupos_alunos(id) ON DELETE RESTRICT;
ALTER TABLE modalidades ADD COLUMN desconta_noutro_local boolean NOT NULL DEFAULT false;
CREATE INDEX modalidades_grupo_idx ON modalidades (grupo_id);

-- O mesmo nome pode existir em locais diferentes (Jiu-Jitsu na Academia e no Colégio)
DROP INDEX modalidades_nome_unico;
CREATE UNIQUE INDEX modalidades_nome_local_unico ON modalidades (lower(btrim(nome)), grupo_id);

-- ---------------------------------------------------------------------
-- aluno_modalidades.cobrar
-- ---------------------------------------------------------------------
ALTER TABLE aluno_modalidades ADD COLUMN cobrar boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------
-- aluno_descontos
-- ---------------------------------------------------------------------
CREATE TABLE aluno_descontos (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id             uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  descricao            text          NOT NULL CHECK (char_length(btrim(descricao)) BETWEEN 1 AND 60),
  valor                numeric(10,2) NOT NULL CHECK (valor > 0),
  -- Modalidade que originou o desconto (automático); null = desconto manual
  origem_modalidade_id uuid          REFERENCES modalidades(id) ON DELETE SET NULL,
  criado_em            timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX aluno_descontos_aluno_idx ON aluno_descontos (aluno_id);

ALTER TABLE aluno_descontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aluno_descontos_select" ON aluno_descontos
  FOR SELECT USING (
    auth.uid() = aluno_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
    OR EXISTS (SELECT 1 FROM dependentes WHERE responsavel_id = auth.uid() AND dependente_id = aluno_id)
  );
CREATE POLICY "aluno_descontos_insert" ON aluno_descontos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "aluno_descontos_update" ON aluno_descontos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "aluno_descontos_delete" ON aluno_descontos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );

-- ---------------------------------------------------------------------
-- Backfill + seed
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_academia uuid;
  v_colegio  uuid;
BEGIN
  SELECT id INTO v_academia FROM grupos_alunos WHERE padrao;
  IF v_academia IS NULL THEN
    RAISE EXCEPTION 'Grupo padrão (Academia) não encontrado';
  END IF;

  -- Modalidades existentes são dadas na Academia
  UPDATE modalidades SET grupo_id = v_academia WHERE grupo_id IS NULL;
  EXECUTE format('ALTER TABLE modalidades ALTER COLUMN grupo_id SET DEFAULT %L::uuid', v_academia);
  ALTER TABLE modalidades ALTER COLUMN grupo_id SET NOT NULL;

  -- Jiu-Jitsu no Colégio: 13 €, descontado na Academia
  SELECT id INTO v_colegio FROM grupos_alunos WHERE lower(btrim(nome)) IN ('colégio', 'colegio') LIMIT 1;
  IF v_colegio IS NULL THEN
    INSERT INTO grupos_alunos (nome) VALUES ('Colégio') RETURNING id INTO v_colegio;
  END IF;

  INSERT INTO modalidades (nome, valor, grupo_id, desconta_noutro_local)
  VALUES ('Jiu-Jitsu', 13, v_colegio, true)
  ON CONFLICT DO NOTHING;
END $$;
