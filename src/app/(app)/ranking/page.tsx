import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { grupoRanking, hojeLisboa, limitesPeriodo, nomeRanking } from "@/lib/gamificacao";
import { RankingView, type LinhaRanking } from "./RankingView";

interface RankingRow {
  aluno_id: string;
  nome_completo: string;
  foto_url: string | null;
  faixa: string | null;
  graus: number;
  categoria: string | null;
  aulas: number;
}

function paraLinhas(rows: RankingRow[] | null): LinhaRanking[] {
  return (rows ?? []).map((r) => {
    const grupo = grupoRanking(r.faixa, r.categoria);
    return {
      alunoId: r.aluno_id,
      nome: nomeRanking(r.nome_completo, grupo),
      foto: r.foto_url,
      faixa: r.faixa,
      graus: r.graus,
      grupo,
      aulas: r.aulas,
    };
  });
}

export default async function RankingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const hoje = hojeLisboa();
  const mes = limitesPeriodo("mes", hoje);
  const ano = limitesPeriodo("ano", hoje);

  const [{ data: profile }, { data: dependentesData }, rankingMes, rankingAno] = await Promise.all([
    supabase.from("profiles").select("id, perfil, faixa, categoria, ocultar_ranking").eq("id", user.id).single(),
    supabase
      .from("dependentes")
      .select("dependente:profiles!dependentes_dependente_id_fkey(id, faixa, categoria)")
      .eq("responsavel_id", user.id),
    admin.rpc("ranking_presencas", { p_inicio: mes.inicio, p_fim: mes.fim }),
    admin.rpc("ranking_presencas", { p_inicio: ano.inicio, p_fim: ano.fim }),
  ]);

  const dependentes = (dependentesData ?? [])
    .map((d) => d.dependente as unknown as { id: string; faixa: string | null; categoria: string | null } | null)
    .filter((d): d is { id: string; faixa: string | null; categoria: string | null } => Boolean(d));

  const treina = profile?.perfil === "aluno";
  // Separador por defeito: o do próprio aluno, ou o do 1.º dependente (conta só de responsável)
  const referencia = treina ? profile : dependentes[0];
  const grupoPadrao = referencia ? grupoRanking(referencia.faixa, referencia.categoria) : "adulto";

  const nomeMes = new Intl.DateTimeFormat("pt-PT", { month: "long", timeZone: "UTC" }).format(
    new Date(`${mes.inicio}T12:00:00Z`),
  );

  return (
    <RankingView
      mes={paraLinhas(rankingMes.data as RankingRow[] | null)}
      ano={paraLinhas(rankingAno.data as RankingRow[] | null)}
      rotuloMes={nomeMes}
      rotuloAno={hoje.slice(0, 4)}
      minhasPessoas={[user.id, ...dependentes.map((d) => d.id)]}
      grupoPadrao={grupoPadrao}
      eu={treina ? { id: user.id, oculto: profile?.ocultar_ranking ?? false } : null}
    />
  );
}
