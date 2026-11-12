-- Formulário público de agendamento de aula experimental (/aula-experimental)
-- =============================================================================

ALTER TABLE turmas ADD COLUMN apenas_experimental boolean NOT NULL DEFAULT false;

CREATE TABLE agendamentos_experimental (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id           uuid        NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  tipo              text        NOT NULL CHECK (tipo IN ('adulto','infantil')),
  nome              text,
  nome_responsavel  text,
  nome_aluno        text,
  idade             int,
  telefone          text        NOT NULL,
  criado_em         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agendamentos_experimental_aula_idx ON agendamentos_experimental(aula_id);

ALTER TABLE agendamentos_experimental ENABLE ROW LEVEL SECURITY;

-- Sem policy de INSERT: a Server Action pública usa createAdminClient() (bypassa RLS).
CREATE POLICY "agendamentos_experimental_select" ON agendamentos_experimental FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil IN ('admin','professor'))
);
