"use server";

import {
  criarFornecedor,
  editarFornecedor,
  apagarFornecedor,
  type FornecedorInput,
} from "../fornecedores/actions";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

// Wrapper que força tipo='cliente'
export async function criarCliente(
  input: Omit<FornecedorInput, "tipo">,
): Promise<ActionResult & { id?: string }> {
  const result = await criarFornecedor({ ...input, tipo: "cliente" });
  if (result.ok) revalidatePath("/admin/financeiro/clientes");
  return result;
}

export async function editarCliente(
  id: string,
  input: Omit<FornecedorInput, "tipo"> & { ativo: boolean },
): Promise<ActionResult> {
  const result = await editarFornecedor(id, { ...input, tipo: "cliente" });
  if (result.ok) revalidatePath("/admin/financeiro/clientes");
  return result;
}

export async function apagarCliente(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  // Verificar lançamentos que usam este cliente
  const { count: lancCount } = await admin
    .from("lancamentos_financeiros")
    .select("id", { count: "exact", head: true })
    .eq("fornecedor_id", id);
  if ((lancCount ?? 0) > 0) {
    return { ok: false, erro: `Usado em ${lancCount} lançamento(s). Desactiva em vez de apagar.` };
  }

  return apagarFornecedor(id);
}
