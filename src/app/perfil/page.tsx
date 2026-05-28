import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularElegibilidade } from "@/lib/graduacao-rules";
import type { Profile, Mensalidade, HistoricoGraduacao, DependentePerfil, CorFaixa, CategoriaFaixa } from "@/lib/types";
import { PerfilView } from "./PerfilView";

interface AptosGraduarAluno {
  id: string;
  nome_completo: string;
  faixa: CorFaixa;
  graus: number;
  categoria: CategoriaFaixa;
  proximaPromocao: { faixa: CorFaixa; graus: number };
  semanasQualificadas: number;
  semanasNecessarias: number;
}

export default async function PerfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const now = new Date();
  const inicioMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    { data: profile },
    { data: mensalidades },
    { data: graduacoes },
    { count: presencasCount },
    { count: presencasMesCount },
    { data: ultimaPresenca },
    { data: avisosData },
    { data: dependentesData },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("mensalidades")
      .select("*")
      .eq("aluno_id", user.id)
      .order("mes_referencia", { ascending: false }),
    supabase
      .from("historico_graduacoes")
      .select("*, professor:profiles!historico_graduacoes_graduado_por_fkey(nome_completo)")
      .eq("aluno_id", user.id)
      .order("data_graduacao", { ascending: false }),
    supabase
      .from("presencas")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", user.id),
    supabase
      .from("presencas")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", user.id)
      .gte("data_presenca", inicioMes),
    supabase
      .from("presencas")
      .select("data_presenca")
      .eq("aluno_id", user.id)
      .order("data_presenca", { ascending: false })
      .limit(1),
    supabase
      .from("avisos")
      .select("id, titulo, created_at")
      .eq("publicado", true)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("dependentes")
      .select("dependente:profiles!dependentes_dependente_id_fkey(id, nome_completo, foto_url, faixa, graus, categoria)")
      .eq("responsavel_id", user.id),
  ]);

  const p = profile as Profile;
  const totalAulas = (p?.aulas_manual ?? 0) + (presencasCount ?? 0);
  const aulasMes = presencasMesCount ?? 0;
  const ultimoTreino = (ultimaPresenca?.[0] as { data_presenca: string } | undefined)?.data_presenca ?? null;
  const avisosNotif = (avisosData ?? []).map((a) => ({
    id: a.id as string,
    titulo: a.titulo as string,
    created_at: a.created_at as string,
  }));

  const dependentesBase: DependentePerfil[] = (dependentesData ?? [])
    .map((d) => d.dependente as unknown as Omit<DependentePerfil, "mensalidades">)
    .filter(Boolean)
    .map((d) => ({ ...d, mensalidades: [] }));

  let dependentes: DependentePerfil[] = dependentesBase;
  if (dependentesBase.length > 0) {
    const depIds = dependentesBase.map((d) => d.id);
    const { data: depMensalidades } = await supabase
      .from("mensalidades")
      .select("*")
      .in("aluno_id", depIds)
      .order("mes_referencia", { ascending: false });

    if (depMensalidades) {
      const byAluno = new Map<string, Mensalidade[]>();
      for (const m of depMensalidades as Mensalidade[]) {
        if (!byAluno.has(m.aluno_id)) byAluno.set(m.aluno_id, []);
        byAluno.get(m.aluno_id)!.push(m);
      }
      dependentes = dependentesBase.map((d) => ({ ...d, mensalidades: byAluno.get(d.id) ?? [] }));
    }
  }

  const isAdminOrProfessor = p?.perfil === "admin" || p?.perfil === "professor";
  let aptosGraduar: AptosGraduarAluno[] = [];

  if (isAdminOrProfessor) {
    const admin = createAdminClient();
    const { data: alunosAtivos } = await admin
      .from("profiles")
      .select("id, nome_completo, faixa, graus, categoria, data_nascimento, created_at")
      .eq("perfil", "aluno")
      .eq("status", "ativo");

    const activeIds = (alunosAtivos ?? []).map((a) => a.id as string);

    if (activeIds.length > 0) {
      const [{ data: presencasAtivos }, { data: historicoAtivos }] = await Promise.all([
        admin.from("presencas")
          .select("aluno_id, dia_registro")
          .in("aluno_id", activeIds),
        admin.from("historico_graduacoes")
          .select("id, aluno_id, faixa_nova, faixa_anterior, graus_nova, graus_anterior, data_graduacao, graduado_por, observacoes, created_at")
          .in("aluno_id", activeIds)
          .order("data_graduacao", { ascending: false }),
      ]);

      const diasByAluno: Record<string, string[]> = {};
      for (const pr of presencasAtivos ?? []) {
        const aid = pr.aluno_id as string;
        if (!diasByAluno[aid]) diasByAluno[aid] = [];
        diasByAluno[aid].push(pr.dia_registro as string);
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
          aptosGraduar.push({
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
    }
  }

  return (
    <PerfilView
      profile={p}
      email={user.email ?? ""}
      mensalidades={(mensalidades ?? []) as Mensalidade[]}
      historicoGraduacoes={(graduacoes ?? []) as HistoricoGraduacao[]}
      totalAulas={totalAulas}
      aulasMes={aulasMes}
      ultimoTreino={ultimoTreino}
      avisosNotif={avisosNotif}
      dependentes={dependentes}
      aptosGraduar={aptosGraduar}
    />
  );
}
