"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Mensalidade } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  erro?: string;
}

interface GerarResult extends ActionResult {
  mensalidade?: Mensalidade;
}

interface PresencaResult extends ActionResult {
  presencaId?: string;
  registrado_em?: string;
}

export async function marcarPago(mensalidadeId: string, alunoId: string): Promise<ActionResult> {
  const admin = createAdminClient();
  const hoje = new Date().toISOString().split("T")[0];

  const { error } = await admin
    .from("mensalidades")
    .update({ status: "pago", data_pagamento: hoje })
    .eq("id", mensalidadeId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true };
}

export async function desmarcarPago(mensalidadeId: string, alunoId: string): Promise<ActionResult> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("mensalidades")
    .update({ status: "pendente", data_pagamento: null })
    .eq("id", mensalidadeId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true };
}

export async function gerarProximoMes(alunoId: string): Promise<GerarResult> {
  const admin = createAdminClient();

  const { data: ultima, error: errBusca } = await admin
    .from("mensalidades")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("mes_referencia", { ascending: false })
    .limit(1)
    .single();

  if (errBusca || !ultima) return { ok: false, erro: "Nenhuma mensalidade encontrada." };

  const [ano, mes] = ultima.mes_referencia.split("-").map(Number);
  const proximoAno  = mes === 12 ? ano + 1 : ano;
  const proximoMes  = mes === 12 ? 1 : mes + 1;
  const mesRef      = `${proximoAno}-${String(proximoMes).padStart(2, "0")}-01`;

  const { data: existe } = await admin
    .from("mensalidades")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("mes_referencia", mesRef)
    .maybeSingle();

  if (existe) return { ok: false, erro: "Mensalidade para esse mês já existe." };

  const diaVenc       = Number(ultima.data_vencimento.split("-")[2]);
  const ultimoDiaMes  = new Date(proximoAno, proximoMes, 0).getDate();
  const diaReal       = Math.min(diaVenc, ultimoDiaMes);
  const dataVenc      = `${proximoAno}-${String(proximoMes).padStart(2, "0")}-${String(diaReal).padStart(2, "0")}`;

  const { data: nova, error } = await admin
    .from("mensalidades")
    .insert({
      aluno_id:        alunoId,
      mes_referencia:  mesRef,
      data_vencimento: dataVenc,
      valor:           ultima.valor,
      status:          "pendente",
    })
    .select()
    .single();

  if (error || !nova) return { ok: false, erro: error?.message ?? "Erro ao inserir." };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true, mensalidade: nova as Mensalidade };
}

export async function adicionarPresenca(alunoId: string, data: string): Promise<PresencaResult> {
  const admin = createAdminClient();

  const { data: existe } = await admin
    .from("presencas")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("dia_registro", data)
    .maybeSingle();

  if (existe) return { ok: false, erro: "Já existe uma presença neste dia." };

  const { data: nova, error } = await admin
    .from("presencas")
    .insert({ aluno_id: alunoId, registrado_em: `${data}T12:00:00+00:00` })
    .select("id, registrado_em")
    .single();

  if (error || !nova) return { ok: false, erro: error?.message ?? "Erro ao inserir." };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true, presencaId: nova.id, registrado_em: nova.registrado_em };
}

export async function excluirPresenca(presencaId: string, alunoId: string): Promise<ActionResult> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("presencas")
    .delete()
    .eq("id", presencaId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true };
}

interface MassaResult extends ActionResult {
  criadas?: number;
  duplicadas?: number;
}

export async function adicionarPresencasEmMassa(alunoId: string, dates: string[]): Promise<MassaResult> {
  if (dates.length === 0) return { ok: true, criadas: 0, duplicadas: 0 };

  const admin = createAdminClient();

  const { data: existentes } = await admin
    .from("presencas")
    .select("dia_registro")
    .eq("aluno_id", alunoId)
    .in("dia_registro", dates);

  const jaExistem = new Set((existentes ?? []).map((r: { dia_registro: string }) => r.dia_registro));
  const novas = dates.filter((d) => !jaExistem.has(d));

  if (novas.length > 0) {
    const rows = novas.map((d) => ({
      aluno_id: alunoId,
      registrado_em: `${d}T12:00:00+00:00`,
    }));

    const { error } = await admin.from("presencas").insert(rows);
    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true, criadas: novas.length, duplicadas: jaExistem.size };
}

export async function zerarAulasManual(alunoId: string): Promise<ActionResult> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ aulas_manual: 0 })
    .eq("id", alunoId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true };
}
