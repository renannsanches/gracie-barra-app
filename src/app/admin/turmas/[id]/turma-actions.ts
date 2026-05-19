"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult, StatusAula, StatusReserva, RecorrenciaTurma, CategoriaFaixa } from "@/lib/types";

interface GerarResult extends ActionResult { criadas?: number; }

type TurmaUpdate = {
  nome: string;
  dia_semana: number;
  horario: string;
  recorrencia: RecorrenciaTurma;
  lotacao_maxima: number;
  categoria: CategoriaFaixa;
  professor_id: string | null;
};

export interface AulaComContagem {
  id: string;
  turma_id: string;
  data: string;
  horario: string;
  lotacao_maxima: number;
  status: StatusAula;
  criado_em: string;
  reservas_confirmadas: number;
}

export interface ReservaComAluno {
  id: string;
  aula_id: string;
  aluno_id: string;
  status: StatusReserva;
  criado_em: string;
  aluno: { id: string; nome_completo: string } | null;
}

export interface AdicionarAulaResult extends ActionResult {
  aula?: AulaComContagem;
}

export async function salvarTurma(turmaId: string, data: TurmaUpdate): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { error } = await admin.from("turmas").update(data).eq("id", turmaId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/admin/turmas/${turmaId}`);
  revalidatePath("/admin/turmas");
  return { ok: true };
}

export async function toggleTurmaAtiva(turmaId: string, ativa: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { error } = await admin.from("turmas").update({ ativa }).eq("id", turmaId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/admin/turmas/${turmaId}`);
  revalidatePath("/admin/turmas");
  return { ok: true };
}

export async function gerarAulas(turmaId: string, semanas: number): Promise<GerarResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("gerar_aulas", {
    p_turma_id: turmaId,
    p_semanas:  semanas,
  });
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/admin/turmas/${turmaId}`);
  return { ok: true, criadas: data as number };
}

export async function buscarAulasComContagem(turmaId: string): Promise<AulaComContagem[]> {
  const admin = createAdminClient();
  const { data: aulas } = await admin
    .from("aulas")
    .select("*")
    .eq("turma_id", turmaId)
    .order("data", { ascending: false })
    .order("horario", { ascending: true });

  const aulaIds = (aulas ?? []).map((a) => a.id as string);
  const contagem: Record<string, number> = {};

  if (aulaIds.length > 0) {
    const { data: reservas } = await admin
      .from("reservas")
      .select("aula_id")
      .in("aula_id", aulaIds)
      .eq("status", "confirmada");

    for (const r of (reservas ?? [])) {
      contagem[r.aula_id] = (contagem[r.aula_id] ?? 0) + 1;
    }
  }

  return (aulas ?? []).map((a) => ({
    ...a,
    status: a.status as StatusAula,
    reservas_confirmadas: contagem[a.id] ?? 0,
  }));
}

export async function atualizarStatusAula(
  aulaId: string,
  status: StatusAula,
  turmaId: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { error } = await admin.from("aulas").update({ status }).eq("id", aulaId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/admin/turmas/${turmaId}`);
  return { ok: true };
}

export async function atualizarAula(
  aulaId: string,
  turmaId: string,
  dados: { horario?: string; data?: string; lotacao_maxima?: number },
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { error } = await admin.from("aulas").update(dados).eq("id", aulaId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/admin/turmas/${turmaId}`);
  return { ok: true };
}

export async function excluirAula(aulaId: string, turmaId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  await admin.from("reservas").delete().eq("aula_id", aulaId);
  const { error } = await admin.from("aulas").delete().eq("id", aulaId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/admin/turmas/${turmaId}`);
  return { ok: true };
}

export async function adicionarAulaAvulsa(
  turmaId: string,
  data: string,
  horario: string,
  lotacaoMaxima: number,
): Promise<AdicionarAulaResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { data: nova, error } = await admin
    .from("aulas")
    .insert({ turma_id: turmaId, data, horario, lotacao_maxima: lotacaoMaxima, status: "agendada" })
    .select()
    .single();

  if (error || !nova) {
    if (error?.code === "23505") return { ok: false, erro: "Já existe uma aula nesta data e horário." };
    return { ok: false, erro: error?.message ?? "Erro ao criar aula." };
  }

  revalidatePath(`/admin/turmas/${turmaId}`);
  return { ok: true, aula: { ...nova, status: nova.status as StatusAula, reservas_confirmadas: 0 } };
}

export async function excluirTurma(turmaId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { data: aulasData } = await admin
    .from("aulas")
    .select("id")
    .eq("turma_id", turmaId);

  const aulaIds = (aulasData ?? []).map((a) => a.id as string);

  if (aulaIds.length > 0) {
    const { count } = await admin
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .in("aula_id", aulaIds);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        erro: "Não é possível excluir. Existem aulas com reservas. Inative a turma em vez disso.",
      };
    }
  }

  const { error } = await admin.from("turmas").delete().eq("id", turmaId);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/turmas");
  return { ok: true };
}

export async function buscarReservasPorAula(aulaId: string): Promise<ReservaComAluno[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reservas")
    .select("id, aula_id, aluno_id, status, criado_em, aluno:profiles(id, nome_completo)")
    .eq("aula_id", aulaId)
    .order("criado_em");
  return (data ?? []) as unknown as ReservaComAluno[];
}

export async function atualizarStatusReserva(
  reservaId: string,
  status: StatusReserva,
  turmaId: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { error } = await admin.from("reservas").update({ status }).eq("id", reservaId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath(`/admin/turmas/${turmaId}`);
  return { ok: true };
}
