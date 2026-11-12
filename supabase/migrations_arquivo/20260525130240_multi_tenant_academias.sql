CREATE TABLE academias (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text          UNIQUE NOT NULL,
  nome             text          NOT NULL,
  email            text          NOT NULL,
  whatsapp         text,
  preco_adulto     numeric(10,2) NOT NULL DEFAULT 62.00,
  preco_infantil   numeric(10,2) NOT NULL DEFAULT 55.00,
  logo_url         text,
  contrato_pdf_url text,
  cor_primaria     text          DEFAULT '#CC0000',
  ativo            boolean       NOT NULL DEFAULT true,
  criado_em        timestamptz   NOT NULL DEFAULT now()
);

INSERT INTO academias (slug, nome, email, preco_adulto, preco_infantil, contrato_pdf_url, cor_primaria)
VALUES (
  'famalicao',
  'Gracie Barra Famalicão',
  'graciebarrafamalicao@gmail.com',
  62.00,
  55.00,
  'https://fjqiyilzxxyoyposqsfz.supabase.co/storage/v1/object/public/Contrato/CONTRATO%20DE%20PRESTACAO%20DE%20SERVICOS%20DESPORTIVOS%20GRACIE%20BARRA%20VILA%20NOVA%20DE%20FAMALICAO.pdf',
  '#CC0000'
);

ALTER TABLE profiles             ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE presencas            ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE qr_tokens            ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE mensalidades         ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE turmas               ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE aulas                ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE reservas             ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE historico_graduacoes ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE dependentes          ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE avisos               ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE albuns               ADD COLUMN academia_id uuid REFERENCES academias(id);
ALTER TABLE fotos                ADD COLUMN academia_id uuid REFERENCES academias(id);

UPDATE profiles             SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE presencas            SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE qr_tokens            SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE mensalidades         SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE turmas               SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE aulas                SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE reservas             SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE historico_graduacoes SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE dependentes          SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE avisos               SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE albuns               SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
UPDATE fotos                SET academia_id = (SELECT id FROM academias WHERE slug = 'famalicao') WHERE academia_id IS NULL;
