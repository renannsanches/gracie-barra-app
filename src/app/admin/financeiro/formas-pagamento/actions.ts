"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";

export async function criarForma(nome: string, ordem: number): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!nome.trim()) return { ok: false, erro: "Nome obrigatório." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("formas_pagamento")
    .insert({ nome: nome.trim(), ordem });
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/formas-pagamento");
  return { ok: true };
}

export async function editarForma(
  id: string,
  nome: string,
  ordem: number,
  ativa: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!nome.trim()) return { ok: false, erro: "Nome obrigatório." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("formas_pagamento")
    .update({ nome: nome.trim(), ordem, ativa })
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/formas-pagamento");
  return { ok: true };
}

export async function apagarForma(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { count } = await admin
    .from("lancamentos_financeiros")
    .select("id", { count: "exact", head: true })
    .eq("forma_pagamento_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, erro: `Forma usada em ${count} lançamento(s). Desactiva em vez de apagar.` };
  }

  const { error } = await admin.from("formas_pagamento").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/formas-pagamento");
  return { ok: true };
}
