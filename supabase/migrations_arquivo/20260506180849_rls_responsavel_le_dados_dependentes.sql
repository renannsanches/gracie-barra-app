ALTER POLICY presencas_select ON public.presencas
  USING ((aluno_id = auth.uid()) OR is_staff() OR EXISTS (
    SELECT 1 FROM dependentes WHERE responsavel_id = auth.uid() AND dependente_id = presencas.aluno_id
  ));

ALTER POLICY graduacoes_select ON public.historico_graduacoes
  USING ((aluno_id = auth.uid()) OR is_staff() OR EXISTS (
    SELECT 1 FROM dependentes WHERE responsavel_id = auth.uid() AND dependente_id = historico_graduacoes.aluno_id
  ));
