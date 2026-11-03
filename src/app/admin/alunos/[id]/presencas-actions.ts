"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { sincronizarConquistas } from "@/lib/conquistas-sync";
import {
  atribuirPresencasAAulas,
  aulaDoAluno,
  diaLisboa,
  ehPresencaAvulsa,
  instanteAulaLisboa,
  type AulaHorario,
} from "@/lib/presenca-manual";
import type { ActionResult } from "@/lib/types";

export interface AulaDia {
  id: string;
  horario: string; // HH:MM
  turma: string;
  registada: boolean; // já há presença do aluno para esta aula
  doAluno: boolean;   // turma da categoria do aluno
}

export interface DiaPresencas {
  aulas: AulaDia[];
  presencas: number; // presenças do aluno neste dia (todas)
  avulsas: number;   // presenças antigas sem aula (12:00 UTC)
}

export interface MesAulasResult extends ActionResult {
  dias?: Record<string, DiaPresencas>;
}

export interface NovasPresencasResult extends ActionResult {
  adicionadas?: number;
  duplicadas?: number;
  novas?: { id: string; registrado_em: string; aluno_id: string }[];
}

type AulaRow = {
  id: string;
  data: string;
  horario: string;
  status: string;
  turma: { nome: string; categoria: string; ativa: boolean; apenas_experimental: boolean } | null;
};

const SELECT_AULA = "id, data, horario, status, turma:turmas(nome, categoria, ativa, apenas_experimental)";

/** Aula que pode receber presença: agendada, de turma activa e não só experimental. */
function aulaValida(a: AulaRow): boolean {
  return a.status === "agendada" && !!a.turma && a.turma.ativa && !a.turma.apenas_experimental;
}

function hojeLisboa(): string {
  return diaLisboa(new Date().toISOString());
}

/** Dia anterior/seguinte (YYYY-MM-DD), para apanhar presenças à volta da meia-noite. */
function somarDias(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function presencasEntre(admin: ReturnType<typeof createAdminClient>, alunoId: string, de: string, ate: string) {
  const { data, error } = await admin
    .from("presencas")
    .select("registrado_em")
    .eq("aluno_id", alunoId)
    .gte("registrado_em", `${somarDias(de, -1)}T00:00:00Z`)
    .lt("registrado_em", `${somarDias(ate, 2)}T00:00:00Z`);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => p.registrado_em as string);
}

/** Aulas de um mês (até agora), já marcadas com o que o aluno tem registado. */
export async function aulasDoMes(alunoId: string, mes: string): Promise<MesAulasResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, erro: "Mês inválido." };

  const hoje = hojeLisboa();
  const inicio = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const fim = ultimo < hoje ? ultimo : hoje;
  if (inicio > hoje) return { ok: true, dias: {} };

  const admin = createAdminClient();
  try {
    const [{ data: perfil }, { data: aulasRows, error }, presencas] = await Promise.all([
      admin.from("profiles").select("categoria").eq("id", alunoId).single(),
      admin.from("aulas").select(SELECT_AULA).gte("data", inicio).lte("data", fim).order("data").order("horario"),
      presencasEntre(admin, alunoId, inicio, fim),
    ]);
    if (error) return { ok: false, erro: error.message };

    const agora = Date.now();
    const aulas = ((aulasRows ?? []) as unknown as AulaRow[])
      .filter(aulaValida)
      .filter((a) => Date.parse(instanteAulaLisboa(a.data, a.horario)) <= agora);
    const registadas = atribuirPresencasAAulas(aulas as AulaHorario[], presencas);
    const categoria = (perfil?.categoria as string | null) ?? null;

    const dias: Record<string, DiaPresencas> = {};
    const dia = (d: string) => (dias[d] ??= { aulas: [], presencas: 0, avulsas: 0 });

    for (const a of aulas) {
      dia(a.data).aulas.push({
        id: a.id,
        horario: a.horario.slice(0, 5),
        turma: a.turma!.nome,
        registada: registadas.has(a.id),
        doAluno: aulaDoAluno(a.turma!.categoria, categoria),
      });
    }
    for (const iso of presencas) {
      const d = diaLisboa(iso);
      if (d < inicio || d > fim) continue;
      dia(d).presencas++;
      if (ehPresencaAvulsa(iso)) dia(d).avulsas++;
    }
    return { ok: true, dias };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao carregar aulas." };
  }
}

/**
 * Grava uma presença por aula escolhida, à hora da aula (Lisboa).
 * `avulsas` = dias sem aulas no sistema (antes de maio/2026): presença às 12:00 UTC, como antes.
 */
export async function adicionarPresencasPorAula(
  alunoId: string,
  escolha: { aulaIds: string[]; avulsas: string[] },
): Promise<NovasPresencasResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const aulaIds = [...new Set(escolha.aulaIds)];
  const hoje = hojeLisboa();
  const avulsas = [...new Set(escolha.avulsas)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= hoje);
  if (aulaIds.length + avulsas.length === 0) return { ok: false, erro: "Escolhe pelo menos uma aula." };
  if (aulaIds.length + avulsas.length > 100) return { ok: false, erro: "Demasiadas presenças de uma vez." };

  const admin = createAdminClient();
  const linhas: { aluno_id: string; registrado_em: string }[] = [];
  let duplicadas = 0;

  if (aulaIds.length) {
    const { data: escolhidasRows, error } = await admin.from("aulas").select(SELECT_AULA).in("id", aulaIds);
    if (error) return { ok: false, erro: error.message };
    const escolhidas = (escolhidasRows ?? []) as unknown as AulaRow[];
    if (escolhidas.length !== aulaIds.length || !escolhidas.every(aulaValida)) {
      return { ok: false, erro: "Uma das aulas já não existe ou foi cancelada. Recarrega a página." };
    }
    const agora = Date.now();
    if (escolhidas.some((a) => Date.parse(instanteAulaLisboa(a.data, a.horario)) > agora)) {
      return { ok: false, erro: "Não é possível registar presença numa aula que ainda não começou." };
    }

    // Duplicados: a atribuição usa todas as aulas desses dias (a mais próxima ganha)
    const datas = [...new Set(escolhidas.map((a) => a.data))].sort();
    const [{ data: doDiaRows, error: errDia }, presencas] = await Promise.all([
      admin.from("aulas").select(SELECT_AULA).in("data", datas),
      presencasEntre(admin, alunoId, datas[0], datas[datas.length - 1]).catch(() => null),
    ]);
    if (errDia || !presencas) return { ok: false, erro: errDia?.message ?? "Erro ao ler presenças." };
    const doDia = ((doDiaRows ?? []) as unknown as AulaRow[]).filter(aulaValida);
    const registadas = atribuirPresencasAAulas(doDia as AulaHorario[], presencas);

    // Uma presença por horário: duas turmas à mesma hora contam uma vez
    const instantes = new Set<string>();
    for (const a of escolhidas) {
      const instante = instanteAulaLisboa(a.data, a.horario);
      if (registadas.has(a.id) || instantes.has(instante)) { duplicadas++; continue; }
      instantes.add(instante);
      linhas.push({ aluno_id: alunoId, registrado_em: instante });
    }
  }

  for (const d of avulsas) linhas.push({ aluno_id: alunoId, registrado_em: `${d}T12:00:00+00:00` });

  if (!linhas.length) return { ok: true, adicionadas: 0, duplicadas, novas: [] };

  const { data: inseridas, error } = await admin.from("presencas").insert(linhas).select("id, registrado_em");
  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/alunos/${alunoId}`);
  // Medalhas novas (marcos, sequências) — depois da resposta
  after(() =>
    sincronizarConquistas(createAdminClient(), { alunoIds: [alunoId] }).catch((e) =>
      console.error("[admin presenças] sincronizarConquistas", e),
    ),
  );

  return {
    ok: true,
    adicionadas: inseridas?.length ?? 0,
    duplicadas,
    novas: (inseridas ?? []).map((r) => ({ id: r.id as string, registrado_em: r.registrado_em as string, aluno_id: alunoId })),
  };
}
