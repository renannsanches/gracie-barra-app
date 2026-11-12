-- =====================================================================
-- Grupos de alunos (ex.: Academia, Colégio)
-- Cada aluno pertence a no máximo 1 grupo (profiles.grupo_id).
-- O grupo marcado como `padrao` recebe os registos feitos pela app (/cadastro).
-- =====================================================================

CREATE TABLE grupos_alunos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text        NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 1 AND 40),
  ativo         boolean     NOT NULL DEFAULT true,
  padrao        boolean     NOT NULL DEFAULT false,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  -- O grupo padrão tem de estar sempre activo
  CONSTRAINT grupos_alunos_padrao_ativo CHECK (NOT padrao OR ativo)
);

-- Nome único (sem distinguir maiúsculas/espaços nas pontas)
CREATE UNIQUE INDEX grupos_alunos_nome_unico ON grupos_alunos (lower(btrim(nome)));
-- No máximo um grupo padrão
CREATE UNIQUE INDEX grupos_alunos_um_padrao ON grupos_alunos (padrao) WHERE padrao;

-- Trigger atualizado_em (reutiliza função criada na migração de mensalidades)
CREATE TRIGGER grupos_alunos_set_atualizado_em
  BEFORE UPDATE ON grupos_alunos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ---------------------------------------------------------------------
-- RLS — apenas admin/professor podem ler/escrever
-- ---------------------------------------------------------------------
ALTER TABLE grupos_alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grupos_alunos_select" ON grupos_alunos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "grupos_alunos_insert" ON grupos_alunos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "grupos_alunos_update" ON grupos_alunos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "grupos_alunos_delete" ON grupos_alunos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );

-- ---------------------------------------------------------------------
-- profiles.grupo_id
-- ---------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN grupo_id uuid REFERENCES grupos_alunos(id) ON DELETE SET NULL;

CREATE INDEX profiles_grupo_id_idx ON profiles (grupo_id);

-- ---------------------------------------------------------------------
-- Seed: grupo "Academia" (padrão) com todos os alunos actuais
-- ---------------------------------------------------------------------
WITH academia AS (
  INSERT INTO grupos_alunos (nome, padrao) VALUES ('Academia', true)
  RETURNING id
)
UPDATE profiles
   SET grupo_id = (SELECT id FROM academia)
 WHERE perfil = 'aluno'
   AND grupo_id IS NULL;
