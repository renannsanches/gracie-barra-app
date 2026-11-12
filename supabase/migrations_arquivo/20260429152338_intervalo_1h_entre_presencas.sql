-- Remove índice único que impedia dois registros no mesmo dia
DROP INDEX IF EXISTS idx_presencas_unique_dia;

-- Recria RPC com validação de 1 hora (mantém mesma assinatura)
DROP FUNCTION IF EXISTS public.registrar_presenca_por_token(text);

CREATE FUNCTION public.registrar_presenca_por_token(p_token text)
RETURNS TABLE(sucesso boolean, mensagem text, aluno_nome text, aluno_foto text, aluno_faixa cor_faixa, aluno_graus smallint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_rec qr_tokens%ROWTYPE;
  v_aluno profiles%ROWTYPE;
  v_ultima_presenca timestamptz;
BEGIN
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

  SELECT * INTO v_aluno FROM profiles WHERE id = v_token_rec.aluno_id;

  IF v_aluno.status != 'ativo' THEN
    RETURN QUERY SELECT false, 'Aluno não está ativo'::text, v_aluno.nome_completo, v_aluno.foto_url, v_aluno.faixa, v_aluno.graus;
    RETURN;
  END IF;

  -- Verifica intervalo mínimo de 1 hora entre presenças
  SELECT registrado_em INTO v_ultima_presenca
  FROM presencas
  WHERE aluno_id = v_aluno.id
  ORDER BY registrado_em DESC
  LIMIT 1;

  IF v_ultima_presenca IS NOT NULL AND v_ultima_presenca > now() - interval '1 hour' THEN
    UPDATE qr_tokens SET usado = true, usado_em = now() WHERE id = v_token_rec.id;
    RAISE EXCEPTION 'Presença já registrada. Aguarde 1 hora entre registros.';
  END IF;

  INSERT INTO presencas (aluno_id, tablet_id)
  VALUES (v_aluno.id, auth.uid());

  UPDATE qr_tokens SET usado = true, usado_em = now() WHERE id = v_token_rec.id;

  RETURN QUERY SELECT
    true,
    ('Presença registrada! Bem-vindo, ' || v_aluno.nome_completo)::text,
    v_aluno.nome_completo,
    v_aluno.foto_url,
    v_aluno.faixa,
    v_aluno.graus;
END;
$$;
