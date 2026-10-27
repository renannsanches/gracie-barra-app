import { createAdminClient } from "@/lib/supabase/admin";
import { carregarEstadoGamificacao } from "@/lib/conquistas-sync";
import { hojeLisboa } from "@/lib/gamificacao";
import type { PessoaConquistas } from "./ConquistasView";
import type { SupabaseServer } from "../ranking/dados";

interface PessoaRow {
  id: string;
  nome_completo: string;
  perfil: string;
  aulas_manual: number | null;
  ocultar_ranking: boolean;
  data_inicio: string | null;
  created_at: string | null;
}

const CAMPOS = "id, nome_completo, perfil, aulas_manual, ocultar_ranking, data_inicio, created_at";

function anosDesde(inicio: string | undefined, hoje: string): number {
  if (!inicio) return 0;
  const anos = Number(hoje.slice(0, 4)) - Number(inicio.slice(0, 4));
  return hoje.slice(5) >= inicio.slice(5, 10) ? anos : anos - 1;
}

export async function carregarConquistas(supabase: SupabaseServer, userId: string): Promise<PessoaConquistas[]> {
  const [{ data: profile }, { data: dependentesData }] = await Promise.all([
    supabase.from("profiles").select(CAMPOS).eq("id", userId).single(),
    supabase
      .from("dependentes")
      .select(`dependente:profiles!dependentes_dependente_id_fkey(${CAMPOS})`)
      .eq("responsavel_id", userId),
  ]);

  const dependentes = (dependentesData ?? [])
    .map((d) => d.dependente as unknown as PessoaRow | null)
    .filter((d): d is PessoaRow => Boolean(d));
  const self = profile as PessoaRow | null;
  // Conta só de responsável não treina: mostra apenas os dependentes
  const pessoasRows = [...(self && self.perfil !== "responsavel" ? [self] : []), ...dependentes];

  const admin = createAdminClient();
  const ids = pessoasRows.map((p) => p.id);
  const [estado, { data: conquistas }] = await Promise.all([
    carregarEstadoGamificacao(admin, pessoasRows),
    ids.length > 0
      ? supabase
          .from("conquistas")
          .select("id, aluno_id, codigo, referencia, conquistada_em, vista_em")
          .in("aluno_id", ids)
          .order("conquistada_em", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const hoje = hojeLisboa();
  const pessoas: PessoaConquistas[] = pessoasRows.map((p) => {
    const e = estado[p.id];
    const inicio = [p.data_inicio, p.created_at?.slice(0, 10), e?.dias[0]].filter((d): d is string => !!d).sort()[0];
    return {
      id: p.id,
      nome: p.id === userId ? "Eu" : p.nome_completo.split(" ")[0],
      podeRanking: p.perfil === "aluno",
      ocultarRanking: p.ocultar_ranking,
      totalAulas: e?.totalAulas ?? p.aulas_manual ?? 0,
      sequencia: {
        atual: e?.sequencia.atual ?? 0,
        melhor: e?.sequencia.melhor ?? 0,
        semanaAulas: e?.sequencia.semanaAtual.aulas ?? 0,
        meta: e?.sequencia.semanaAtual.meta ?? 2,
      },
      anos: anosDesde(inicio, hoje),
      conquistas: (conquistas ?? [])
        .filter((c) => c.aluno_id === p.id)
        .map((c) => ({
          id: c.id as string,
          codigo: c.codigo as string,
          referencia: c.referencia as string,
          conquistadaEm: c.conquistada_em as string,
          nova: !c.vista_em,
        })),
    };
  });

  return pessoas;
}
