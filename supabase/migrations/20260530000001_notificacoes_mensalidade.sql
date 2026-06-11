-- Dedup de notificações push por mensalidade.
-- Cada (mensalidade, tipo) só dispara uma vez. Cobre gaps quando o cron falha.
CREATE TABLE IF NOT EXISTS notificacoes_mensalidade_enviadas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensalidade_id uuid NOT NULL REFERENCES mensalidades(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('vence_amanha','vence_hoje','atraso_3d','atraso_7d','atraso_bloqueio')),
  sent_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensalidade_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_notif_mens_lookup
  ON notificacoes_mensalidade_enviadas (mensalidade_id, tipo);

ALTER TABLE notificacoes_mensalidade_enviadas ENABLE ROW LEVEL SECURITY;
