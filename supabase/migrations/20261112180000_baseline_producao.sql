-- =============================================================================
-- Baseline do schema de produção (T1 do roadmap SaaS, 2026-11-12)
-- =============================================================================
-- Substitui as 61 migrations antigas (agora em supabase/migrations_arquivo/),
-- que não reproduziam a BD real: houve SQL corrido à mão no Dashboard.
--
-- Origem: pg_dump 17.8 --schema-only --schema=public --no-owner da produção
-- (Postgres 17.6), mais os objectos de produção fora de `public` (secção 3).
-- Prova: supabase/verificar-schema.sql dá o mesmo resultado em produção e num
-- projecto novo com esta migration aplicada.
--
-- NÃO inclui: dados, configuração de Auth (templates de email, Site URL,
-- Redirect URLs), env vars, nem os buckets vazios e sem uso `comprovativos` e
-- `Gracie Barra Famalicao` (ficam só em produção).
--
-- Retirado do dump: comentários automáticos, os comandos restrict/unrestrict
-- do psql, CREATE SCHEMA public e o seu
-- COMMENT (o schema já existe em qualquer projecto Supabase) e os ALTER
-- DEFAULT PRIVILEGES do papel supabase_admin (geridos pela plataforma).
-- =============================================================================

-- 1. Extensões (já vêm activas num projecto Supabase; garantir)
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- 2. Schema public (pg_dump)


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE TYPE public.categoria_faixa AS ENUM (
    'adulto',
    'infantil',
    'adulto_infantil'
);

CREATE TYPE public.cor_faixa AS ENUM (
    'branca',
    'azul',
    'roxa',
    'marrom',
    'preta',
    'coral',
    'vermelha',
    'cinza',
    'amarela',
    'laranja',
    'verde',
    'cinza_branca',
    'cinza_preta',
    'amarela_branca',
    'amarela_preta',
    'laranja_branca',
    'laranja_preta',
    'verde_branca',
    'verde_preta'
);

CREATE TYPE public.perfil_usuario AS ENUM (
    'aluno',
    'professor',
    'admin',
    'tablet',
    'responsavel'
);

CREATE TYPE public.recorrencia_turma AS ENUM (
    'semanal',
    'quinzenal',
    'mensal',
    'personalizado',
    'diario'
);

CREATE TYPE public.status_aluno AS ENUM (
    'ativo',
    'inativo',
    'trancado'
);

CREATE TYPE public.status_aula AS ENUM (
    'agendada',
    'cancelada',
    'concluida'
);

CREATE TYPE public.status_lancamento AS ENUM (
    'pendente',
    'pago',
    'atrasado',
    'cancelado'
);

CREATE TYPE public.status_mensalidade AS ENUM (
    'pendente',
    'pago',
    'atrasado'
);

CREATE TYPE public.status_reserva AS ENUM (
    'confirmada',
    'cancelada',
    'presente'
);

CREATE TYPE public.tipo_categoria_financeira AS ENUM (
    'despesa',
    'receita'
);

CREATE TYPE public.tipo_fornecedor AS ENUM (
    'fornecedor',
    'cliente',
    'funcionario',
    'outro'
);

CREATE TYPE public.tipo_lancamento AS ENUM (
    'pagar',
    'receber'
);

CREATE FUNCTION public.dias_treino_alunos(p_aluno_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(aluno_id uuid, dias date[])
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT p.aluno_id,
         array_agg((p.registrado_em AT TIME ZONE 'Europe/Lisbon')::date ORDER BY p.registrado_em)
  FROM presencas p
  WHERE p.registrado_em >= '2020-01-01'
    AND (p_aluno_ids IS NULL OR p.aluno_id = ANY (p_aluno_ids))
  GROUP BY p.aluno_id;
$$;

CREATE FUNCTION public.e_meu_dependente(p_aluno_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM dependentes
    WHERE responsavel_id = auth.uid() AND dependente_id = p_aluno_id
  );
$$;

CREATE FUNCTION public.gerar_aulas(p_turma_id uuid, p_semanas integer DEFAULT 4) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_turma   turmas%ROWTYPE;
  v_data    date;
  v_hoje    date := CURRENT_DATE;
  v_fim     date;
  v_rows    int;
  v_criadas int := 0;
  v_diff    int;
  v_dow     int;
BEGIN
  SELECT * INTO v_turma FROM turmas WHERE id = p_turma_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turma não encontrada: %', p_turma_id; END IF;

  v_fim := v_hoje + (p_semanas * 7);

  IF v_turma.recorrencia = 'diario' THEN
    v_data := v_hoje;
    v_dow  := EXTRACT(DOW FROM v_data)::int;
    IF    v_dow = 6 THEN v_data := v_data + 2;
    ELSIF v_dow = 0 THEN v_data := v_data + 1;
    END IF;
  ELSE
    v_diff := (v_turma.dia_semana - EXTRACT(DOW FROM v_hoje)::int + 7) % 7;
    v_data := v_hoje + v_diff;
  END IF;

  WHILE v_data <= v_fim LOOP
    INSERT INTO aulas (turma_id, data, horario, lotacao_maxima, status)
    VALUES (p_turma_id, v_data, v_turma.horario, v_turma.lotacao_maxima, 'agendada')
    ON CONFLICT (turma_id, data, horario) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_criadas := v_criadas + v_rows;

    CASE v_turma.recorrencia
      WHEN 'semanal'   THEN v_data := v_data + 7;
      WHEN 'quinzenal' THEN v_data := v_data + 14;
      WHEN 'mensal'    THEN v_data := v_data + 28;
      WHEN 'diario'    THEN
        v_data := v_data + 1;
        v_dow  := EXTRACT(DOW FROM v_data)::int;
        IF    v_dow = 6 THEN v_data := v_data + 2;
        ELSIF v_dow = 0 THEN v_data := v_data + 1;
        END IF;
      ELSE v_data := v_data + 7;
    END CASE;
  END LOOP;

  RETURN v_criadas;
END;
$$;

CREATE FUNCTION public.gerar_qr_token(p_aluno_ids uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_token TEXT;
  v_expira TIMESTAMPTZ;
  v_ids UUID[];
BEGIN
  IF p_aluno_ids IS NULL OR array_length(p_aluno_ids, 1) IS NULL THEN
    v_ids := ARRAY[auth.uid()];
  ELSE
    IF NOT (
      SELECT bool_and(
        uid = auth.uid() 
        OR EXISTS (SELECT 1 FROM dependentes WHERE responsavel_id = auth.uid() AND dependente_id = uid)
      )
      FROM unnest(p_aluno_ids) AS uid
    ) THEN
      RETURN jsonb_build_object('sucesso', false, 'mensagem', 'IDs inválidos');
    END IF;
    v_ids := p_aluno_ids;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expira := NOW() + INTERVAL '60 seconds';

  INSERT INTO qr_tokens (token, aluno_id, aluno_ids, expira_em)
  VALUES (v_token, auth.uid(), v_ids, v_expira);

  RETURN jsonb_build_object(
    'sucesso', true,
    'token', v_token,
    'expira_em', v_expira,
    'aluno_ids', to_jsonb(v_ids)
  );
END;
$$;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  -- ON CONFLICT: permite religar um utilizador Auth a um perfil que já existe
  -- (ex.: recuperar uma conta apagada do Auth com o mesmo id).
  INSERT INTO profiles (id, nome_completo, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email),
    'aluno'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND perfil = 'admin'
  );
$$;

CREATE FUNCTION public.is_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND perfil IN ('admin', 'professor')
  );
$$;

CREATE FUNCTION public.is_tablet() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND perfil = 'tablet'
  );
$$;

CREATE FUNCTION public.limpar_tokens_expirados() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  deletados integer;
BEGIN
  DELETE FROM qr_tokens
  WHERE expira_em < now() - interval '1 hour'
  RETURNING 1 INTO deletados;

  GET DIAGNOSTICS deletados = ROW_COUNT;
  RETURN deletados;
END;
$$;

CREATE FUNCTION public.proteger_colunas_profiles() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_permitidas text[] := ARRAY['nome_completo', 'telefone', 'data_nascimento', 'foto_url', 'updated_at'];
BEGIN
  IF current_user <> 'authenticated' OR public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - v_permitidas) IS DISTINCT FROM (to_jsonb(OLD) - v_permitidas) THEN
    RAISE EXCEPTION 'Sem permissão para alterar estes dados do perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.ranking_presencas(p_inicio date, p_fim date) RETURNS TABLE(aluno_id uuid, nome_completo text, foto_url text, faixa text, graus integer, categoria text, aulas integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT pr.id, pr.nome_completo, pr.foto_url, pr.faixa::text, coalesce(pr.graus, 0)::int,
         pr.categoria::text, count(*)::int
  FROM presencas p
  JOIN profiles pr ON pr.id = p.aluno_id
  WHERE p.registrado_em >= (p_inicio::timestamp AT TIME ZONE 'Europe/Lisbon')
    AND p.registrado_em <  ((p_fim + 1)::timestamp AT TIME ZONE 'Europe/Lisbon')
    AND pr.perfil = 'aluno'
    AND pr.status = 'ativo'
    AND NOT pr.ocultar_ranking
  GROUP BY pr.id;
$$;

CREATE FUNCTION public.registrar_presenca_por_token(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_token_row RECORD;
  v_aluno RECORD;
  v_uid UUID;
  v_resultados JSONB := '[]'::JSONB;
  v_algum_sucesso BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_token_row FROM qr_tokens WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Token inválido');
  END IF;

  IF v_token_row.usado THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Token já utilizado');
  END IF;

  IF v_token_row.expira_em < NOW() THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Token expirado');
  END IF;

  -- Verificar bloqueio financeiro ANTES de marcar token como usado
  -- (token fica disponível para tentar de novo após regularizar)
  FOREACH v_uid IN ARRAY v_token_row.aluno_ids
  LOOP
    IF verificar_bloqueio_financeiro(v_uid) THEN
      RAISE EXCEPTION 'mensalidade_bloqueada';
    END IF;
  END LOOP;

  -- Marcar token como usado
  UPDATE qr_tokens SET usado = TRUE WHERE token = p_token;

  -- Registrar presença para cada aluno_id
  FOREACH v_uid IN ARRAY v_token_row.aluno_ids
  LOOP
    SELECT id, nome_completo, foto_url, faixa, graus INTO v_aluno
    FROM profiles WHERE id = v_uid;

    IF FOUND THEN
      INSERT INTO presencas (aluno_id, registrado_em)
      VALUES (v_uid, NOW());

      v_algum_sucesso := TRUE;
      v_resultados := v_resultados || jsonb_build_object(
        'aluno_id', v_uid,
        'aluno_nome', v_aluno.nome_completo,
        'aluno_foto', v_aluno.foto_url,
        'aluno_faixa', v_aluno.faixa,
        'aluno_graus', v_aluno.graus
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'sucesso', v_algum_sucesso,
    'mensagem', CASE WHEN v_algum_sucesso THEN 'Presença(s) registrada(s)' ELSE 'Nenhum aluno encontrado' END,
    'alunos', v_resultados
  );
END;
$$;

CREATE FUNCTION public.semanas_com_treino() RETURNS date[]
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(array_agg(semana ORDER BY semana), '{}')
  FROM (
    SELECT DISTINCT date_trunc('week', p.registrado_em AT TIME ZONE 'Europe/Lisbon')::date AS semana
    FROM presencas p
    WHERE p.registrado_em >= '2020-01-01'
  ) s;
$$;

CREATE FUNCTION public.set_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_dia_registro() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.dia_registro = (NEW.registrado_em AT TIME ZONE 'UTC')::date;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.verificar_bloqueio_financeiro(p_aluno_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM mensalidades
    WHERE aluno_id = p_aluno_id
      AND status <> 'pago'
      AND data_vencimento <= CURRENT_DATE - INTERVAL '10 days'
  );
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.academias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    whatsapp text,
    preco_adulto numeric(10,2) DEFAULT 62.00 NOT NULL,
    preco_infantil numeric(10,2) DEFAULT 55.00 NOT NULL,
    logo_url text,
    contrato_pdf_url text,
    cor_primaria text DEFAULT '#CC0000'::text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.agendamentos_experimental (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aula_id uuid NOT NULL,
    tipo text NOT NULL,
    nome text,
    nome_responsavel text,
    nome_aluno text,
    idade integer,
    telefone text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agendamentos_experimental_tipo_check CHECK ((tipo = ANY (ARRAY['adulto'::text, 'infantil'::text])))
);

CREATE TABLE public.albuns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    capa_url text,
    autor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    academia_id uuid
);

CREATE TABLE public.aluno_descontos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    descricao text NOT NULL,
    valor numeric(10,2) NOT NULL,
    origem_modalidade_id uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aluno_descontos_descricao_check CHECK (((char_length(btrim(descricao)) >= 1) AND (char_length(btrim(descricao)) <= 60))),
    CONSTRAINT aluno_descontos_valor_check CHECK ((valor > (0)::numeric))
);

CREATE TABLE public.aluno_modalidades (
    aluno_id uuid NOT NULL,
    modalidade_id uuid NOT NULL,
    valor numeric(10,2) DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    cobrar boolean DEFAULT true NOT NULL,
    CONSTRAINT aluno_modalidades_valor_check CHECK ((valor >= (0)::numeric))
);

CREATE TABLE public.aulas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turma_id uuid NOT NULL,
    data date NOT NULL,
    horario time without time zone NOT NULL,
    lotacao_maxima integer NOT NULL,
    status public.status_aula DEFAULT 'agendada'::public.status_aula NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    academia_id uuid,
    CONSTRAINT aulas_lotacao_maxima_check CHECK ((lotacao_maxima > 0))
);

CREATE TABLE public.avisos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    conteudo text NOT NULL,
    autor_id uuid NOT NULL,
    fixado boolean DEFAULT false,
    publicado boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    academia_id uuid
);

CREATE TABLE public.categorias_financeiras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    tipo public.tipo_categoria_financeira NOT NULL,
    parent_id uuid,
    ativa boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.conquistas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    codigo text NOT NULL,
    referencia text DEFAULT ''::text NOT NULL,
    conquistada_em date NOT NULL,
    vista_em timestamp with time zone,
    notificada_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.dependentes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    responsavel_id uuid NOT NULL,
    dependente_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    academia_id uuid
);

CREATE TABLE public.feed_comentarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    texto text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feed_comentarios_texto_check CHECK (((char_length(texto) >= 1) AND (char_length(texto) <= 300)))
);

CREATE TABLE public.feed_curtidas (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.feed_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    autor_id uuid,
    tipo text DEFAULT 'manual'::text NOT NULL,
    texto text DEFAULT ''::text NOT NULL,
    fotos text[] DEFAULT '{}'::text[] NOT NULL,
    referencia text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    editado_em timestamp with time zone,
    dados jsonb,
    CONSTRAINT feed_posts_fotos_check CHECK ((cardinality(fotos) <= 10)),
    CONSTRAINT feed_posts_texto_check CHECK ((char_length(texto) <= 2000)),
    CONSTRAINT feed_posts_tipo_check CHECK ((tipo = ANY (ARRAY['manual'::text, 'graduacao'::text, 'podio'::text])))
);

CREATE TABLE public.formas_pagamento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    ativa boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fornecedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    tipo public.tipo_fornecedor DEFAULT 'fornecedor'::public.tipo_fornecedor NOT NULL,
    nif text,
    email text,
    telefone text,
    notas text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fotos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    album_id uuid,
    url text NOT NULL,
    legenda text,
    autor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    academia_id uuid
);

CREATE TABLE public.grupos_alunos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    padrao boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grupos_alunos_nome_check CHECK (((char_length(btrim(nome)) >= 1) AND (char_length(btrim(nome)) <= 40))),
    CONSTRAINT grupos_alunos_padrao_ativo CHECK (((NOT padrao) OR ativo))
);

CREATE TABLE public.historico_graduacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    faixa_anterior public.cor_faixa,
    graus_anterior smallint,
    faixa_nova public.cor_faixa NOT NULL,
    graus_nova smallint NOT NULL,
    graduado_por uuid,
    observacoes text,
    data_graduacao date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    academia_id uuid
);

CREATE TABLE public.lancamentos_financeiros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo public.tipo_lancamento NOT NULL,
    descricao text NOT NULL,
    fornecedor_id uuid,
    categoria_id uuid,
    data_vencimento date NOT NULL,
    valor numeric(10,2) NOT NULL,
    status public.status_lancamento DEFAULT 'pendente'::public.status_lancamento NOT NULL,
    data_pagamento date,
    forma_pagamento_id uuid,
    comprovativo_url text,
    notas text,
    grupo_id uuid,
    parcela_numero integer,
    parcela_total integer,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    criado_por uuid,
    aluno_id uuid,
    CONSTRAINT lancamentos_financeiros_valor_check CHECK ((valor > (0)::numeric))
);

CREATE TABLE public.mensalidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    mes_referencia date NOT NULL,
    data_vencimento date NOT NULL,
    valor numeric(10,2) NOT NULL,
    status public.status_mensalidade DEFAULT 'pendente'::public.status_mensalidade NOT NULL,
    data_pagamento date,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    academia_id uuid,
    itens jsonb
);

CREATE TABLE public.modalidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    valor numeric(10,2) DEFAULT 0 NOT NULL,
    valor_infantil numeric(10,2),
    ativo boolean DEFAULT true NOT NULL,
    padrao boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    grupo_id uuid DEFAULT 'f1a2b776-86b0-46d0-8ea2-d5cb7b290aad'::uuid NOT NULL,
    desconta_noutro_local boolean DEFAULT false NOT NULL,
    CONSTRAINT modalidades_nome_check CHECK (((char_length(btrim(nome)) >= 1) AND (char_length(btrim(nome)) <= 40))),
    CONSTRAINT modalidades_padrao_ativo CHECK (((NOT padrao) OR ativo)),
    CONSTRAINT modalidades_valor_check CHECK ((valor >= (0)::numeric)),
    CONSTRAINT modalidades_valor_infantil_check CHECK ((valor_infantil >= (0)::numeric))
);

CREATE TABLE public.notificacoes_graduacao_enviadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    faixa text NOT NULL,
    enviado_em timestamp with time zone DEFAULT now()
);

CREATE TABLE public.notificacoes_mensalidade_enviadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mensalidade_id uuid NOT NULL,
    tipo text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notificacoes_mensalidade_enviadas_tipo_check CHECK ((tipo = ANY (ARRAY['vence_amanha'::text, 'vence_hoje'::text, 'atraso_3d'::text, 'atraso_7d'::text, 'atraso_bloqueio'::text])))
);

CREATE TABLE public.presencas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    tablet_id uuid,
    registrado_em timestamp with time zone DEFAULT now() NOT NULL,
    dia_registro date DEFAULT ((now() AT TIME ZONE 'UTC'::text))::date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    academia_id uuid
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nome_completo text NOT NULL,
    perfil public.perfil_usuario DEFAULT 'aluno'::public.perfil_usuario NOT NULL,
    telefone text,
    data_nascimento date,
    foto_url text,
    categoria public.categoria_faixa DEFAULT 'adulto'::public.categoria_faixa,
    faixa public.cor_faixa DEFAULT 'branca'::public.cor_faixa,
    graus smallint DEFAULT 0,
    data_inicio date,
    status public.status_aluno DEFAULT 'ativo'::public.status_aluno,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    iban text,
    aulas_manual integer DEFAULT 0 NOT NULL,
    sem_login boolean DEFAULT false,
    contacto_emergencia text,
    nif text,
    academia_id uuid,
    grupo_id uuid,
    ocultar_ranking boolean DEFAULT false NOT NULL,
    CONSTRAINT profiles_graus_check CHECK (((graus >= 0) AND (graus <= 6)))
);

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.qr_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    token text NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    usado boolean DEFAULT false,
    usado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    aluno_ids uuid[] DEFAULT '{}'::uuid[],
    academia_id uuid
);

CREATE TABLE public.reservas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aula_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    status public.status_reserva DEFAULT 'confirmada'::public.status_reserva NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    academia_id uuid
);

CREATE TABLE public.turmas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    dia_semana integer NOT NULL,
    horario time without time zone NOT NULL,
    recorrencia public.recorrencia_turma DEFAULT 'semanal'::public.recorrencia_turma NOT NULL,
    lotacao_maxima integer DEFAULT 20 NOT NULL,
    categoria public.categoria_faixa DEFAULT 'adulto'::public.categoria_faixa NOT NULL,
    professor_id uuid,
    ativa boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    academia_id uuid,
    apenas_experimental boolean DEFAULT false NOT NULL,
    modalidade_id uuid DEFAULT '76043248-42d7-46d5-a647-cc7cdae6719b'::uuid NOT NULL,
    CONSTRAINT turmas_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6))),
    CONSTRAINT turmas_lotacao_maxima_check CHECK ((lotacao_maxima > 0))
);

ALTER TABLE ONLY public.academias
    ADD CONSTRAINT academias_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.academias
    ADD CONSTRAINT academias_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.agendamentos_experimental
    ADD CONSTRAINT agendamentos_experimental_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.albuns
    ADD CONSTRAINT albuns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aluno_descontos
    ADD CONSTRAINT aluno_descontos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aluno_modalidades
    ADD CONSTRAINT aluno_modalidades_pkey PRIMARY KEY (aluno_id, modalidade_id);

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT avisos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.categorias_financeiras
    ADD CONSTRAINT categorias_financeiras_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conquistas
    ADD CONSTRAINT conquistas_aluno_id_codigo_referencia_key UNIQUE (aluno_id, codigo, referencia);

ALTER TABLE ONLY public.conquistas
    ADD CONSTRAINT conquistas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dependentes
    ADD CONSTRAINT dependentes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dependentes
    ADD CONSTRAINT dependentes_responsavel_id_dependente_id_key UNIQUE (responsavel_id, dependente_id);

ALTER TABLE ONLY public.feed_comentarios
    ADD CONSTRAINT feed_comentarios_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.feed_curtidas
    ADD CONSTRAINT feed_curtidas_pkey PRIMARY KEY (post_id, user_id);

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_tipo_referencia_key UNIQUE (tipo, referencia);

ALTER TABLE ONLY public.formas_pagamento
    ADD CONSTRAINT formas_pagamento_nome_key UNIQUE (nome);

ALTER TABLE ONLY public.formas_pagamento
    ADD CONSTRAINT formas_pagamento_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fornecedores
    ADD CONSTRAINT fornecedores_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fotos
    ADD CONSTRAINT fotos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.grupos_alunos
    ADD CONSTRAINT grupos_alunos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.historico_graduacoes
    ADD CONSTRAINT historico_graduacoes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT lancamentos_financeiros_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mensalidades
    ADD CONSTRAINT mensalidades_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.modalidades
    ADD CONSTRAINT modalidades_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notificacoes_graduacao_enviadas
    ADD CONSTRAINT notificacoes_graduacao_enviadas_aluno_id_faixa_key UNIQUE (aluno_id, faixa);

ALTER TABLE ONLY public.notificacoes_graduacao_enviadas
    ADD CONSTRAINT notificacoes_graduacao_enviadas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notificacoes_mensalidade_enviadas
    ADD CONSTRAINT notificacoes_mensalidade_enviadas_mensalidade_id_tipo_key UNIQUE (mensalidade_id, tipo);

ALTER TABLE ONLY public.notificacoes_mensalidade_enviadas
    ADD CONSTRAINT notificacoes_mensalidade_enviadas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);

ALTER TABLE ONLY public.qr_tokens
    ADD CONSTRAINT qr_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.qr_tokens
    ADD CONSTRAINT qr_tokens_token_key UNIQUE (token);

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_pkey PRIMARY KEY (id);

CREATE INDEX agendamentos_experimental_aula_idx ON public.agendamentos_experimental USING btree (aula_id);

CREATE INDEX aluno_descontos_aluno_idx ON public.aluno_descontos USING btree (aluno_id);

CREATE INDEX aluno_modalidades_modalidade_idx ON public.aluno_modalidades USING btree (modalidade_id);

CREATE INDEX aulas_data_idx ON public.aulas USING btree (data);

CREATE INDEX aulas_status_idx ON public.aulas USING btree (status);

CREATE UNIQUE INDEX aulas_turma_data_horario_idx ON public.aulas USING btree (turma_id, data, horario);

CREATE INDEX aulas_turma_idx ON public.aulas USING btree (turma_id);

CREATE INDEX categorias_financeiras_parent_idx ON public.categorias_financeiras USING btree (parent_id);

CREATE INDEX categorias_financeiras_tipo_idx ON public.categorias_financeiras USING btree (tipo);

CREATE INDEX feed_comentarios_post ON public.feed_comentarios USING btree (post_id, criado_em);

CREATE INDEX feed_posts_ordem ON public.feed_posts USING btree (criado_em DESC, id DESC);

CREATE INDEX fornecedores_nome_idx ON public.fornecedores USING btree (lower(nome));

CREATE INDEX fornecedores_tipo_idx ON public.fornecedores USING btree (tipo);

CREATE UNIQUE INDEX grupos_alunos_nome_unico ON public.grupos_alunos USING btree (lower(btrim(nome)));

CREATE UNIQUE INDEX grupos_alunos_um_padrao ON public.grupos_alunos USING btree (padrao) WHERE padrao;

CREATE INDEX idx_avisos_created ON public.avisos USING btree (created_at DESC);

CREATE INDEX idx_avisos_publicado ON public.avisos USING btree (publicado, fixado);

CREATE INDEX idx_fotos_album ON public.fotos USING btree (album_id);

CREATE INDEX idx_fotos_created ON public.fotos USING btree (created_at DESC);

CREATE INDEX idx_graduacoes_aluno ON public.historico_graduacoes USING btree (aluno_id, data_graduacao DESC);

CREATE INDEX idx_notif_mens_lookup ON public.notificacoes_mensalidade_enviadas USING btree (mensalidade_id, tipo);

CREATE INDEX idx_presencas_aluno ON public.presencas USING btree (aluno_id);

CREATE INDEX idx_presencas_data ON public.presencas USING btree (registrado_em DESC);

CREATE INDEX idx_profiles_perfil ON public.profiles USING btree (perfil);

CREATE INDEX idx_profiles_status ON public.profiles USING btree (status);

CREATE INDEX idx_qr_tokens_aluno ON public.qr_tokens USING btree (aluno_id);

CREATE INDEX idx_qr_tokens_token ON public.qr_tokens USING btree (token);

CREATE INDEX lancamentos_aluno_idx ON public.lancamentos_financeiros USING btree (aluno_id);

CREATE INDEX lancamentos_categoria_idx ON public.lancamentos_financeiros USING btree (categoria_id);

CREATE INDEX lancamentos_data_venc_idx ON public.lancamentos_financeiros USING btree (data_vencimento);

CREATE INDEX lancamentos_fornecedor_idx ON public.lancamentos_financeiros USING btree (fornecedor_id);

CREATE INDEX lancamentos_grupo_idx ON public.lancamentos_financeiros USING btree (grupo_id);

CREATE INDEX lancamentos_status_idx ON public.lancamentos_financeiros USING btree (status);

CREATE INDEX lancamentos_tipo_idx ON public.lancamentos_financeiros USING btree (tipo);

CREATE INDEX mensalidades_aluno_id_idx ON public.mensalidades USING btree (aluno_id);

CREATE UNIQUE INDEX mensalidades_aluno_mes_idx ON public.mensalidades USING btree (aluno_id, mes_referencia);

CREATE INDEX mensalidades_mes_referencia_idx ON public.mensalidades USING btree (mes_referencia);

CREATE INDEX modalidades_grupo_idx ON public.modalidades USING btree (grupo_id);

CREATE UNIQUE INDEX modalidades_nome_local_unico ON public.modalidades USING btree (lower(btrim(nome)), grupo_id);

CREATE UNIQUE INDEX modalidades_um_padrao ON public.modalidades USING btree (padrao) WHERE padrao;

CREATE INDEX profiles_grupo_id_idx ON public.profiles USING btree (grupo_id);

CREATE INDEX reservas_aluno_idx ON public.reservas USING btree (aluno_id);

CREATE UNIQUE INDEX reservas_aula_aluno_idx ON public.reservas USING btree (aula_id, aluno_id);

CREATE INDEX reservas_aula_idx ON public.reservas USING btree (aula_id);

CREATE INDEX turmas_ativa_idx ON public.turmas USING btree (ativa);

CREATE INDEX turmas_categoria_idx ON public.turmas USING btree (categoria);

CREATE INDEX turmas_modalidade_idx ON public.turmas USING btree (modalidade_id);

CREATE TRIGGER grupos_alunos_set_atualizado_em BEFORE UPDATE ON public.grupos_alunos FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TRIGGER lancamentos_set_atualizado_em BEFORE UPDATE ON public.lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TRIGGER mensalidades_set_atualizado_em BEFORE UPDATE ON public.mensalidades FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TRIGGER modalidades_set_atualizado_em BEFORE UPDATE ON public.modalidades FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TRIGGER tg_avisos_updated BEFORE UPDATE ON public.avisos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tg_presencas_dia BEFORE INSERT OR UPDATE ON public.presencas FOR EACH ROW EXECUTE FUNCTION public.sync_dia_registro();

CREATE TRIGGER tg_profiles_proteger_colunas BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.proteger_colunas_profiles();

CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER turmas_set_atualizado_em BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

ALTER TABLE ONLY public.agendamentos_experimental
    ADD CONSTRAINT agendamentos_experimental_aula_id_fkey FOREIGN KEY (aula_id) REFERENCES public.aulas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.albuns
    ADD CONSTRAINT albuns_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.albuns
    ADD CONSTRAINT albuns_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.aluno_descontos
    ADD CONSTRAINT aluno_descontos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.aluno_descontos
    ADD CONSTRAINT aluno_descontos_origem_modalidade_id_fkey FOREIGN KEY (origem_modalidade_id) REFERENCES public.modalidades(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.aluno_modalidades
    ADD CONSTRAINT aluno_modalidades_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.aluno_modalidades
    ADD CONSTRAINT aluno_modalidades_modalidade_id_fkey FOREIGN KEY (modalidade_id) REFERENCES public.modalidades(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT avisos_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT avisos_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.categorias_financeiras
    ADD CONSTRAINT categorias_financeiras_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categorias_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.conquistas
    ADD CONSTRAINT conquistas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dependentes
    ADD CONSTRAINT dependentes_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.dependentes
    ADD CONSTRAINT dependentes_dependente_id_fkey FOREIGN KEY (dependente_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dependentes
    ADD CONSTRAINT dependentes_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_comentarios
    ADD CONSTRAINT feed_comentarios_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_comentarios
    ADD CONSTRAINT feed_comentarios_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_curtidas
    ADD CONSTRAINT feed_curtidas_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_curtidas
    ADD CONSTRAINT feed_curtidas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fotos
    ADD CONSTRAINT fotos_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.fotos
    ADD CONSTRAINT fotos_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albuns(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fotos
    ADD CONSTRAINT fotos_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.historico_graduacoes
    ADD CONSTRAINT historico_graduacoes_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.historico_graduacoes
    ADD CONSTRAINT historico_graduacoes_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.historico_graduacoes
    ADD CONSTRAINT historico_graduacoes_graduado_por_fkey FOREIGN KEY (graduado_por) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT lancamentos_financeiros_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT lancamentos_financeiros_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT lancamentos_financeiros_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT lancamentos_financeiros_forma_pagamento_id_fkey FOREIGN KEY (forma_pagamento_id) REFERENCES public.formas_pagamento(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT lancamentos_financeiros_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mensalidades
    ADD CONSTRAINT mensalidades_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.mensalidades
    ADD CONSTRAINT mensalidades_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.modalidades
    ADD CONSTRAINT modalidades_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_alunos(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.notificacoes_graduacao_enviadas
    ADD CONSTRAINT notificacoes_graduacao_enviadas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notificacoes_mensalidade_enviadas
    ADD CONSTRAINT notificacoes_mensalidade_enviadas_mensalidade_id_fkey FOREIGN KEY (mensalidade_id) REFERENCES public.mensalidades(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_tablet_id_fkey FOREIGN KEY (tablet_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_alunos(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.qr_tokens
    ADD CONSTRAINT qr_tokens_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.qr_tokens
    ADD CONSTRAINT qr_tokens_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_aula_id_fkey FOREIGN KEY (aula_id) REFERENCES public.aulas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES public.academias(id);

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_modalidade_id_fkey FOREIGN KEY (modalidade_id) REFERENCES public.modalidades(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE POLICY "Responsável vê seus dependentes" ON public.dependentes FOR SELECT TO authenticated USING ((responsavel_id = auth.uid()));

CREATE POLICY "Staff gerencia dependentes" ON public.dependentes TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.academias ENABLE ROW LEVEL SECURITY;

CREATE POLICY academias_read_authenticated ON public.academias FOR SELECT TO authenticated USING (true);

ALTER TABLE public.agendamentos_experimental ENABLE ROW LEVEL SECURITY;

CREATE POLICY agendamentos_experimental_select ON public.agendamentos_experimental FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.albuns ENABLE ROW LEVEL SECURITY;

CREATE POLICY albuns_delete_staff ON public.albuns FOR DELETE TO authenticated USING (public.is_staff());

CREATE POLICY albuns_insert_staff ON public.albuns FOR INSERT TO authenticated WITH CHECK (public.is_staff());

CREATE POLICY albuns_select_all ON public.albuns FOR SELECT TO authenticated USING (true);

CREATE POLICY albuns_update_staff ON public.albuns FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.aluno_descontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY aluno_descontos_delete ON public.aluno_descontos FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY aluno_descontos_insert ON public.aluno_descontos FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY aluno_descontos_select ON public.aluno_descontos FOR SELECT USING (((auth.uid() = aluno_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))) OR (EXISTS ( SELECT 1
   FROM public.dependentes
  WHERE ((dependentes.responsavel_id = auth.uid()) AND (dependentes.dependente_id = aluno_descontos.aluno_id))))));

CREATE POLICY aluno_descontos_update ON public.aluno_descontos FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.aluno_modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY aluno_modalidades_delete ON public.aluno_modalidades FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY aluno_modalidades_insert ON public.aluno_modalidades FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY aluno_modalidades_select ON public.aluno_modalidades FOR SELECT USING (((auth.uid() = aluno_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))) OR (EXISTS ( SELECT 1
   FROM public.dependentes
  WHERE ((dependentes.responsavel_id = auth.uid()) AND (dependentes.dependente_id = aluno_modalidades.aluno_id))))));

CREATE POLICY aluno_modalidades_update ON public.aluno_modalidades FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY aulas_delete ON public.aulas FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY aulas_insert ON public.aulas FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY aulas_select ON public.aulas FOR SELECT USING ((auth.uid() IS NOT NULL));

CREATE POLICY aulas_update ON public.aulas FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY avisos_delete_staff ON public.avisos FOR DELETE TO authenticated USING (public.is_staff());

CREATE POLICY avisos_insert_staff ON public.avisos FOR INSERT TO authenticated WITH CHECK (public.is_staff());

CREATE POLICY avisos_select_published ON public.avisos FOR SELECT TO authenticated USING (((publicado = true) OR public.is_staff()));

CREATE POLICY avisos_update_staff ON public.avisos FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY categorias_financeiras_delete ON public.categorias_financeiras FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY categorias_financeiras_insert ON public.categorias_financeiras FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY categorias_financeiras_select ON public.categorias_financeiras FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY categorias_financeiras_update ON public.categorias_financeiras FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.conquistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY conquistas_select ON public.conquistas FOR SELECT TO authenticated USING (((auth.uid() = aluno_id) OR public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.dependentes
  WHERE ((dependentes.responsavel_id = auth.uid()) AND (dependentes.dependente_id = conquistas.aluno_id))))));

ALTER TABLE public.dependentes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feed_comentarios ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feed_curtidas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY formas_pagamento_delete ON public.formas_pagamento FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY formas_pagamento_insert ON public.formas_pagamento FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY formas_pagamento_select ON public.formas_pagamento FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY formas_pagamento_update ON public.formas_pagamento FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY fornecedores_delete ON public.fornecedores FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY fornecedores_insert ON public.fornecedores FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY fornecedores_select ON public.fornecedores FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY fornecedores_update ON public.fornecedores FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY fotos_delete_staff ON public.fotos FOR DELETE TO authenticated USING (public.is_staff());

CREATE POLICY fotos_insert_staff ON public.fotos FOR INSERT TO authenticated WITH CHECK (public.is_staff());

CREATE POLICY fotos_select_all ON public.fotos FOR SELECT TO authenticated USING (true);

CREATE POLICY fotos_update_staff ON public.fotos FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY graduacoes_delete_admin ON public.historico_graduacoes FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY graduacoes_insert_staff ON public.historico_graduacoes FOR INSERT TO authenticated WITH CHECK (public.is_staff());

CREATE POLICY graduacoes_select ON public.historico_graduacoes FOR SELECT TO authenticated USING (((aluno_id = auth.uid()) OR public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.dependentes
  WHERE ((dependentes.responsavel_id = auth.uid()) AND (dependentes.dependente_id = historico_graduacoes.aluno_id))))));

CREATE POLICY graduacoes_update_staff ON public.historico_graduacoes FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.grupos_alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY grupos_alunos_delete ON public.grupos_alunos FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY grupos_alunos_insert ON public.grupos_alunos FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY grupos_alunos_select ON public.grupos_alunos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY grupos_alunos_update ON public.grupos_alunos FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.historico_graduacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY lancamentos_delete ON public.lancamentos_financeiros FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY lancamentos_insert ON public.lancamentos_financeiros FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY lancamentos_select ON public.lancamentos_financeiros FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY lancamentos_update ON public.lancamentos_financeiros FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY mensalidades_delete ON public.mensalidades FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY mensalidades_insert ON public.mensalidades FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY mensalidades_select ON public.mensalidades FOR SELECT USING (((auth.uid() = aluno_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))));

CREATE POLICY mensalidades_update ON public.mensalidades FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY modalidades_delete ON public.modalidades FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY modalidades_insert ON public.modalidades FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY modalidades_select ON public.modalidades FOR SELECT TO authenticated USING (true);

CREATE POLICY modalidades_update ON public.modalidades FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

ALTER TABLE public.notificacoes_graduacao_enviadas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notificacoes_mensalidade_enviadas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY presencas_delete_staff ON public.presencas FOR DELETE TO authenticated USING (public.is_staff());

CREATE POLICY presencas_insert ON public.presencas FOR INSERT TO authenticated WITH CHECK ((public.is_tablet() OR public.is_staff()));

CREATE POLICY presencas_modify_staff ON public.presencas FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY presencas_select ON public.presencas FOR SELECT TO authenticated USING (((aluno_id = auth.uid()) OR public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.dependentes
  WHERE ((dependentes.responsavel_id = auth.uid()) AND (dependentes.dependente_id = presencas.aluno_id))))));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_delete_admin ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.is_staff() OR public.e_meu_dependente(id)));

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));

CREATE POLICY profiles_update_staff ON public.profiles FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY qr_tokens_insert_self ON public.qr_tokens FOR INSERT TO authenticated WITH CHECK ((aluno_id = auth.uid()));

CREATE POLICY qr_tokens_select ON public.qr_tokens FOR SELECT TO authenticated USING (((aluno_id = auth.uid()) OR public.is_tablet() OR public.is_staff()));

CREATE POLICY qr_tokens_update_tablet ON public.qr_tokens FOR UPDATE TO authenticated USING ((public.is_tablet() OR public.is_staff())) WITH CHECK ((public.is_tablet() OR public.is_staff()));

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY reservas_delete ON public.reservas FOR DELETE USING (((auth.uid() = aluno_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))));

CREATE POLICY reservas_insert ON public.reservas FOR INSERT WITH CHECK (((auth.uid() = aluno_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))));

CREATE POLICY reservas_select ON public.reservas FOR SELECT USING (((auth.uid() = aluno_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))));

CREATE POLICY reservas_update ON public.reservas FOR UPDATE USING (((auth.uid() = aluno_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))))) WITH CHECK (((auth.uid() = aluno_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))));

CREATE POLICY responsavel_le_mensalidades_dependentes ON public.mensalidades FOR SELECT USING (((auth.uid() = aluno_id) OR (EXISTS ( SELECT 1
   FROM public.dependentes
  WHERE ((dependentes.responsavel_id = auth.uid()) AND (dependentes.dependente_id = mensalidades.aluno_id))))));

ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY turmas_delete ON public.turmas FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY turmas_insert ON public.turmas FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY turmas_select ON public.turmas FOR SELECT USING (((ativa = true) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))));

CREATE POLICY turmas_update ON public.turmas FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.perfil = ANY (ARRAY['admin'::public.perfil_usuario, 'professor'::public.perfil_usuario]))))));

CREATE POLICY "user own subscriptions" ON public.push_subscriptions USING ((auth.uid() = user_id));

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

REVOKE ALL ON FUNCTION public.dias_treino_alunos(p_aluno_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.dias_treino_alunos(p_aluno_ids uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.e_meu_dependente(p_aluno_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.e_meu_dependente(p_aluno_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.e_meu_dependente(p_aluno_id uuid) TO service_role;

GRANT ALL ON FUNCTION public.gerar_aulas(p_turma_id uuid, p_semanas integer) TO anon;
GRANT ALL ON FUNCTION public.gerar_aulas(p_turma_id uuid, p_semanas integer) TO authenticated;
GRANT ALL ON FUNCTION public.gerar_aulas(p_turma_id uuid, p_semanas integer) TO service_role;

REVOKE ALL ON FUNCTION public.gerar_qr_token(p_aluno_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.gerar_qr_token(p_aluno_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.gerar_qr_token(p_aluno_ids uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO anon;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_staff() TO service_role;
GRANT ALL ON FUNCTION public.is_staff() TO authenticated;
GRANT ALL ON FUNCTION public.is_staff() TO anon;

REVOKE ALL ON FUNCTION public.is_tablet() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_tablet() TO service_role;
GRANT ALL ON FUNCTION public.is_tablet() TO authenticated;
GRANT ALL ON FUNCTION public.is_tablet() TO anon;

REVOKE ALL ON FUNCTION public.limpar_tokens_expirados() FROM PUBLIC;
GRANT ALL ON FUNCTION public.limpar_tokens_expirados() TO service_role;

GRANT ALL ON FUNCTION public.proteger_colunas_profiles() TO anon;
GRANT ALL ON FUNCTION public.proteger_colunas_profiles() TO authenticated;
GRANT ALL ON FUNCTION public.proteger_colunas_profiles() TO service_role;

REVOKE ALL ON FUNCTION public.ranking_presencas(p_inicio date, p_fim date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ranking_presencas(p_inicio date, p_fim date) TO service_role;

REVOKE ALL ON FUNCTION public.registrar_presenca_por_token(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_presenca_por_token(p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_presenca_por_token(p_token text) TO service_role;

REVOKE ALL ON FUNCTION public.semanas_com_treino() FROM PUBLIC;
GRANT ALL ON FUNCTION public.semanas_com_treino() TO service_role;

GRANT ALL ON FUNCTION public.set_atualizado_em() TO anon;
GRANT ALL ON FUNCTION public.set_atualizado_em() TO authenticated;
GRANT ALL ON FUNCTION public.set_atualizado_em() TO service_role;

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;

GRANT ALL ON FUNCTION public.sync_dia_registro() TO anon;
GRANT ALL ON FUNCTION public.sync_dia_registro() TO authenticated;
GRANT ALL ON FUNCTION public.sync_dia_registro() TO service_role;

REVOKE ALL ON FUNCTION public.verificar_bloqueio_financeiro(p_aluno_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.verificar_bloqueio_financeiro(p_aluno_id uuid) TO service_role;

GRANT ALL ON TABLE public.academias TO anon;
GRANT ALL ON TABLE public.academias TO authenticated;
GRANT ALL ON TABLE public.academias TO service_role;

GRANT ALL ON TABLE public.agendamentos_experimental TO anon;
GRANT ALL ON TABLE public.agendamentos_experimental TO authenticated;
GRANT ALL ON TABLE public.agendamentos_experimental TO service_role;

GRANT ALL ON TABLE public.albuns TO anon;
GRANT ALL ON TABLE public.albuns TO authenticated;
GRANT ALL ON TABLE public.albuns TO service_role;

GRANT ALL ON TABLE public.aluno_descontos TO anon;
GRANT ALL ON TABLE public.aluno_descontos TO authenticated;
GRANT ALL ON TABLE public.aluno_descontos TO service_role;

GRANT ALL ON TABLE public.aluno_modalidades TO anon;
GRANT ALL ON TABLE public.aluno_modalidades TO authenticated;
GRANT ALL ON TABLE public.aluno_modalidades TO service_role;

GRANT ALL ON TABLE public.aulas TO anon;
GRANT ALL ON TABLE public.aulas TO authenticated;
GRANT ALL ON TABLE public.aulas TO service_role;

GRANT ALL ON TABLE public.avisos TO anon;
GRANT ALL ON TABLE public.avisos TO authenticated;
GRANT ALL ON TABLE public.avisos TO service_role;

GRANT ALL ON TABLE public.categorias_financeiras TO anon;
GRANT ALL ON TABLE public.categorias_financeiras TO authenticated;
GRANT ALL ON TABLE public.categorias_financeiras TO service_role;

GRANT ALL ON TABLE public.conquistas TO authenticated;
GRANT ALL ON TABLE public.conquistas TO service_role;

GRANT ALL ON TABLE public.dependentes TO anon;
GRANT ALL ON TABLE public.dependentes TO authenticated;
GRANT ALL ON TABLE public.dependentes TO service_role;

GRANT ALL ON TABLE public.feed_comentarios TO authenticated;
GRANT ALL ON TABLE public.feed_comentarios TO service_role;

GRANT ALL ON TABLE public.feed_curtidas TO authenticated;
GRANT ALL ON TABLE public.feed_curtidas TO service_role;

GRANT ALL ON TABLE public.feed_posts TO authenticated;
GRANT ALL ON TABLE public.feed_posts TO service_role;

GRANT ALL ON TABLE public.formas_pagamento TO anon;
GRANT ALL ON TABLE public.formas_pagamento TO authenticated;
GRANT ALL ON TABLE public.formas_pagamento TO service_role;

GRANT ALL ON TABLE public.fornecedores TO anon;
GRANT ALL ON TABLE public.fornecedores TO authenticated;
GRANT ALL ON TABLE public.fornecedores TO service_role;

GRANT ALL ON TABLE public.fotos TO anon;
GRANT ALL ON TABLE public.fotos TO authenticated;
GRANT ALL ON TABLE public.fotos TO service_role;

GRANT ALL ON TABLE public.grupos_alunos TO anon;
GRANT ALL ON TABLE public.grupos_alunos TO authenticated;
GRANT ALL ON TABLE public.grupos_alunos TO service_role;

GRANT ALL ON TABLE public.historico_graduacoes TO anon;
GRANT ALL ON TABLE public.historico_graduacoes TO authenticated;
GRANT ALL ON TABLE public.historico_graduacoes TO service_role;

GRANT ALL ON TABLE public.lancamentos_financeiros TO anon;
GRANT ALL ON TABLE public.lancamentos_financeiros TO authenticated;
GRANT ALL ON TABLE public.lancamentos_financeiros TO service_role;

GRANT ALL ON TABLE public.mensalidades TO anon;
GRANT ALL ON TABLE public.mensalidades TO authenticated;
GRANT ALL ON TABLE public.mensalidades TO service_role;

GRANT ALL ON TABLE public.modalidades TO anon;
GRANT ALL ON TABLE public.modalidades TO authenticated;
GRANT ALL ON TABLE public.modalidades TO service_role;

GRANT ALL ON TABLE public.notificacoes_graduacao_enviadas TO anon;
GRANT ALL ON TABLE public.notificacoes_graduacao_enviadas TO authenticated;
GRANT ALL ON TABLE public.notificacoes_graduacao_enviadas TO service_role;

GRANT ALL ON TABLE public.notificacoes_mensalidade_enviadas TO anon;
GRANT ALL ON TABLE public.notificacoes_mensalidade_enviadas TO authenticated;
GRANT ALL ON TABLE public.notificacoes_mensalidade_enviadas TO service_role;

GRANT ALL ON TABLE public.presencas TO anon;
GRANT ALL ON TABLE public.presencas TO authenticated;
GRANT ALL ON TABLE public.presencas TO service_role;

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;

GRANT ALL ON TABLE public.qr_tokens TO anon;
GRANT ALL ON TABLE public.qr_tokens TO authenticated;
GRANT ALL ON TABLE public.qr_tokens TO service_role;

GRANT ALL ON TABLE public.reservas TO anon;
GRANT ALL ON TABLE public.reservas TO authenticated;
GRANT ALL ON TABLE public.reservas TO service_role;

GRANT ALL ON TABLE public.turmas TO anon;
GRANT ALL ON TABLE public.turmas TO authenticated;
GRANT ALL ON TABLE public.turmas TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;



-- 3. Fora de public (gerado de produção a 2026-11-12)

-- 3.1 Trigger que cria o profile no signup
create trigger tg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3.2 Buckets de Storage usados pela app
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', true, 2097152, '{image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('galeria', 'galeria', true, 5242880, '{image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('Contrato', 'Contrato', true, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('feed', 'feed', true, 5242880, '{image/webp,image/jpeg}'::text[]) on conflict (id) do nothing;

-- 3.3 Policies de storage.objects (avatars: o próprio e os dependentes)
create policy avatars_upload_own on storage.objects as permissive for insert to public
  with check (((bucket_id = 'avatars'::text) AND (((auth.uid())::text || '.webp'::text) = name)));
create policy avatars_update_own on storage.objects as permissive for update to public
  using (((bucket_id = 'avatars'::text) AND (((auth.uid())::text || '.webp'::text) = name)));
create policy avatars_delete_own on storage.objects as permissive for delete to public
  using (((bucket_id = 'avatars'::text) AND (((auth.uid())::text || '.webp'::text) = name)));
create policy avatars_insert_dependente on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'dependentes'::text) AND (EXISTS ( SELECT 1
   FROM public.dependentes
  WHERE ((dependentes.responsavel_id = auth.uid()) AND ((dependentes.dependente_id)::text = (storage.foldername(objects.name))[2]))))));
create policy avatars_update_dependente on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'dependentes'::text) AND (EXISTS ( SELECT 1
   FROM public.dependentes
  WHERE ((dependentes.responsavel_id = auth.uid()) AND ((dependentes.dependente_id)::text = (storage.foldername(objects.name))[2]))))));
create policy avatars_delete_dependente on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'dependentes'::text) AND (EXISTS ( SELECT 1
   FROM public.dependentes
  WHERE ((dependentes.responsavel_id = auth.uid()) AND ((dependentes.dependente_id)::text = (storage.foldername(objects.name))[2]))))));

-- 4. Privilégios que a produção revogou
-- O pg_dump só escreve os GRANT; não escreve os REVOKE em relação aos
-- privilégios por defeito do Supabase (que dão tudo a anon e authenticated
-- em cada objecto novo). Sem isto, um projecto novo fica mais permissivo do
-- que a produção. Valores lidos de produção a 2026-11-12 (proacl/relacl).

-- 4.1 Funções só para o servidor (service_role) ou triggers
revoke execute on function public.dias_treino_alunos(uuid[]) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.limpar_tokens_expirados() from anon, authenticated;
revoke execute on function public.ranking_presencas(date, date) from anon, authenticated;
revoke execute on function public.semanas_com_treino() from anon, authenticated;
revoke execute on function public.verificar_bloqueio_financeiro(uuid) from anon, authenticated;

-- 4.2 Funções para utilizadores autenticados, não para anon
revoke execute on function public.e_meu_dependente(uuid) from anon;
revoke execute on function public.gerar_qr_token(uuid[]) from anon;
revoke execute on function public.registrar_presenca_por_token(text) from anon;

-- 4.3 Tabelas sem acesso anon (gamificação e feed)
revoke all on table public.conquistas from anon;
revoke all on table public.feed_comentarios from anon;
revoke all on table public.feed_curtidas from anon;
revoke all on table public.feed_posts from anon;
