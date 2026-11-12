-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE perfil_usuario AS ENUM ('aluno', 'professor', 'admin', 'tablet');
CREATE TYPE categoria_faixa AS ENUM ('adulto', 'infantil');
CREATE TYPE cor_faixa AS ENUM (
  'branca', 'azul', 'roxa', 'marrom', 'preta', 'coral', 'vermelha',
  'cinza', 'amarela', 'laranja', 'verde'
);
CREATE TYPE status_aluno AS ENUM ('ativo', 'inativo', 'trancado');

-- ============================================
-- TABELA: profiles
-- ============================================

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  perfil perfil_usuario NOT NULL DEFAULT 'aluno',
  telefone text,
  data_nascimento date,
  foto_url text,
  categoria categoria_faixa DEFAULT 'adulto',
  faixa cor_faixa DEFAULT 'branca',
  graus smallint DEFAULT 0 CHECK (graus >= 0 AND graus <= 6),
  data_inicio date,
  status status_aluno DEFAULT 'ativo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_profiles_perfil ON profiles(perfil);
CREATE INDEX idx_profiles_status ON profiles(status);

-- ============================================
-- TABELA: presencas
-- Usamos coluna date separada com default, preenchida pela aplicação
-- ou pelo trigger (evita problemas de IMMUTABLE)
-- ============================================

CREATE TABLE presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tablet_id uuid REFERENCES profiles(id),
  registrado_em timestamptz NOT NULL DEFAULT now(),
  dia_registro date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_presencas_aluno ON presencas(aluno_id);
CREATE INDEX idx_presencas_data ON presencas(registrado_em DESC);
CREATE UNIQUE INDEX idx_presencas_unique_dia ON presencas(aluno_id, dia_registro);

-- Trigger para manter dia_registro sincronizado com registrado_em
CREATE OR REPLACE FUNCTION sync_dia_registro()
RETURNS trigger AS $$
BEGIN
  NEW.dia_registro = (NEW.registrado_em AT TIME ZONE 'UTC')::date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_presencas_dia
  BEFORE INSERT OR UPDATE ON presencas
  FOR EACH ROW EXECUTE FUNCTION sync_dia_registro();

-- ============================================
-- TABELA: qr_tokens
-- ============================================

CREATE TABLE qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL,
  usado boolean DEFAULT false,
  usado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX idx_qr_tokens_aluno ON qr_tokens(aluno_id);

-- ============================================
-- TABELA: avisos
-- ============================================

CREATE TABLE avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  autor_id uuid NOT NULL REFERENCES profiles(id),
  fixado boolean DEFAULT false,
  publicado boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_avisos_created ON avisos(created_at DESC);
CREATE INDEX idx_avisos_publicado ON avisos(publicado, fixado);

-- ============================================
-- TABELAS: albuns e fotos
-- ============================================

CREATE TABLE albuns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  capa_url text,
  autor_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid REFERENCES albuns(id) ON DELETE SET NULL,
  url text NOT NULL,
  legenda text,
  autor_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_fotos_album ON fotos(album_id);
CREATE INDEX idx_fotos_created ON fotos(created_at DESC);

-- ============================================
-- TABELA: historico_graduacoes
-- ============================================

CREATE TABLE historico_graduacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  faixa_anterior cor_faixa,
  graus_anterior smallint,
  faixa_nova cor_faixa NOT NULL,
  graus_nova smallint NOT NULL,
  graduado_por uuid REFERENCES profiles(id),
  observacoes text,
  data_graduacao date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_graduacoes_aluno ON historico_graduacoes(aluno_id, data_graduacao DESC);

-- ============================================
-- TRIGGERS GERAIS
-- ============================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tg_avisos_updated BEFORE UPDATE ON avisos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cria profile automaticamente ao cadastrar usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, nome_completo, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email),
    'aluno'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
