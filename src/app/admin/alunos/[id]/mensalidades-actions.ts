"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { planoDoAluno } from "@/lib/modalidades";
import type { ActionResult, Mensalidade } from "@/lib/types";

interface GerarResult extends ActionResult {
  mensalidade?: Mensalidade;
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

  // Composição = plano do aluno; se o admin escrever outro valor, a diferença aparece como "Ajuste"
  const plano = await planoDoAluno(admin, alunoId);

  const { data: nova, error } = await admin
    .from("mensalidades")
    .insert({
      aluno_id:        alunoId,
      mes_referencia:  dados.mes_referencia,
      data_vencimento: dados.data_vencimento,
      valor:           dados.valor,
      itens:           plano.itens.length > 0 ? plano.itens : null,
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

  // Valor vem das modalidades actuais do aluno; sem modalidades, repete a última mensalidade
  const plano = await planoDoAluno(admin, alunoId);
  // Plano com linhas (mesmo que todas pagas fora) manda; sem plano, repete a última
  const temPlano = plano.linhas.length > 0;

  const { data: nova, error } = await admin
    .from("mensalidades")
    .insert({
      aluno_id:        alunoId,
      mes_referencia:  mesRef,
      data_vencimento: dataVenc,
      valor:           temPlano ? plano.total : ultima.valor,
      itens:           temPlano ? plano.itens : ultima.itens,
      status:          "pendente",
    })
    .select()
    .single();

  if (error?.code === "23505") return { ok: false, erro: "Mensalidade para esse mês já existe." };
  if (error || !nova) return { ok: false, erro: error?.message ?? "Erro ao inserir." };

  revalidatePath(`/admin/alunos/${alunoId}`);
  return { ok: true, mensalidade: nova as Mensalidade };
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
