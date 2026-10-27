import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Mensalidade, HistoricoGraduacao, DependentePerfil } from "@/lib/types";
import { ContaView } from "./ContaView";

export default async function ContaPage() {
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
    { data: dependentesData },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("mensalidades")
      .select("*")
      .eq("aluno_id", user.id)
      .order("mes_referencia", { ascending: false }),
    // Admin client: o nome do professor está noutro perfil, que o RLS não deixa o aluno ler
    createAdminClient()
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
      .gte("dia_registro", inicioMes),
    supabase
      .from("presencas")
      .select("registrado_em")
      .eq("aluno_id", user.id)
      .order("registrado_em", { ascending: false })
      .limit(1),
    supabase
      .from("dependentes")
      .select("dependente:profiles!dependentes_dependente_id_fkey(id, nome_completo, foto_url, faixa, graus, categoria)")
      .eq("responsavel_id", user.id),
  ]);

  const p = profile as Profile | null;
  const totalAulas = (p?.aulas_manual ?? 0) + (presencasCount ?? 0);
  const aulasMes = presencasMesCount ?? 0;
  const ultimoTreino = (ultimaPresenca?.[0] as { registrado_em: string } | undefined)?.registrado_em ?? null;

  const dependentesBase: DependentePerfil[] = (dependentesData ?? [])
    .map((d) => d.dependente as unknown as Omit<DependentePerfil, "mensalidades">)
    .filter(Boolean)
    .map((d) => ({ ...d, mensalidades: [] }));

  let dependentes: DependentePerfil[] = dependentesBase;
  if (dependentesBase.length > 0) {
    const { data: depMensalidades } = await supabase
      .from("mensalidades")
      .select("*")
      .in("aluno_id", dependentesBase.map((d) => d.id))
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

  return (
    <ContaView
      profile={p}
      email={user.email ?? ""}
      mensalidades={(mensalidades ?? []) as Mensalidade[]}
      historicoGraduacoes={(graduacoes ?? []) as HistoricoGraduacao[]}
      totalAulas={totalAulas}
      aulasMes={aulasMes}
      ultimoTreino={ultimoTreino}
      dependentes={dependentes}
    />
  );
}
