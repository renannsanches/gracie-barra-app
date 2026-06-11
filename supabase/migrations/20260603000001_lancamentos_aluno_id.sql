-- Adicionar coluna aluno_id a lancamentos_financeiros
-- Usada quando um aluno (profiles) é o destinatário de uma conta a receber
-- (ex.: venda de kimono, acessório, etc.)
-- Distinção: fornecedor_id → entidade externa (fornecedor/cliente cadastrado)
--            aluno_id     → aluno registado no sistema

ALTER TABLE lancamentos_financeiros
  ADD COLUMN aluno_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX lancamentos_aluno_idx ON lancamentos_financeiros(aluno_id);
