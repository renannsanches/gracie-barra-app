"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult, TipoLancamento } from "@/lib/types";
import { randomUUID } from "crypto";

export interface NovoLancamentoInput {
  tipo: TipoLancamento;
  descricao: string;
  fornecedor_id: string | null;
  aluno_id?: string | null;
  categoria_id: string | null;
  data_vencimento: string; // YYYY-MM-DD
  valor: number;
  notas?: string | null;
  parcelado: boolean;
  parcelas?: number;        // se parcelado
  intervalo_dias?: number;  // se parcelado
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function hojeISO(): string {
  return new Date().toISOString().split("T")[0];
}

/** Marca lançamentos `pendente` com vencimento < hoje como `atrasado`. */
export async function recalcularStatusVencidos(): Promise<void> {
  const auth = await requireAdmin();
  if (!auth.ok) return;
  const admin = createAdminClient();
  await admin
    .from("lancamentos_financeiros")
    .update({ status: "atrasado" })
    .eq("status", "pendente")
    .lt("data_vencimento", hojeISO());
}

export async function criarLancamento(input: NovoLancamentoInput): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.descricao.trim()) return { ok: false, erro: "Descrição obrigatória." };
  if (input.valor <= 0) return { ok: false, erro: "Valor deve ser maior que zero." };
  if (!input.data_vencimento) return { ok: false, erro: "Vencimento obrigatório." };

  const admin = createAdminClient();

  const parcelas = input.parcelado ? Math.max(1, Math.floor(input.parcelas ?? 1)) : 1;
  const intervalo = input.parcelado ? Math.max(1, Math.floor(input.intervalo_dias ?? 30)) : 0;
  const grupo_id = parcelas > 1 ? randomUUID() : null;

  const hoje = hojeISO();
  const rows = Array.from({ length: parcelas }, (_, i) => {
    const venc = i === 0 ? input.data_vencimento : addDaysISO(input.data_vencimento, intervalo * i);
    return {
      tipo: input.tipo,
      descricao: parcelas > 1 ? `${input.descricao.trim()} (${i + 1}/${parcelas})` : input.descricao.trim(),
      fornecedor_id: input.fornecedor_id,
      aluno_id: input.aluno_id ?? null,
      categoria_id: input.categoria_id,
      data_vencimento: venc,
      valor: Number(input.valor.toFixed(2)),
      status: venc < hoje ? ("atrasado" as const) : ("pendente" as const),
      notas: input.notas?.trim() || null,
      grupo_id,
      parcela_numero: parcelas > 1 ? i + 1 : null,
      parcela_total: parcelas > 1 ? parcelas : null,
      criado_por: auth.userId,
    };
  });

  const { error } = await admin.from("lancamentos_financeiros").insert(rows);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/contas");
  return { ok: true };
}

export async function marcarLancamentoPago(
  id: string,
  forma_pagamento_id: string | null,
  data_pagamento: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { error } = await admin
    .from("lancamentos_financeiros")
    .update({ status: "pago", data_pagamento, forma_pagamento_id })
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/contas");
  revalidatePath(`/admin/financeiro/contas/${id}`);
  return { ok: true };
}

export async function desmarcarLancamentoPago(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const hoje = hojeISO();

  const { data: row } = await admin
    .from("lancamentos_financeiros")
    .select("data_vencimento")
    .eq("id", id)
    .single();
  if (!row) return { ok: false, erro: "Lançamento não encontrado." };

  const novoStatus = row.data_vencimento < hoje ? "atrasado" : "pendente";
  const { error } = await admin
    .from("lancamentos_financeiros")
    .update({ status: novoStatus, data_pagamento: null, forma_pagamento_id: null })
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/contas");
  revalidatePath(`/admin/financeiro/contas/${id}`);
  return { ok: true };
}

export interface EditLancamentoInput {
  descricao: string;
  fornecedor_id: string | null;
  aluno_id?: string | null;
  categoria_id: string | null;
  data_vencimento: string;
  valor: number;
  notas?: string | null;
  aplicarAoGrupoTodo?: boolean;
}

export async function editarLancamento(id: string, input: EditLancamentoInput): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.descricao.trim()) return { ok: false, erro: "Descrição obrigatória." };
  if (input.valor <= 0) return { ok: false, erro: "Valor deve ser maior que zero." };

  const admin = createAdminClient();
  const patch = {
    descricao: input.descricao.trim(),
    fornecedor_id: input.fornecedor_id,
    aluno_id: input.aluno_id ?? null,
    categoria_id: input.categoria_id,
    valor: Number(input.valor.toFixed(2)),
    notas: input.notas?.trim() || null,
  };

  if (input.aplicarAoGrupoTodo) {
    const { data: row } = await admin
      .from("lancamentos_financeiros")
      .select("grupo_id")
      .eq("id", id)
      .single();
    if (!row?.grupo_id) {
      // não tem grupo — tratar como single
      const { error } = await admin
        .from("lancamentos_financeiros")
        .update({ ...patch, data_vencimento: input.data_vencimento })
        .eq("id", id);
      if (error) return { ok: false, erro: error.message };
    } else {
      // Aplica fornecedor/categoria/notas a todas; valor e descrição também,
      // mas NÃO mexe nas datas individuais.
      const { error } = await admin
        .from("lancamentos_financeiros")
        .update({
          fornecedor_id: patch.fornecedor_id,
          categoria_id: patch.categoria_id,
          notas: patch.notas,
          valor: patch.valor,
          // descrição: aplicar mantendo o sufixo "(n/total)"
        })
        .eq("grupo_id", row.grupo_id);
      if (error) return { ok: false, erro: error.message };
    }
  } else {
    const { error } = await admin
      .from("lancamentos_financeiros")
      .update({ ...patch, data_vencimento: input.data_vencimento })
      .eq("id", id);
    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath("/admin/financeiro/contas");
  revalidatePath(`/admin/financeiro/contas/${id}`);
  return { ok: true };
}

export async function cancelarLancamento(id: string, aplicarAoGrupo: boolean = false): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  if (aplicarAoGrupo) {
    const { data: row } = await admin.from("lancamentos_financeiros").select("grupo_id").eq("id", id).single();
    if (row?.grupo_id) {
      const { error } = await admin
        .from("lancamentos_financeiros")
        .update({ status: "cancelado" })
        .eq("grupo_id", row.grupo_id)
        .neq("status", "pago");
      if (error) return { ok: false, erro: error.message };
      revalidatePath("/admin/financeiro/contas");
      return { ok: true };
    }
  }

  const { error } = await admin
    .from("lancamentos_financeiros")
    .update({ status: "cancelado" })
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/financeiro/contas");
  revalidatePath(`/admin/financeiro/contas/${id}`);
  return { ok: true };
}

export async function apagarLancamento(id: string, aplicarAoGrupo: boolean = false): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  if (aplicarAoGrupo) {
    const { data: row } = await admin.from("lancamentos_financeiros").select("grupo_id").eq("id", id).single();
    if (row?.grupo_id) {
      const { error } = await admin.from("lancamentos_financeiros").delete().eq("grupo_id", row.grupo_id);
      if (error) return { ok: false, erro: error.message };
      revalidatePath("/admin/financeiro/contas");
      return { ok: true };
    }
  }

  const { error } = await admin.from("lancamentos_financeiros").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/financeiro/contas");
  return { ok: true };
}
