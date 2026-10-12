import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarGrupos } from "@/lib/grupos";
import { listarModalidades, type DescontoPlano } from "@/lib/modalidades";
import type { Profile, Mensalidade, HistoricoGraduacao, AlunoModalidade } from "@/lib/types";
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
    authUserResult,
    grupos,
    modalidades,
    { data: planoRows },
    { data: descontosRows },
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
    supabase.auth.admin.getUserById(id),
    listarGrupos(supabase),
    listarModalidades(supabase),
    supabase.from("aluno_modalidades").select("aluno_id, modalidade_id, valor, cobrar").eq("aluno_id", id),
    supabase.from("aluno_descontos").select("descricao, valor, origem_modalidade_id").eq("aluno_id", id).order("criado_em"),
  ]);

  if (!aluno) notFound();

  const alunoProfile = aluno as Profile;
  const presencasDias = (presencas ?? []).map((p) => (p as PresencaItem).registrado_em.split("T")[0]);
  const historicoGrad = (graduacoes ?? []) as HistoricoGraduacao[];
  const elegibilidade: ElegibilidadeResult | null = alunoProfile.faixa
    ? calcularElegibilidade(alunoProfile, presencasDias, historicoGrad)
    : null;

  const todosProfiles = (alunosComLoginRows ?? []) as ProfileSimples[];
  const emailAluno = authUserResult?.data?.user?.email ?? null;

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
      email={emailAluno}
      presencas={(presencas ?? []) as PresencaItem[]}
      mensalidades={(mensalidades ?? []) as Mensalidade[]}
      graduacoes={historicoGrad}
      elegibilidade={elegibilidade}
      responsavel={responsavelProfile}
      dependentesDoAluno={dependentesProfiles}
      alunosComLogin={todosProfiles}
      grupos={grupos}
      modalidades={modalidades}
      descontosIniciais={((descontosRows ?? []) as DescontoPlano[]).map((d) => ({ ...d, valor: Number(d.valor) }))}
      planoInicial={((planoRows ?? []) as AlunoModalidade[])
        .map((r) => ({ ...r, valor: Number(r.valor) }))
        // mesma ordem da lista de modalidades (padrão primeiro)
        .sort((a, b) =>
          modalidades.findIndex((m) => m.id === a.modalidade_id) -
          modalidades.findIndex((m) => m.id === b.modalidade_id))}
    />
  );
}
