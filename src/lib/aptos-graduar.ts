import type { createAdminClient } from "@/lib/supabase/admin";
import { calcularElegibilidade } from "@/lib/graduacao-rules";
import { fetchAllPresencasDias } from "@/lib/fetch-all-presencas";
import type { HistoricoGraduacao, CorFaixa, CategoriaFaixa } from "@/lib/types";

export interface AptoGraduar {
  id: string;
  nome_completo: string;
  faixa: CorFaixa;
  graus: number;
  categoria: CategoriaFaixa;
  proximaPromocao: { faixa: CorFaixa; graus: number };
  semanasQualificadas: number;
  semanasNecessarias: number;
}

/**
 * Alunos activos que cumprem os requisitos para a próxima graduação, ordenados
 * pela folga (semanas qualificadas − necessárias), maior primeiro. Só staff.
 */
export async function calcularAptosGraduar(admin: ReturnType<typeof createAdminClient>): Promise<AptoGraduar[]> {
  const aptos: AptoGraduar[] = [];

  const { data: alunosAtivos } = await admin
    .from("profiles")
    .select("id, nome_completo, faixa, graus, categoria, data_nascimento, created_at")
    .eq("perfil", "aluno")
    .eq("status", "ativo");

  const activeIds = (alunosAtivos ?? []).map((a) => a.id as string);
  if (activeIds.length === 0) return aptos;

  const [presencasAtivos, { data: historicoAtivos }] = await Promise.all([
    fetchAllPresencasDias(admin, activeIds),
    admin.from("historico_graduacoes")
      .select("id, aluno_id, faixa_nova, faixa_anterior, graus_nova, graus_anterior, data_graduacao, graduado_por, observacoes, created_at")
      .in("aluno_id", activeIds)
      .order("data_graduacao", { ascending: false }),
  ]);

  const diasByAluno: Record<string, string[]> = {};
  for (const pr of presencasAtivos) {
    const aid = pr.aluno_id;
    if (!diasByAluno[aid]) diasByAluno[aid] = [];
    diasByAluno[aid].push(pr.dia_registro);
  }

  const historicoByAluno: Record<string, HistoricoGraduacao[]> = {};
  for (const h of historicoAtivos ?? []) {
    const aid = h.aluno_id as string;
    if (!historicoByAluno[aid]) historicoByAluno[aid] = [];
    historicoByAluno[aid].push(h as HistoricoGraduacao);
  }

  for (const a of alunosAtivos ?? []) {
    if (!a.faixa) continue;
    const eleg = calcularElegibilidade(
      {
        faixa: a.faixa as CorFaixa,
        graus: (a.graus as number) ?? 0,
        categoria: ((a.categoria as string) ?? "adulto") as CategoriaFaixa,
        data_nascimento: (a.data_nascimento as string | null) ?? null,
        created_at: a.created_at as string,
      },
      diasByAluno[a.id as string] ?? [],
      historicoByAluno[a.id as string] ?? [],
    );
    if (eleg.elegivel && eleg.proximaPromocao) {
      aptos.push({
        id: a.id as string,
        nome_completo: a.nome_completo as string,
        faixa: a.faixa as CorFaixa,
        graus: (a.graus as number) ?? 0,
        categoria: ((a.categoria as string) ?? "adulto") as CategoriaFaixa,
        proximaPromocao: eleg.proximaPromocao,
        semanasQualificadas: eleg.semanasQualificadas,
        semanasNecessarias: eleg.semanasNecessarias,
      });
    }
  }

  aptos.sort((a, b) =>
    (b.semanasQualificadas - b.semanasNecessarias) -
    (a.semanasQualificadas - a.semanasNecessarias)
  );

  return aptos;
}
