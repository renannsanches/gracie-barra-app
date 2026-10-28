-- Dados estruturados dos posts automáticos (graduação e pódio), lidos pelo feed.
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS dados jsonb;
