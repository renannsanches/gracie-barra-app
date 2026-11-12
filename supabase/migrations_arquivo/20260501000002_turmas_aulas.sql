-- Fase 7: Turmas, Aulas e Reservas
-- =============================================================================

CREATE TYPE recorrencia_turma AS ENUM ('semanal', 'quinzenal', 'mensal', 'personalizado');
CREATE TYPE status_aula       AS ENUM ('agendada', 'cancelada', 'concluida');
CREATE TYPE status_reserva    AS ENUM ('confirmada', 'cancelada', 'presente');

-- =============================================================================
-- turmas
-- =============================================================================
CREATE TABLE turmas (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text              NOT NULL,
  dia_semana      int               NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario         time              NOT NULL,
  recorrencia     recorrencia_turma NOT NULL DEFAULT 'semanal',
  lotacao_maxima  int               NOT NULL DEFAULT 20 CHECK (lotacao_maxima > 0),
  categoria       categoria_faixa   NOT NULL DEFAULT 'adulto',
  professor_id    uuid              REFERENCES profiles(id) ON DELETE SET NULL,
  ativa           boolean           NOT NULL DEFAULT true,
  criado_em       timestamptz       NOT NULL DEFAULT now(),
  atualizado_em   timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX turmas_ativa_idx     ON turmas(ativa);
CREATE INDEX turmas_categoria_idx ON turmas(categoria);

CREATE TRIGGER turmas_set_atualizado_em
  BEFORE UPDATE ON turmas
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- =============================================================================
-- aulas
-- =============================================================================
CREATE TABLE aulas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id        uuid        NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  data            date        NOT NULL,
  horario         time        NOT NULL,
  lotacao_maxima  int         NOT NULL CHECK (lotacao_maxima > 0),
  status          status_aula NOT NULL DEFAULT 'agendada',
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX aulas_turma_data_idx ON aulas(turma_id, data);
CREATE INDEX aulas_data_idx   ON aulas(data);
CREATE INDEX aulas_turma_idx  ON aulas(turma_id);
CREATE INDEX aulas_status_idx ON aulas(status);

-- =============================================================================
-- reservas
-- =============================================================================
CREATE TABLE reservas (
  id        uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id   uuid           NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  aluno_id  uuid           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status    status_reserva NOT NULL DEFAULT 'confirmada',
  criado_em timestamptz    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reservas_aula_aluno_idx ON reservas(aula_id, aluno_id);
CREATE INDEX reservas_aula_idx  ON reservas(aula_id);
CREATE INDEX reservas_aluno_idx ON reservas(aluno_id);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE turmas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE aulas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- Turmas: authenticated users see active ones; staff sees all
CREATE POLICY "turmas_select" ON turmas FOR SELECT USING (
  ativa = true
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
);
CREATE POLICY "turmas_insert" ON turmas FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
);
CREATE POLICY "turmas_update" ON turmas FOR UPDATE
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor')))
  WITH CHECK(EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor')));
CREATE POLICY "turmas_delete" ON turmas FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
);

-- Aulas: any authenticated user can view
CREATE POLICY "aulas_select" ON aulas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "aulas_insert" ON aulas FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
);
CREATE POLICY "aulas_update" ON aulas FOR UPDATE
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor')))
  WITH CHECK(EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor')));
CREATE POLICY "aulas_delete" ON aulas FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
);

-- Reservas: student sees own; staff sees all
CREATE POLICY "reservas_select" ON reservas FOR SELECT USING (
  auth.uid() = aluno_id
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
);
CREATE POLICY "reservas_insert" ON reservas FOR INSERT WITH CHECK (
  auth.uid() = aluno_id
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
);
CREATE POLICY "reservas_update" ON reservas FOR UPDATE
  USING (
    auth.uid() = aluno_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  )
  WITH CHECK (
    auth.uid() = aluno_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "reservas_delete" ON reservas FOR DELETE USING (
  auth.uid() = aluno_id
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
);

-- =============================================================================
-- RPC: gerar_aulas(p_turma_id, p_semanas)
-- Returns the number of new aula rows inserted.
-- =============================================================================
CREATE OR REPLACE FUNCTION gerar_aulas(p_turma_id uuid, p_semanas int DEFAULT 4)
RETURNS int
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_turma   turmas%ROWTYPE;
  v_data    date;
  v_hoje    date := CURRENT_DATE;
  v_fim     date;
  v_rows    int;
  v_criadas int := 0;
  v_diff    int;
BEGIN
  SELECT * INTO v_turma FROM turmas WHERE id = p_turma_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turma não encontrada: %', p_turma_id;
  END IF;

  v_fim  := v_hoje + (p_semanas * 7);
  -- Days until the next occurrence of dia_semana (0 means today if same day)
  v_diff := (v_turma.dia_semana - EXTRACT(DOW FROM v_hoje)::int + 7) % 7;
  v_data := v_hoje + v_diff;

  WHILE v_data <= v_fim LOOP
    INSERT INTO aulas (turma_id, data, horario, lotacao_maxima, status)
    VALUES (p_turma_id, v_data, v_turma.horario, v_turma.lotacao_maxima, 'agendada')
    ON CONFLICT (turma_id, data) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_criadas := v_criadas + v_rows;

    CASE v_turma.recorrencia
      WHEN 'semanal'   THEN v_data := v_data + 7;
      WHEN 'quinzenal' THEN v_data := v_data + 14;
      WHEN 'mensal'    THEN v_data := v_data + 28;
      ELSE                  v_data := v_data + 7;
    END CASE;
  END LOOP;

  RETURN v_criadas;
END;
$$;
