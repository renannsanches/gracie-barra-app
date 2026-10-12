"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";

const NOME_MAX = 40;

export interface DadosModalidade {
  nome: string;
  valor: number;
  valorInfantil: number | null;
  /** Local onde é dada (grupo) */
  grupoId: string;
  /** Quem também treina noutro local recebe este valor como desconto */
  descontaNoutroLocal: boolean;
}

function validar(d: DadosModalidade): string | null {
  const n = d.nome.trim();
  if (!n) return "Escreve um nome para a modalidade.";
  if (n.length > NOME_MAX) return `Nome demasiado longo (máx. ${NOME_MAX} caracteres).`;
  if (!Number.isFinite(d.valor) || d.valor < 0) return "Valor mensal inválido.";
  if (d.valorInfantil !== null && (!Number.isFinite(d.valorInfantil) || d.valorInfantil < 0)) {
    return "Valor para menores de 16 inválido.";
  }
  if (!d.grupoId) return "Escolhe o local da modalidade.";
  return null;
}

function erroDb(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Já existe uma modalidade com esse nome neste local.";
  return error.message;
}

function revalidar() {
  revalidatePath("/admin/modalidades");
  revalidatePath("/admin/alunos");
  revalidatePath("/admin/turmas");
  revalidatePath("/admin/grupos");
}

export async function criarModalidade(d: DadosModalidade): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const invalido = validar(d);
  if (invalido) return { ok: false, erro: invalido };

  const admin = createAdminClient();
  const { error } = await admin
    .from("modalidades")
    .insert({
      nome: d.nome.trim(), valor: d.valor, valor_infantil: d.valorInfantil,
      grupo_id: d.grupoId, desconta_noutro_local: d.descontaNoutroLocal,
    });
  if (error) return { ok: false, erro: erroDb(error) };

  revalidar();
  return { ok: true };
}

export async function editarModalidade(id: string, d: DadosModalidade): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const invalido = validar(d);
  if (invalido) return { ok: false, erro: invalido };

  const admin = createAdminClient();
  const { error } = await admin
    .from("modalidades")
    .update({
      nome: d.nome.trim(), valor: d.valor, valor_infantil: d.valorInfantil,
      grupo_id: d.grupoId, desconta_noutro_local: d.descontaNoutroLocal,
    })
    .eq("id", id);
  if (error) return { ok: false, erro: erroDb(error) };

  revalidar();
  return { ok: true };
}

export async function definirModalidadeAtiva(id: string, ativo: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  if (!ativo) {
    const { data } = await admin.from("modalidades").select("padrao").eq("id", id).single();
    if (data?.padrao) {
      return { ok: false, erro: "A modalidade padrão não pode ser desativada — é a dos novos registos da app." };
    }
  }

  const { error } = await admin.from("modalidades").update({ ativo }).eq("id", id);
  if (error) return { ok: false, erro: erroDb(error) };

  revalidar();
  return { ok: true };
}

export async function apagarModalidade(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { data } = await admin.from("modalidades").select("padrao").eq("id", id).single();
  if (data?.padrao) return { ok: false, erro: "A modalidade padrão não pode ser apagada." };

  const [{ count: alunos }, { count: turmas }] = await Promise.all([
    admin.from("aluno_modalidades").select("aluno_id", { count: "exact", head: true }).eq("modalidade_id", id),
    admin.from("turmas").select("id", { count: "exact", head: true }).eq("modalidade_id", id),
  ]);
  // Descontos automáticos que vieram desta modalidade ficam como descontos manuais (ON DELETE SET NULL)
  if ((alunos ?? 0) > 0 || (turmas ?? 0) > 0) {
    const partes = [
      alunos ? `${alunos} aluno${alunos === 1 ? "" : "s"}` : null,
      turmas ? `${turmas} turma${turmas === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    return { ok: false, erro: `Modalidade usada por ${partes.join(" e ")}. Desativa em vez de apagar.` };
  }

  const { error } = await admin.from("modalidades").delete().eq("id", id);
  if (error) return { ok: false, erro: erroDb(error) };

  revalidar();
  return { ok: true };
}
