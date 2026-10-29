"use server";

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";

/**
 * Gasta o token do email de recuperação e cria a sessão. Só corre quando o aluno
 * carrega em "Continuar" — nunca num GET — para que os scanners de email
 * (Gmail, Outlook SafeLinks) que abrem o link antes do aluno não o gastem.
 */
export async function validarLinkRecuperacao(tokenHash: string) {
  if (typeof tokenHash !== "string" || tokenHash.length < 10 || tokenHash.length > 512) {
    return { ok: false, codigo: "invalid_token" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error) {
    // Só o código — sem email nem token — para não pôr dados pessoais no Sentry.
    Sentry.captureMessage("recovery verifyOtp falhou", {
      level: "warning",
      extra: { codigo: error.code ?? error.name, status: error.status },
    });
    return { ok: false, codigo: error.code ?? "otp_failed" };
  }
  return { ok: true, codigo: undefined };
}

export async function atualizarSenha(novaSenha: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  return { ok: !error, erro: error?.message, codigo: error?.code };
}
