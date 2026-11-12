-- ============================================
-- FUNÇÃO: gerar_qr_token
-- Chamada pelo app do aluno ao tocar "Registrar Presença"
-- Gera token único válido por 60 segundos
-- ============================================

CREATE OR REPLACE FUNCTION gerar_qr_token()
RETURNS TABLE (token text, expira_em timestamptz) AS $$
DECLARE
  novo_token text;
  expiracao timestamptz;
  aluno_status status_aluno;
BEGIN
  -- Verifica se usuário está autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Verifica se aluno está ativo
  SELECT status INTO aluno_status FROM profiles WHERE id = auth.uid();
  IF aluno_status IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;
  IF aluno_status != 'ativo' THEN
    RAISE EXCEPTION 'Aluno não está ativo (status: %)', aluno_status;
  END IF;

  -- Gera token aleatório seguro (32 chars hex)
  novo_token := encode(gen_random_bytes(16), 'hex');
  expiracao := now() + interval '60 seconds';

  INSERT INTO qr_tokens (aluno_id, token, expira_em)
  VALUES (auth.uid(), novo_token, expiracao);

  RETURN QUERY SELECT novo_token, expiracao;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÃO: registrar_presenca_por_token
-- Chamada pelo tablet ao ler o QR Code
-- Valida token, registra presença, marca token como usado
-- ============================================

CREATE OR REPLACE FUNCTION registrar_presenca_por_token(p_token text)
RETURNS TABLE (
  sucesso boolean,
  mensagem text,
  aluno_nome text,
  aluno_foto text,
  aluno_faixa cor_faixa,
  aluno_graus smallint
) AS $$
DECLARE
  v_token_rec qr_tokens%ROWTYPE;
  v_aluno profiles%ROWTYPE;
  v_ja_registrado boolean;
BEGIN
  -- Busca token
  SELECT * INTO v_token_rec FROM qr_tokens WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'QR Code inválido'::text, NULL::text, NULL::text, NULL::cor_faixa, NULL::smallint;
    RETURN;
  END IF;

  IF v_token_rec.usado THEN
    RETURN QUERY SELECT false, 'QR Code já utilizado'::text, NULL::text, NULL::text, NULL::cor_faixa, NULL::smallint;
    RETURN;
  END IF;

  IF v_token_rec.expira_em < now() THEN
    RETURN QUERY SELECT false, 'QR Code expirado, gere um novo'::text, NULL::text, NULL::text, NULL::cor_faixa, NULL::smallint;
    RETURN;
  END IF;

  -- Busca aluno
  SELECT * INTO v_aluno FROM profiles WHERE id = v_token_rec.aluno_id;

  IF v_aluno.status != 'ativo' THEN
    RETURN QUERY SELECT false, 'Aluno não está ativo'::text, v_aluno.nome_completo, v_aluno.foto_url, v_aluno.faixa, v_aluno.graus;
    RETURN;
  END IF;

  -- Verifica se já tem presença hoje
  SELECT EXISTS (
    SELECT 1 FROM presencas
    WHERE aluno_id = v_aluno.id
    AND dia_registro = (now() AT TIME ZONE 'UTC')::date
  ) INTO v_ja_registrado;

  IF v_ja_registrado THEN
    -- Marca token como usado mesmo assim
    UPDATE qr_tokens SET usado = true, usado_em = now() WHERE id = v_token_rec.id;
    RETURN QUERY SELECT false, 'Presença já registrada hoje'::text, v_aluno.nome_completo, v_aluno.foto_url, v_aluno.faixa, v_aluno.graus;
    RETURN;
  END IF;

  -- Registra presença
  INSERT INTO presencas (aluno_id, tablet_id)
  VALUES (v_aluno.id, auth.uid());

  -- Marca token como usado
  UPDATE qr_tokens SET usado = true, usado_em = now() WHERE id = v_token_rec.id;

  RETURN QUERY SELECT
    true,
    ('Presença registrada! Bem-vindo, ' || v_aluno.nome_completo)::text,
    v_aluno.nome_completo,
    v_aluno.foto_url,
    v_aluno.faixa,
    v_aluno.graus;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÃO: limpar_tokens_expirados
-- Limpeza periódica (pode ser chamada por cron)
-- ============================================

CREATE OR REPLACE FUNCTION limpar_tokens_expirados()
RETURNS integer AS $$
DECLARE
  deletados integer;
BEGIN
  DELETE FROM qr_tokens
  WHERE expira_em < now() - interval '1 hour'
  RETURNING 1 INTO deletados;

  GET DIAGNOSTICS deletados = ROW_COUNT;
  RETURN deletados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
