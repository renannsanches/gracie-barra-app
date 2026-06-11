"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult, Mensalidade } from "@/lib/types";

interface GerarResult extends ActionResult {
  mensalidade?: Mensalidade;
}

interface PresencaResult extends ActionResult {
  presencaId?: string;
  registrado_em?: string;
}

interface PresencaBatchResult extends ActionResult {
  adicionadas?: number;
  duplicadas?: string[];
  novas?: { id: string; registrado_em: string; aluno_id: string }[];
}

export async function marcarPago(mensalidadeId: string, alunoId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
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
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const hoje = new Date().toISOString().split("T")[0];

  const { data: m, error: errBusca } = await admin
    .from("mensalidades")
    .select("data_vencimento")
    .eq("id", mensalidadeId)
    .single();

  if (errBusca || !m) return { ok: false, erro: errBusca?.message ?? "Mensalidade não encontrada." };

  const novoStatus = m.data_vencimento < hoje ? "atrasado" : "pendente";

  const { error } = await admin
    .from("mensalidades")
    .update({ status: novoStatus, data_pagamento: null })
    .eq("id", mensalidadeId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true };
}

export async function criarPrimeiraMensalidade(
  alunoId: string,
  dados: { valor: number; mes_referencia: string; data_vencimento: string },
): Promise<GerarResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { data: existe } = await admin
    .from("mensalidades")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("mes_referencia", dados.mes_referencia)
    .maybeSingle();

  if (existe) return { ok: false, erro: "Mensalidade para esse mês já existe." };

  const { data: nova, error } = await admin
    .from("mensalidades")
    .insert({
      aluno_id:        alunoId,
      mes_referencia:  dados.mes_referencia,
      data_vencimento: dados.data_vencimento,
      valor:           dados.valor,
      status:          "pendente",
    })
    .select()
    .single();

  if (error || !nova) return { ok: false, erro: error?.message ?? "Erro ao inserir." };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true, mensalidade: nova as Mensalidade };
}

export async function gerarProximoMes(alunoId: string): Promise<GerarResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
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

  const { data: existe, error: errExiste } = await admin
    .from("mensalidades")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("mes_referencia", mesRef)
    .maybeSingle();

  if (existe || errExiste) return { ok: false, erro: "Mensalidade para esse mês já existe." };

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

  if (error?.code === "23505") return { ok: false, erro: "Mensalidade para esse mês já existe." };
  if (error || !nova) return { ok: false, erro: error?.message ?? "Erro ao inserir." };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true, mensalidade: nova as Mensalidade };
}

export async function adicionarPresenca(alunoId: string, data: string): Promise<PresencaResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const hoje = new Date().toISOString().slice(0, 10);
  if (data > hoje) return { ok: false, erro: "Não é possível registrar presença para data futura." };

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

export async function adicionarPresencas(alunoId: string, datas: string[]): Promise<PresencaBatchResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!datas.length) return { ok: false, erro: "Nenhuma data fornecida." };

  const hoje = new Date().toISOString().slice(0, 10);
  const datasValidas = datas.filter(d => d <= hoje);
  if (!datasValidas.length) return { ok: false, erro: "Todas as datas são futuras." };

  const admin = createAdminClient();

  const { data: existentes } = await admin
    .from("presencas")
    .select("dia_registro")
    .eq("aluno_id", alunoId)
    .in("dia_registro", datasValidas);

  const jaExistem = new Set(existentes?.map(e => e.dia_registro) ?? []);
  const novasDatas = datasValidas.filter(d => !jaExistem.has(d));
  const duplicadas = datasValidas.filter(d => jaExistem.has(d));

  if (novasDatas.length === 0) {
    return { ok: true, adicionadas: 0, duplicadas, novas: [] };
  }

  const rows = novasDatas.map(d => ({
    aluno_id: alunoId,
    registrado_em: `${d}T12:00:00+00:00`,
  }));

  const { data: inseridas, error } = await admin
    .from("presencas")
    .insert(rows)
    .select("id, registrado_em");

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return {
    ok: true,
    adicionadas: inseridas?.length ?? 0,
    duplicadas,
    novas: inseridas?.map(r => ({ ...r, aluno_id: alunoId })) ?? [],
  };
}

export async function editarMensalidade(
  mensalidadeId: string,
  alunoId: string,
  dados: { valor: number; data_vencimento: string; mes_referencia: string },
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { data: duplicado } = await admin
    .from("mensalidades")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("mes_referencia", dados.mes_referencia)
    .neq("id", mensalidadeId)
    .maybeSingle();

  if (duplicado) return { ok: false, erro: "Já existe mensalidade para esse mês." };

  const { error } = await admin
    .from("mensalidades")
    .update({ valor: dados.valor, data_vencimento: dados.data_vencimento, mes_referencia: dados.mes_referencia })
    .eq("id", mensalidadeId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true };
}

export async function editarMensalidadesEmLote(
  alunoId: string,
  updates: Array<{ id: string; valor: number; data_vencimento: string; mes_referencia: string }>,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  for (const u of updates) {
    const { error } = await admin
      .from("mensalidades")
      .update({ valor: u.valor, data_vencimento: u.data_vencimento, mes_referencia: u.mes_referencia })
      .eq("id", u.id);
    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true };
}

export async function excluirMensalidade(mensalidadeId: string, alunoId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { error } = await admin
    .from("mensalidades")
    .delete()
    .eq("id", mensalidadeId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true };
}

export async function excluirPresenca(presencaId: string, alunoId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { error } = await admin
    .from("presencas")
    .delete()
    .eq("id", presencaId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true };
}
