-- Enum para status de mensalidade
CREATE TYPE status_mensalidade AS ENUM ('pendente', 'pago', 'atrasado');

-- Tabela de mensalidades
CREATE TABLE mensalidades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mes_referencia  date NOT NULL,
  data_vencimento date NOT NULL,
  valor           numeric(10, 2) NOT NULL,
  status          status_mensalidade NOT NULL DEFAULT 'pendente',
  data_pagamento  date,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mensalidades_aluno_id_idx      ON mensalidades(aluno_id);
CREATE INDEX mensalidades_mes_referencia_idx ON mensalidades(mes_referencia);
CREATE UNIQUE INDEX mensalidades_aluno_mes_idx ON mensalidades(aluno_id, mes_referencia);

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mensalidades_set_atualizado_em
  BEFORE UPDATE ON mensalidades
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- RLS
ALTER TABLE mensalidades ENABLE ROW LEVEL SECURITY;

-- SELECT: aluno vê as suas, staff (admin/professor) vê todas
CREATE POLICY "mensalidades_select" ON mensalidades
  FOR SELECT USING (
    auth.uid() = aluno_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND perfil IN ('admin', 'professor')
    )
  );

-- INSERT: apenas staff
CREATE POLICY "mensalidades_insert" ON mensalidades
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND perfil IN ('admin', 'professor')
    )
  );

-- UPDATE: apenas staff
CREATE POLICY "mensalidades_update" ON mensalidades
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND perfil IN ('admin', 'professor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND perfil IN ('admin', 'professor')
    )
  );

-- DELETE: apenas staff
CREATE POLICY "mensalidades_delete" ON mensalidades
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND perfil IN ('admin', 'professor')
    )
  );
