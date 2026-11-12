-- Reconstruído a partir do schema em produção — não havia registo de migration
-- para estas tabelas (drift). Fase 16: notificações push + dedupe de graduações.

CREATE TABLE push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user own subscriptions" ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE notificacoes_graduacao_enviadas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  faixa       text        NOT NULL,
  enviado_em  timestamptz DEFAULT now(),
  UNIQUE (aluno_id, faixa)
);

ALTER TABLE notificacoes_graduacao_enviadas ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role lê/escreve (admin client).
