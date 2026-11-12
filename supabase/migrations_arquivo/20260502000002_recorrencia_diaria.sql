-- Adiciona suporte a recorrência diária (seg-sex)
-- Também inclui a alteração de índice pendente da migration 20260502000001

-- Índice único que permite múltiplas aulas no mesmo dia com horários diferentes
DROP INDEX IF EXISTS aulas_turma_data_idx;
CREATE UNIQUE INDEX IF NOT EXISTS aulas_turma_data_horario_idx ON aulas(turma_id, data, horario);

-- Adiciona valor 'diario' ao enum
ALTER TYPE recorrencia_turma ADD VALUE IF NOT EXISTS 'diario';

-- Atualiza RPC com suporte a 'diario' e novo conflict target
CREATE OR REPLACE FUNCTION gerar_aulas(p_turma_id uuid, p_semanas int DEFAULT 4)
RETURNS int LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_turma   turmas%ROWTYPE;
  v_data    date;
  v_hoje    date := CURRENT_DATE;
  v_fim     date;
  v_rows    int;
  v_criadas int := 0;
  v_diff    int;
  v_dow     int;
BEGIN
  SELECT * INTO v_turma FROM turmas WHERE id = p_turma_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turma não encontrada: %', p_turma_id; END IF;

  v_fim := v_hoje + (p_semanas * 7);

  IF v_turma.recorrencia = 'diario' THEN
    -- Gera aulas de segunda (1) a sexta (5), sem fins de semana
    v_data := v_hoje;
    WHILE v_data <= v_fim LOOP
      v_dow := EXTRACT(DOW FROM v_data)::int;
      IF v_dow BETWEEN 1 AND 5 THEN
        INSERT INTO aulas (turma_id, data, horario, lotacao_maxima, status)
        VALUES (p_turma_id, v_data, v_turma.horario, v_turma.lotacao_maxima, 'agendada')
        ON CONFLICT (turma_id, data, horario) DO NOTHING;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_criadas := v_criadas + v_rows;
      END IF;
      v_data := v_data + 1;
    END LOOP;
  ELSE
    -- Recorrências baseadas em dia fixo da semana
    v_diff := (v_turma.dia_semana - EXTRACT(DOW FROM v_hoje)::int + 7) % 7;
    v_data := v_hoje + v_diff;
    WHILE v_data <= v_fim LOOP
      INSERT INTO aulas (turma_id, data, horario, lotacao_maxima, status)
      VALUES (p_turma_id, v_data, v_turma.horario, v_turma.lotacao_maxima, 'agendada')
      ON CONFLICT (turma_id, data, horario) DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_criadas := v_criadas + v_rows;
      CASE v_turma.recorrencia
        WHEN 'semanal'   THEN v_data := v_data + 7;
        WHEN 'quinzenal' THEN v_data := v_data + 14;
        WHEN 'mensal'    THEN v_data := v_data + 28;
        ELSE                  v_data := v_data + 7;
      END CASE;
    END LOOP;
  END IF;

  RETURN v_criadas;
END;
$$;
