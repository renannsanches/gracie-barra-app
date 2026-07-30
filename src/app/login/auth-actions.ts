"use server";

import { createClient } from "@/lib/supabase/server";

export type LoginErro = "credenciais" | "nao_confirmado" | "rate_limit" | "generico";

export async function login(email: string, password: string): Promise<{ ok: boolean; tipoErro?: LoginErro }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (!error) return { ok: true };

  if (error.code === "email_not_confirmed" || error.message.includes("Email not confirmed")) {
    return { ok: false, tipoErro: "nao_confirmado" };
  }

  if (error.code === "over_request_rate_limit") {
    return { ok: false, tipoErro: "rate_limit" };
  }

  // Never distinguish "user not found" from "wrong password" — avoids
  // leaking whether an email is registered.
  return { ok: false, tipoErro: "credenciais" };
}
