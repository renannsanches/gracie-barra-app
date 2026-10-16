-- =====================================================================
-- Gamificação (Fase 17): ranking de presenças, sequências e medalhas
--
-- - profiles.ocultar_ranking: o aluno pode sair do ranking (alterado por
--   server action; o trigger tg_profiles_proteger_colunas impede a escrita
--   directa pelo cliente).
-- - conquistas: medalhas ganhas. Calculadas no servidor (src/lib/gamificacao.ts)
--   e gravadas só com service_role.
-- - RPCs de agregação, só para service_role (chamadas via createAdminClient):
--   devolvem uma linha por aluno para não bater no limite de 1000 linhas do
--   PostgREST. Datas em hora de Lisboa; cada aula registada conta 1.
-- =====================================================================

ALTER TABLE profiles ADD COLUMN ocultar_ranking boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- conquistas
-- ---------------------------------------------------------------------
CREATE TABLE conquistas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  codigo         text        NOT NULL,
  -- '' nas medalhas únicas; mês ('2026-09') nas repetíveis (Mês perfeito, Top 3)
  referencia     text        NOT NULL DEFAULT '',
  conquistada_em date        NOT NULL,
  vista_em       timestamptz,
  notificada_em  timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, codigo, referencia)
);

ALTER TABLE conquistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conquistas_select" ON conquistas
  FOR SELECT TO authenticated USING (
    auth.uid() = aluno_id
    OR is_staff()
    OR EXISTS (SELECT 1 FROM dependentes WHERE responsavel_id = auth.uid() AND dependente_id = conquistas.aluno_id)
  );
-- Sem policies de escrita: só o servidor (service_role) grava.

REVOKE ALL ON conquistas FROM anon;

-- ---------------------------------------------------------------------
-- Datas de cada aula por aluno (repetidas quando há 2 aulas no mesmo dia).
-- Ignora datas inválidas (há registos antigos com o ano 0026).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dias_treino_alunos(p_aluno_ids uuid[] DEFAULT NULL)
RETURNS TABLE (aluno_id uuid, dias date[])
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p.aluno_id,
         array_agg((p.registrado_em AT TIME ZONE 'Europe/Lisbon')::date ORDER BY p.registrado_em)
  FROM presencas p
  WHERE p.registrado_em >= '2020-01-01'
    AND (p_aluno_ids IS NULL OR p.aluno_id = ANY (p_aluno_ids))
  GROUP BY p.aluno_id;
$$;

-- ---------------------------------------------------------------------
-- Ranking de aulas num período [p_inicio, p_fim] (datas de Lisboa, inclusivas).
-- Só alunos activos que não pediram para ficar fora do ranking.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ranking_presencas(p_inicio date, p_fim date)
RETURNS TABLE (
  aluno_id      uuid,
  nome_completo text,
  foto_url      text,
  faixa         text,
  graus         int,
  categoria     text,
  aulas         int
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT pr.id, pr.nome_completo, pr.foto_url, pr.faixa::text, coalesce(pr.graus, 0)::int,
         pr.categoria::text, count(*)::int
  FROM presencas p
  JOIN profiles pr ON pr.id = p.aluno_id
  WHERE p.registrado_em >= (p_inicio::timestamp AT TIME ZONE 'Europe/Lisbon')
    AND p.registrado_em <  ((p_fim + 1)::timestamp AT TIME ZONE 'Europe/Lisbon')
    AND pr.perfil = 'aluno'
    AND pr.status = 'ativo'
    AND NOT pr.ocultar_ranking
  GROUP BY pr.id;
$$;

-- ---------------------------------------------------------------------
-- Segundas-feiras das semanas em que alguém treinou na academia.
-- Uma semana sem ninguém (férias, academia fechada) não quebra sequências.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.semanas_com_treino()
RETURNS date[]
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(array_agg(semana ORDER BY semana), '{}')
  FROM (
    SELECT DISTINCT date_trunc('week', p.registrado_em AT TIME ZONE 'Europe/Lisbon')::date AS semana
    FROM presencas p
    WHERE p.registrado_em >= '2020-01-01'
  ) s;
$$;

REVOKE EXECUTE ON FUNCTION public.dias_treino_alunos(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ranking_presencas(date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.semanas_com_treino() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dias_treino_alunos(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.ranking_presencas(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.semanas_com_treino() TO service_role;
