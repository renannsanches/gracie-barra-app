"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult, TipoCategoriaFinanceira } from "@/lib/types";

export async function criarCategoria(
  nome: string,
  tipo: TipoCategoriaFinanceira,
  parent_id: string | null,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!nome.trim()) return { ok: false, erro: "Nome obrigatório." };

  const admin = createAdminClient();

  // Se tiver pai, herdar o tipo do pai para garantir consistência
  let tipoFinal = tipo;
  if (parent_id) {
    const { data: pai, error: errPai } = await admin
      .from("categorias_financeiras")
      .select("tipo, parent_id")
      .eq("id", parent_id)
      .single();
    if (errPai || !pai) return { ok: false, erro: "Categoria pai não encontrada." };
    if (pai.parent_id) return { ok: false, erro: "Hierarquia de apenas 2 níveis suportada." };
    tipoFinal = pai.tipo as TipoCategoriaFinanceira;
  }

  const { error } = await admin
    .from("categorias_financeiras")
    .insert({ nome: nome.trim(), tipo: tipoFinal, parent_id });
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/categorias");
  return { ok: true };
}

export async function editarCategoria(
  id: string,
  nome: string,
  ativa: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!nome.trim()) return { ok: false, erro: "Nome obrigatório." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("categorias_financeiras")
    .update({ nome: nome.trim(), ativa })
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/categorias");
  return { ok: true };
}

export async function apagarCategoria(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  // Verificar se tem subcategorias
  const { count: subCount } = await admin
    .from("categorias_financeiras")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);
  if ((subCount ?? 0) > 0) {
    return { ok: false, erro: "Categoria tem subcategorias. Apaga-as primeiro." };
  }

  // Verificar se tem lançamentos
  const { count: lancCount } = await admin
    .from("lancamentos_financeiros")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);
  if ((lancCount ?? 0) > 0) {
    return { ok: false, erro: `Categoria usada em ${lancCount} lançamento(s).` };
  }

  const { error } = await admin
    .from("categorias_financeiras")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/categorias");
  return { ok: true };
}
