"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

export interface CriarTurmaResult {
  ok: boolean;
  turmaId?: string;
  erro?: string;
}

export async function criarTurma(formData: FormData): Promise<CriarTurmaResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const nome          = ((formData.get("nome") as string) ?? "").trim();
  const dia_semana    = Number(formData.get("dia_semana") ?? 1);
  const horario       = ((formData.get("horario") as string) ?? "").trim();
  const recorrencia   = (formData.get("recorrencia") as string) || "semanal";
  const lotacao_maxima = Number(formData.get("lotacao_maxima") || 20);
  const categoria     = (formData.get("categoria") as string) || "adulto";
  const professor_id  = (formData.get("professor_id") as string) || null;
  const modalidade_id = (formData.get("modalidade_id") as string) || null;
  const gerarSemanas  = Number(formData.get("gerar_semanas") || 0);

  if (!nome)    return { ok: false, erro: "Nome é obrigatório." };
  if (!horario) return { ok: false, erro: "Horário é obrigatório." };
  if (isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
    return { ok: false, erro: "Dia da semana inválido." };
  }
  if (isNaN(lotacao_maxima) || lotacao_maxima < 1) {
    return { ok: false, erro: "Lotação inválida." };
  }

  const admin = createAdminClient();

  if (modalidade_id) {
    const { data: mod } = await admin.from("modalidades").select("id").eq("id", modalidade_id).maybeSingle();
    if (!mod) return { ok: false, erro: "Modalidade inválida." };
  }

  const { data: nova, error } = await admin
    .from("turmas")
    .insert({
      nome,
      dia_semana,
      horario,
      recorrencia,
      lotacao_maxima,
      categoria,
      professor_id: professor_id || null,
      // Sem modalidade escolhida, a BD usa a padrão (DEFAULT)
      ...(modalidade_id ? { modalidade_id } : {}),
      ativa: true,
    })
    .select("id")
    .single();

  if (error || !nova) return { ok: false, erro: error?.message ?? "Erro ao criar turma." };

  if (gerarSemanas > 0) {
    await admin.rpc("gerar_aulas", { p_turma_id: nova.id, p_semanas: gerarSemanas });
  }

  revalidatePath("/admin/turmas");
  return { ok: true, turmaId: nova.id };
}
