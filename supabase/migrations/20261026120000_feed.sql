-- Feed da academia (spec 2026-10-26). Só o servidor (service_role) lê e escreve:
-- os nomes/fotos de autores e de quem comenta vêm de profiles, que o RLS não deixa
-- o aluno ler — por isso tudo passa pelo admin client, como em conquistas.
CREATE TABLE feed_posts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL, -- null = academia (posts automáticos)
  tipo        text        NOT NULL DEFAULT 'manual' CHECK (tipo IN ('manual', 'graduacao', 'podio')),
  texto       text        NOT NULL DEFAULT '' CHECK (char_length(texto) <= 2000),
  fotos       text[]      NOT NULL DEFAULT '{}' CHECK (cardinality(fotos) <= 10),
  referencia  text,       -- posts automáticos: id da graduação / mês do pódio
  criado_em   timestamptz NOT NULL DEFAULT now(),
  editado_em  timestamptz,
  UNIQUE (tipo, referencia)
);
CREATE INDEX feed_posts_ordem ON feed_posts (criado_em DESC, id DESC);

CREATE TABLE feed_curtidas (
  post_id   uuid        NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE feed_comentarios (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   uuid        NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  autor_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  texto     text        NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 300),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feed_comentarios_post ON feed_comentarios (post_id, criado_em);

ALTER TABLE feed_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_curtidas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comentarios ENABLE ROW LEVEL SECURITY;
-- Sem policies: só service_role.
REVOKE ALL ON feed_posts, feed_curtidas, feed_comentarios FROM anon;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feed', 'feed', true, 5242880, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;
