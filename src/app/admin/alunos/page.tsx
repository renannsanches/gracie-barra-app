import { createAdminClient } from "@/lib/supabase/admin";
import { listarGrupos } from "@/lib/grupos";
import { listarModalidades } from "@/lib/modalidades";
import type { Profile } from "@/lib/types";
import { AlunosView } from "./AlunosView";

export default async function AdminAlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string; modalidade?: string }>;
}) {
  const supabase = createAdminClient();

  const [{ data }, { data: dependentesRows }, grupos, params, modalidades, { data: inscricoes }] = await Promise.all([
    supabase.from("profiles").select("*").neq("perfil", "tablet").order("nome_completo"),
    supabase.from("dependentes").select("dependente_id, responsavel_id"),
    listarGrupos(supabase),
    searchParams,
    listarModalidades(supabase),
    supabase.from("aluno_modalidades").select("aluno_id, modalidade_id"),
  ]);

  // ?grupo=<id> vindo da página de Grupos abre a lista já filtrada
  const grupoInicial = grupos.some((g) => g.id === params.grupo) ? params.grupo! : "";
  // ?modalidade=<id> vindo da página de Modalidades
  const modalidadeInicial = modalidades.some((m) => m.id === params.modalidade) ? params.modalidade! : "";

  const modalidadesPorAluno: Record<string, string[]> = {};
  for (const i of inscricoes ?? []) {
    (modalidadesPorAluno[i.aluno_id as string] ??= []).push(i.modalidade_id as string);
  }

  const alunos = (data ?? []) as Profile[];

  const profilesById = new Map(alunos.map((a) => [a.id, a.nome_completo]));
  const responsaveisMap: Record<string, string> = {};
  for (const row of dependentesRows ?? []) {
    const nome = profilesById.get(row.responsavel_id as string);
    if (nome) responsaveisMap[row.dependente_id as string] = nome;
  }

  return (
    <AlunosView
      key={`${grupoInicial}|${modalidadeInicial}`}
      alunos={alunos}
      responsaveisMap={responsaveisMap}
      grupos={grupos}
      grupoInicial={grupoInicial}
      modalidades={modalidades}
      modalidadesPorAluno={modalidadesPorAluno}
      modalidadeInicial={modalidadeInicial}
    />
  );
}
