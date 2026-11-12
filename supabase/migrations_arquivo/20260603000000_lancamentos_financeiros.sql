-- =====================================================================
-- Lançamentos financeiros avulsos (contas a pagar e a receber)
--
-- Cria 4 tabelas (categorias_financeiras, formas_pagamento, fornecedores,
-- lancamentos_financeiros) com enums, índices, RLS e seed inicial.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE tipo_categoria_financeira AS ENUM ('despesa', 'receita');
CREATE TYPE tipo_fornecedor           AS ENUM ('fornecedor', 'cliente', 'funcionario', 'outro');
CREATE TYPE tipo_lancamento           AS ENUM ('pagar', 'receber');
CREATE TYPE status_lancamento         AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');

-- ---------------------------------------------------------------------
-- TABELA: categorias_financeiras (plano de contas hierárquico)
-- ---------------------------------------------------------------------
CREATE TABLE categorias_financeiras (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  tipo       tipo_categoria_financeira NOT NULL,
  parent_id  uuid REFERENCES categorias_financeiras(id) ON DELETE RESTRICT,
  ativa      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX categorias_financeiras_parent_idx ON categorias_financeiras(parent_id);
CREATE INDEX categorias_financeiras_tipo_idx   ON categorias_financeiras(tipo);

-- ---------------------------------------------------------------------
-- TABELA: formas_pagamento
-- ---------------------------------------------------------------------
CREATE TABLE formas_pagamento (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL UNIQUE,
  ativa     boolean NOT NULL DEFAULT true,
  ordem     int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- TABELA: fornecedores
-- ---------------------------------------------------------------------
CREATE TABLE fornecedores (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL,
  tipo      tipo_fornecedor NOT NULL DEFAULT 'fornecedor',
  nif       text,
  email     text,
  telefone  text,
  notas     text,
  ativo     boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fornecedores_nome_idx ON fornecedores(lower(nome));
CREATE INDEX fornecedores_tipo_idx ON fornecedores(tipo);

-- ---------------------------------------------------------------------
-- TABELA: lancamentos_financeiros (núcleo)
-- ---------------------------------------------------------------------
CREATE TABLE lancamentos_financeiros (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                tipo_lancamento NOT NULL,
  descricao           text NOT NULL,
  fornecedor_id       uuid REFERENCES fornecedores(id) ON DELETE SET NULL,
  categoria_id        uuid REFERENCES categorias_financeiras(id) ON DELETE SET NULL,
  data_vencimento     date NOT NULL,
  valor               numeric(10,2) NOT NULL CHECK (valor > 0),
  status              status_lancamento NOT NULL DEFAULT 'pendente',
  data_pagamento      date,
  forma_pagamento_id  uuid REFERENCES formas_pagamento(id) ON DELETE SET NULL,
  comprovativo_url    text,
  notas               text,
  -- agrupamento de parcelas
  grupo_id            uuid,
  parcela_numero      int,
  parcela_total       int,
  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now(),
  criado_por          uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX lancamentos_data_venc_idx   ON lancamentos_financeiros(data_vencimento);
CREATE INDEX lancamentos_status_idx      ON lancamentos_financeiros(status);
CREATE INDEX lancamentos_tipo_idx        ON lancamentos_financeiros(tipo);
CREATE INDEX lancamentos_grupo_idx       ON lancamentos_financeiros(grupo_id);
CREATE INDEX lancamentos_fornecedor_idx  ON lancamentos_financeiros(fornecedor_id);
CREATE INDEX lancamentos_categoria_idx   ON lancamentos_financeiros(categoria_id);

-- Trigger atualizado_em (reutiliza função criada na migração de mensalidades)
CREATE TRIGGER lancamentos_set_atualizado_em
  BEFORE UPDATE ON lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ---------------------------------------------------------------------
-- RLS — apenas admin/professor podem ler/escrever
-- ---------------------------------------------------------------------
ALTER TABLE categorias_financeiras   ENABLE ROW LEVEL SECURITY;
ALTER TABLE formas_pagamento         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_financeiros  ENABLE ROW LEVEL SECURITY;

-- Função helper inline para checar se utilizador é staff (admin/professor)
-- (não criar função, usar EXISTS directamente para consistência com mensalidades)

-- categorias_financeiras
CREATE POLICY "categorias_financeiras_select" ON categorias_financeiras
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "categorias_financeiras_insert" ON categorias_financeiras
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "categorias_financeiras_update" ON categorias_financeiras
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "categorias_financeiras_delete" ON categorias_financeiras
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );

-- formas_pagamento
CREATE POLICY "formas_pagamento_select" ON formas_pagamento
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "formas_pagamento_insert" ON formas_pagamento
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "formas_pagamento_update" ON formas_pagamento
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "formas_pagamento_delete" ON formas_pagamento
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );

-- fornecedores
CREATE POLICY "fornecedores_select" ON fornecedores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "fornecedores_insert" ON fornecedores
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "fornecedores_update" ON fornecedores
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "fornecedores_delete" ON fornecedores
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );

-- lancamentos_financeiros
CREATE POLICY "lancamentos_select" ON lancamentos_financeiros
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "lancamentos_insert" ON lancamentos_financeiros
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "lancamentos_update" ON lancamentos_financeiros
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );
CREATE POLICY "lancamentos_delete" ON lancamentos_financeiros
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
  );

-- ---------------------------------------------------------------------
-- SEED — plano de contas inicial
-- ---------------------------------------------------------------------
-- Categorias pai (despesa)
WITH pai AS (
  INSERT INTO categorias_financeiras (nome, tipo, parent_id) VALUES
    ('Despesas Fixas',        'despesa', NULL),
    ('Despesas com Pessoal',  'despesa', NULL),
    ('Material',              'despesa', NULL),
    ('Marketing',             'despesa', NULL),
    ('Receitas',              'receita', NULL)
  RETURNING id, nome
)
INSERT INTO categorias_financeiras (nome, tipo, parent_id)
SELECT sub.nome, sub.tipo, pai.id FROM pai JOIN (VALUES
  ('Aluguer',                 'despesa'::tipo_categoria_financeira, 'Despesas Fixas'),
  ('Água',                    'despesa'::tipo_categoria_financeira, 'Despesas Fixas'),
  ('Luz',                     'despesa'::tipo_categoria_financeira, 'Despesas Fixas'),
  ('Internet',                'despesa'::tipo_categoria_financeira, 'Despesas Fixas'),
  ('Salários',                'despesa'::tipo_categoria_financeira, 'Despesas com Pessoal'),
  ('Honorários professores',  'despesa'::tipo_categoria_financeira, 'Despesas com Pessoal'),
  ('Material de treino',      'despesa'::tipo_categoria_financeira, 'Material'),
  ('Material de escritório',  'despesa'::tipo_categoria_financeira, 'Material'),
  ('Anúncios',                'despesa'::tipo_categoria_financeira, 'Marketing'),
  ('Brindes',                 'despesa'::tipo_categoria_financeira, 'Marketing'),
  ('Mensalidades (avulsas)',  'receita'::tipo_categoria_financeira, 'Receitas'),
  ('Exames de graduação',     'receita'::tipo_categoria_financeira, 'Receitas'),
  ('Eventos',                 'receita'::tipo_categoria_financeira, 'Receitas'),
  ('Loja',                    'receita'::tipo_categoria_financeira, 'Receitas')
) AS sub(nome, tipo, pai_nome) ON pai.nome = sub.pai_nome;

-- ---------------------------------------------------------------------
-- SEED — formas de pagamento iniciais
-- ---------------------------------------------------------------------
INSERT INTO formas_pagamento (nome, ordem) VALUES
  ('Dinheiro',                1),
  ('MB Way',                  2),
  ('Transferência bancária',  3),
  ('Multibanco',              4),
  ('Cartão',                  5);
