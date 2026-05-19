import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Mensalidade, HistoricoGraduacao } from "@/lib/types";
import type { PresencaItem } from "@/components/PresencasCalendario";
import { calcularElegibilidade, type ElegibilidadeResult } from "@/lib/graduacao-rules";
import { AlunoEditView } from "./AlunoEditView";

interface Props { params: Promise<{ id: string }>; }

export type ProfileSimples = { id: string; nome_completo: string };

export default async function AlunoDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [
    { data: aluno },
    { data: presencas },
    { data: mensalidades },
    { data: graduacoes },
    { data: responsavelRow },
    { data: dependentesRows },
    { data: alunosComLoginRows },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("presencas")
      .select("id, registrado_em")
      .eq("aluno_id", id)
      .order("registrado_em", { ascending: false }),
    supabase
      .from("mensalidades")
      .select("*")
      .eq("aluno_id", id)
      .order("mes_referencia", { ascending: false }),
    supabase
      .from("historico_graduacoes")
      .select("*, professor:profiles!historico_graduacoes_graduado_por_fkey(nome_completo)")
      .eq("aluno_id", id)
      .order("data_graduacao", { ascending: false }),
    supabase
      .from("dependentes")
      .select("responsavel_id")
      .eq("dependente_id", id)
      .maybeSingle(),
    supabase
      .from("dependentes")
      .select("dependente_id")
      .eq("responsavel_id", id),
    supabase
      .from("profiles")
      .select("id, nome_completo")
      .neq("id", id)
      .or("sem_login.is.null,sem_login.eq.false")
      .order("nome_completo"),
  ]);

  if (!aluno) notFound();

  const alunoProfile = aluno as Profile;
  const presencasDias = (presencas ?? []).map((p) => (p as PresencaItem).registrado_em.split("T")[0]);
  const historicoGrad = (graduacoes ?? []) as HistoricoGraduacao[];
  const elegibilidade: ElegibilidadeResult | null = alunoProfile.faixa
    ? calcularElegibilidade(alunoProfile, presencasDias, historicoGrad)
    : null;

  const todosProfiles = (alunosComLoginRows ?? []) as ProfileSimples[];

  const responsavelId = responsavelRow?.responsavel_id ?? null;
  const dependentesIds = (dependentesRows ?? []).map((r) => r.dependente_id as string);

  const [responsavelProfile, dependentesProfiles] = await Promise.all([
    responsavelId && !todosProfiles.find((p) => p.id === responsavelId)
      ? supabase.from("profiles").select("id, nome_completo").eq("id", responsavelId).single().then((r) => r.data as ProfileSimples | null)
      : Promise.resolve(responsavelId ? (todosProfiles.find((p) => p.id === responsavelId) ?? null) : null),
    dependentesIds.length > 0
      ? supabase.from("profiles").select("id, nome_completo").in("id", dependentesIds).then((r) => (r.data ?? []) as ProfileSimples[])
      : Promise.resolve([] as ProfileSimples[]),
  ]);

  return (
    <AlunoEditView
      aluno={alunoProfile}
      presencas={(presencas ?? []) as PresencaItem[]}
      mensalidades={(mensalidades ?? []) as Mensalidade[]}
      graduacoes={historicoGrad}
      elegibilidade={elegibilidade}
      responsavel={responsavelProfile}
      dependentesDoAluno={dependentesProfiles}
      alunosComLogin={todosProfiles}
    />
  );
}
