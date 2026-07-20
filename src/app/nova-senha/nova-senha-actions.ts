"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthErrorMessage } from "@/lib/auth-error-messages";

export async function atualizarSenha(novaSenha: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (!error) return { ok: true };
  return { ok: false, erro: getAuthErrorMessage(error, "reset-password-confirm") };
}
