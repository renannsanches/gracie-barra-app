CREATE POLICY "responsavel_le_mensalidades_dependentes"
ON mensalidades FOR SELECT
USING (
  auth.uid() = aluno_id
  OR EXISTS (
    SELECT 1 FROM dependentes
    WHERE responsavel_id = auth.uid()
    AND dependente_id = aluno_id
  )
);
