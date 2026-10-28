"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function enviarResetSenha(email: string) {
  const supabase = await createClient();
  const headersList = await headers();
  const xForwardedHost = headersList.get("x-forwarded-host");
  const xForwardedProto = headersList.get("x-forwarded-proto") ?? "https";
  const origin =
    headersList.get("origin") ??
    (xForwardedHost ? `${xForwardedProto}://${xForwardedHost}` : null) ??
    "http://localhost:3000";
  const redirectTo = `${origin}/nova-senha`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { ok: !error };
}
