"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";

const NOME_MAX = 40;

function validarNome(nome: string): string | null {
  const n = nome.trim();
  if (!n) return "Escreve um nome para o grupo.";
  if (n.length > NOME_MAX) return `Nome demasiado longo (máx. ${NOME_MAX} caracteres).`;
  return null;
}

function erroDb(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Já existe um grupo com esse nome.";
  return error.message;
}

function revalidar() {
  revalidatePath("/admin/grupos");
  revalidatePath("/admin/alunos");
  revalidatePath("/admin/financeiro");
}

export async function criarGrupo(nome: string): Promise<ActionResult & { id?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const invalido = validarNome(nome);
  if (invalido) return { ok: false, erro: invalido };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("grupos_alunos")
    .insert({ nome: nome.trim() })
    .select("id")
    .single();
  if (error) return { ok: false, erro: erroDb(error) };

  revalidar();
  return { ok: true, id: data.id };
}

export async function renomearGrupo(id: string, nome: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const invalido = validarNome(nome);
  if (invalido) return { ok: false, erro: invalido };

  const admin = createAdminClient();
  const { error } = await admin
    .from("grupos_alunos")
    .update({ nome: nome.trim() })
    .eq("id", id);
  if (error) return { ok: false, erro: erroDb(error) };

  revalidar();
  return { ok: true };
}

export async function definirGrupoAtivo(id: string, ativo: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  if (!ativo) {
    const { data: grupo } = await admin.from("grupos_alunos").select("padrao").eq("id", id).single();
    if (grupo?.padrao) {
      return { ok: false, erro: "O grupo padrão não pode ser desativado — é onde entram os novos registos da app." };
    }
  }

  const { error } = await admin.from("grupos_alunos").update({ ativo }).eq("id", id);
  if (error) return { ok: false, erro: erroDb(error) };

  revalidar();
  return { ok: true };
}

export async function apagarGrupo(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { data: grupo } = await admin.from("grupos_alunos").select("padrao").eq("id", id).single();
  if (grupo?.padrao) return { ok: false, erro: "O grupo padrão não pode ser apagado." };

  // O local de alunos e turmas vem das modalidades: com modalidades, não se apaga
  const { count } = await admin
    .from("modalidades")
    .select("id", { count: "exact", head: true })
    .eq("grupo_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      erro: `Este local tem ${count} modalidade${count === 1 ? "" : "s"}. Desativa em vez de apagar.`,
    };
  }

  const { error } = await admin.from("grupos_alunos").delete().eq("id", id);
  if (error) return { ok: false, erro: erroDb(error) };

  revalidar();
  return { ok: true };
}
