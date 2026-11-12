-- Helper: retorna true se o aluno tem mensalidade não-paga vencida há ≥10 dias.
-- Não depende do enum status='atrasado' (que não é flipped automaticamente).
-- Desbloqueia automaticamente quando a mensalidade é marcada como pago.
-- Sem mensalidades → retorna false (permitir).
CREATE OR REPLACE FUNCTION verificar_bloqueio_financeiro(p_aluno_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM mensalidades
    WHERE aluno_id = p_aluno_id
      AND status <> 'pago'
      AND data_vencimento <= CURRENT_DATE - INTERVAL '10 days'
  );
$$;

-- INSTRUÇÃO MANUAL (não executar via migration automática):
-- Copiar o fonte actual da RPC registrar_presenca_por_token no SQL editor do Supabase:
--   SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'registrar_presenca_por_token';
-- Adicionar este bloco ANTES do INSERT em presencas:
--
--   IF verificar_bloqueio_financeiro(v_aluno_id) THEN
--     RAISE EXCEPTION 'mensalidade_bloqueada: Não foi possível registar presença. Falar com Simone.';
--   END IF;
--
-- onde v_aluno_id é a variável com o ID do aluno derivada do token.
