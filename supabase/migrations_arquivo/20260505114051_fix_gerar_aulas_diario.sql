-- Reconstruído a partir da definição actual em produção (pg_get_functiondef),
-- consultada nesta reconciliação em 2026-07-20 — não é o diff histórico
-- original, mas reflecte fielmente o estado hoje. Ajusta a recorrência
-- 'diario' para saltar fins de semana avançando a data inicial (e cada
-- passo seguinte) para a próxima segunda-feira, em vez de filtrar
-- dia-a-dia por EXTRACT(DOW) BETWEEN 1 AND 5 (versão anterior em
-- 20260502000002_recorrencia_diaria.sql).

CREATE OR REPLACE FUNCTION public.gerar_aulas(p_turma_id uuid, p_semanas integer DEFAULT 4)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  -- Calculate the starting date depending on recurrence type
  IF v_turma.recorrencia = 'diario' THEN
    -- Start from today; advance to Monday if today is weekend
    v_data := v_hoje;
    v_dow  := EXTRACT(DOW FROM v_data)::int;
    IF    v_dow = 6 THEN v_data := v_data + 2;  -- Saturday → Monday
    ELSIF v_dow = 0 THEN v_data := v_data + 1;  -- Sunday  → Monday
    END IF;
  ELSE
    v_diff := (v_turma.dia_semana - EXTRACT(DOW FROM v_hoje)::int + 7) % 7;
    v_data := v_hoje + v_diff;
  END IF;

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
      WHEN 'diario'    THEN
        v_data := v_data + 1;
        v_dow  := EXTRACT(DOW FROM v_data)::int;
        IF    v_dow = 6 THEN v_data := v_data + 2;  -- Saturday → Monday
        ELSIF v_dow = 0 THEN v_data := v_data + 1;  -- Sunday  → Monday
        END IF;
      ELSE v_data := v_data + 7;
    END CASE;
  END LOOP;

  RETURN v_criadas;
END;
$function$
