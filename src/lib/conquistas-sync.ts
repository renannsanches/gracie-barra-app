// Gamificação — leitura de dados e gravação de conquistas (só servidor, com o admin client).
// A lógica das regras está em gamificacao.ts; aqui só se busca, calcula e grava.
import type { createAdminClient } from "./supabase/admin";
import {
  addDias,
  calcularConquistas,
  calcularSequencia,
  DIAS_SEM_PUSH,
  grupoRanking,
  hojeLisboa,
  mesesTop3,
  top3DoMes,
  type ConquistaCalculada,
  type Sequencia,
} from "./gamificacao";

type Admin = ReturnType<typeof createAdminClient>;

export interface ConquistaNova extends ConquistaCalculada {
  id: string;
  aluno_id: string;
}

export interface ResultadoSync {
  alunos: number;
  novas: ConquistaNova[];
  porCodigo: Record<string, number>;
}

/** Datas de cada aula (Lisboa) por aluno; null = todos. */
export async function buscarDiasTreino(admin: Admin, alunoIds: string[] | null): Promise<Map<string, string[]>> {
  const { data, error } = await admin.rpc("dias_treino_alunos", { p_aluno_ids: alunoIds });
  if (error) throw new Error(`dias_treino_alunos: ${error.message}`);
  return new Map(((data ?? []) as { aluno_id: string; dias: string[] }[]).map((r) => [r.aluno_id, r.dias ?? []]));
}

export async function buscarSemanasAcademia(admin: Admin): Promise<string[]> {
  const { data, error } = await admin.rpc("semanas_com_treino");
  if (error) throw new Error(`semanas_com_treino: ${error.message}`);
  return (data as string[] | null) ?? [];
}

export interface EstadoAluno {
  dias: string[];
  totalAulas: number;
  sequencia: Sequencia;
}

/** Sequência e total de aulas (com base manual) de cada aluno, para mostrar. */
export async function carregarEstadoGamificacao(
  admin: Admin,
  alunos: { id: string; aulas_manual?: number | null }[],
): Promise<Record<string, EstadoAluno>> {
  if (alunos.length === 0) return {};
  const [dias, semanas] = await Promise.all([
    buscarDiasTreino(admin, alunos.map((a) => a.id)),
    buscarSemanasAcademia(admin),
  ]);
  const hoje = hojeLisboa();
  return Object.fromEntries(
    alunos.map((a) => {
      const d = dias.get(a.id) ?? [];
      return [a.id, { dias: d, totalAulas: d.length + (a.aulas_manual ?? 0), sequencia: calcularSequencia(d, semanas, hoje) }];
    }),
  );
}

interface PerfilSync {
  id: string;
  nome_completo: string;
  faixa: string | null;
  categoria: string | null;
  aulas_manual: number | null;
  data_inicio: string | null;
  created_at: string | null;
  ocultar_ranking: boolean;
}

/**
 * Calcula e grava as conquistas dos alunos activos (todos, ou só `alunoIds`).
 * Idempotente: o que já existe não é tocado. O Top 3 do mês só é calculado na corrida
 * de todos (precisa do ranking completo) — o cron diário trata disso.
 * Conquistas antigas (backfill) entram já como notificadas, para não gerar push.
 */
export async function sincronizarConquistas(
  admin: Admin,
  opts: { alunoIds?: string[]; dry?: boolean } = {},
): Promise<ResultadoSync> {
  const hoje = hojeLisboa();
  const todos = !opts.alunoIds;

  let q = admin
    .from("profiles")
    .select("id, nome_completo, faixa, categoria, aulas_manual, data_inicio, created_at, ocultar_ranking")
    .eq("perfil", "aluno")
    .eq("status", "ativo");
  if (opts.alunoIds) q = q.in("id", opts.alunoIds);
  const { data: perfis, error } = await q;
  if (error) throw new Error(`profiles: ${error.message}`);
  const alunos = (perfis ?? []) as PerfilSync[];
  if (alunos.length === 0) return { alunos: 0, novas: [], porCodigo: {} };

  const [dias, semanas] = await Promise.all([
    buscarDiasTreino(admin, todos ? null : alunos.map((a) => a.id)),
    buscarSemanasAcademia(admin),
  ]);

  // Top 3 de cada mês fechado (só na corrida de todos)
  const top3PorAluno = new Map<string, string[]>();
  if (todos) {
    const participantes = alunos
      .filter((a) => !a.ocultar_ranking)
      .map((a) => ({
        alunoId: a.id,
        nome: a.nome_completo,
        grupo: grupoRanking(a.faixa, a.categoria),
        dias: dias.get(a.id) ?? [],
      }));
    for (const mes of mesesTop3(hoje)) {
      for (const id of top3DoMes(participantes, mes)) {
        top3PorAluno.set(id, [...(top3PorAluno.get(id) ?? []), mes]);
      }
    }
  }

  const limitePush = addDias(hoje, -DIAS_SEM_PUSH);
  const agora = new Date().toISOString();
  const linhas = alunos.flatMap((a) =>
    calcularConquistas({
      dias: dias.get(a.id) ?? [],
      semanasAcademia: semanas,
      aulasManual: a.aulas_manual ?? 0,
      inicioCandidatos: [a.data_inicio, a.created_at],
      mesesTop3: top3PorAluno.get(a.id) ?? [],
      hoje,
    }).map((c) => ({
      aluno_id: a.id,
      ...c,
      notificada_em: c.conquistada_em < limitePush ? agora : null,
    })),
  );

  let novas: ConquistaNova[];
  if (opts.dry) {
    const existentes = await buscarChavesExistentes(admin, todos ? null : alunos.map((a) => a.id));
    novas = linhas
      .filter((l) => !existentes.has(`${l.aluno_id}|${l.codigo}|${l.referencia}`))
      .map((l) => ({ id: "", aluno_id: l.aluno_id, codigo: l.codigo, referencia: l.referencia, conquistada_em: l.conquistada_em }));
  } else {
    novas = [];
    for (let i = 0; i < linhas.length; i += 500) {
      const { data, error: errIns } = await admin
        .from("conquistas")
        .upsert(linhas.slice(i, i + 500), { onConflict: "aluno_id,codigo,referencia", ignoreDuplicates: true })
        .select("id, aluno_id, codigo, referencia, conquistada_em");
      if (errIns) throw new Error(`conquistas: ${errIns.message}`);
      novas.push(...((data ?? []) as ConquistaNova[]));
    }
  }

  const porCodigo: Record<string, number> = {};
  for (const n of novas) porCodigo[n.codigo] = (porCodigo[n.codigo] ?? 0) + 1;
  return { alunos: alunos.length, novas, porCodigo };
}

async function buscarChavesExistentes(admin: Admin, alunoIds: string[] | null): Promise<Set<string>> {
  const chaves = new Set<string>();
  for (let de = 0; ; de += 1000) {
    let q = admin.from("conquistas").select("aluno_id, codigo, referencia").order("id").range(de, de + 999);
    if (alunoIds) q = q.in("aluno_id", alunoIds);
    const { data, error } = await q;
    if (error) throw new Error(`conquistas: ${error.message}`);
    for (const c of data ?? []) chaves.add(`${c.aluno_id}|${c.codigo}|${c.referencia}`);
    if (!data || data.length < 1000) return chaves;
  }
}
