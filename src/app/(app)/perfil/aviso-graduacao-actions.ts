"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAVE_AVISO_GRADUACAO } from "@/lib/aviso-graduacao";
import type { ActionResult } from "@/lib/types";

// Regista na conta que o aviso de aptos a graduar já foi visto nesta janela
export async function marcarAvisoGraduacaoVisto(janela: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(janela)) return { ok: false, erro: "Janela inválida." };

  // user_metadata faz merge — as restantes chaves (ex.: onboarding) mantêm-se
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(guard.userId, {
    user_metadata: { [CHAVE_AVISO_GRADUACAO]: janela },
  });
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
