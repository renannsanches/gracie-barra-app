import type { createAdminClient } from "@/lib/supabase/admin";
import { calcularElegibilidade } from "@/lib/graduacao-rules";
import { fetchAllRows } from "@/lib/fetch-all";
import type { CorFaixa, CategoriaFaixa, HistoricoGraduacao } from "@/lib/types";

export interface AptosGraduarAluno {
  id: string;
  nome_completo: string;
  faixa: CorFaixa;
  graus: number;
  categoria: CategoriaFaixa;
  proximaPromocao: { faixa: CorFaixa; graus: number };
  semanasQualificadas: number;
  semanasNecessarias: number;
  dataElegibilidade: string | null;
}

/**
 * Lista completa (sem limite) de alunos activos aptos a graduar,
 * ordenada por quem está apto há mais tempo primeiro.
 */
export async function getAptosGraduar(
  admin: ReturnType<typeof createAdminClient>,
): Promise<AptosGraduarAluno[]> {
  const { data: alunosAtivos } = await admin
    .from("profiles")
    .select("id, nome_completo, faixa, graus, categoria, data_nascimento, created_at")
    .eq("perfil", "aluno")
    .eq("status", "ativo");

  const activeIds = (alunosAtivos ?? []).map((a) => a.id as string);
  if (activeIds.length === 0) return [];

  const [presencasAtivos, historicoAtivos] = await Promise.all([
    fetchAllRows<{ aluno_id: string; dia_registro: string }>((from, to) =>
      admin.from("presencas")
        .select("aluno_id, dia_registro")
        .in("aluno_id", activeIds)
        .range(from, to),
    ),
    fetchAllRows<HistoricoGraduacao>((from, to) =>
      admin.from("historico_graduacoes")
        .select("id, aluno_id, faixa_nova, faixa_anterior, graus_nova, graus_anterior, data_graduacao, graduado_por, observacoes, created_at")
        .in("aluno_id", activeIds)
        .order("data_graduacao", { ascending: false })
        .range(from, to),
    ),
  ]);

  const diasByAluno: Record<string, string[]> = {};
  for (const pr of presencasAtivos) {
    const aid = pr.aluno_id;
    if (!diasByAluno[aid]) diasByAluno[aid] = [];
    diasByAluno[aid].push(pr.dia_registro);
  }

  const historicoByAluno: Record<string, HistoricoGraduacao[]> = {};
  for (const h of historicoAtivos) {
    const aid = h.aluno_id;
    if (!historicoByAluno[aid]) historicoByAluno[aid] = [];
    historicoByAluno[aid].push(h);
  }

  const aptosGraduar: AptosGraduarAluno[] = [];

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
      aptosGraduar.push({
        id: a.id as string,
        nome_completo: a.nome_completo as string,
        faixa: a.faixa as CorFaixa,
        graus: (a.graus as number) ?? 0,
        categoria: ((a.categoria as string) ?? "adulto") as CategoriaFaixa,
        proximaPromocao: eleg.proximaPromocao,
        semanasQualificadas: eleg.semanasQualificadas,
        semanasNecessarias: eleg.semanasNecessarias,
        dataElegibilidade: eleg.dataElegibilidade,
      });
    }
  }

  aptosGraduar.sort((a, b) => {
    const da = a.dataElegibilidade ?? "9999-99-99";
    const db = b.dataElegibilidade ?? "9999-99-99";
    return da.localeCompare(db);
  });

  return aptosGraduar;
}
