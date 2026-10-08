import { createAdminClient } from "@/lib/supabase/admin";
import { listarGrupos } from "@/lib/grupos";
import type { Profile } from "@/lib/types";
import { AlunosView } from "./AlunosView";

export default async function AdminAlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string }>;
}) {
  const supabase = createAdminClient();

  const [{ data }, { data: dependentesRows }, grupos, params] = await Promise.all([
    supabase.from("profiles").select("*").neq("perfil", "tablet").order("nome_completo"),
    supabase.from("dependentes").select("dependente_id, responsavel_id"),
    listarGrupos(supabase),
    searchParams,
  ]);

  // ?grupo=<id> vindo da página de Grupos abre a lista já filtrada
  const grupoInicial = grupos.some((g) => g.id === params.grupo) ? params.grupo! : "";

  const alunos = (data ?? []) as Profile[];

  const profilesById = new Map(alunos.map((a) => [a.id, a.nome_completo]));
  const responsaveisMap: Record<string, string> = {};
  for (const row of dependentesRows ?? []) {
    const nome = profilesById.get(row.responsavel_id as string);
    if (nome) responsaveisMap[row.dependente_id as string] = nome;
  }

  return (
    <AlunosView
      key={grupoInicial}
      alunos={alunos}
      responsaveisMap={responsaveisMap}
      grupos={grupos}
      grupoInicial={grupoInicial}
    />
  );
}
