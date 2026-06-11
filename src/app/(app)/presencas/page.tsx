import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PresencasView, type PresencaItem, type PessoaFiltro } from "./PresencasView";

const CORES_DEPENDENTES = ["#3B82F6", "#22C55E", "#A855F7", "#F97316", "#EC4899"];

export default async function PresencasPage() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: dependentesData }] = await Promise.all([
    supabase.from("profiles").select("id, nome_completo").eq("id", user.id).single(),
    supabase
      .from("dependentes")
      .select("dependente:profiles!dependentes_dependente_id_fkey(id, nome_completo)")
      .eq("responsavel_id", user.id),
  ]);

  const dependentes = (dependentesData ?? [])
    .map((d) => d.dependente as unknown as { id: string; nome_completo: string } | null)
    .filter((d): d is { id: string; nome_completo: string } => Boolean(d));

  const allIds = [user.id, ...dependentes.map((d) => d.id)];

  const { data: presencas } = await supabaseAdmin
    .from("presencas")
    .select("registrado_em, aluno_id")
    .in("aluno_id", allIds)
    .order("registrado_em", { ascending: false });

  const pessoas: PessoaFiltro[] = [
    { id: user.id, nome: profile?.nome_completo ?? "Eu", cor: "#CC0000" },
    ...dependentes.map((d, i) => ({
      id: d.id,
      nome: d.nome_completo,
      cor: CORES_DEPENDENTES[i % CORES_DEPENDENTES.length],
    })),
  ];

  const agora = new Date();

  return (
    <PresencasView
      presencas={(presencas ?? []) as PresencaItem[]}
      pessoas={pessoas}
      responsavelId={user.id}
      initialMes={agora.getMonth()}
      initialAno={agora.getFullYear()}
    />
  );
}
