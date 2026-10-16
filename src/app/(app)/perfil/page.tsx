import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularElegibilidade, ordenarAptosGraduar } from "@/lib/graduacao-rules";
import { fetchAllPresencasDias } from "@/lib/fetch-all-presencas";
import type { Profile, Mensalidade, HistoricoGraduacao, DependentePerfil, CorFaixa, CategoriaFaixa } from "@/lib/types";
import { PerfilView } from "./PerfilView";
import { GraduacaoAptosModal } from "@/components/GraduacaoAptosModal";
import { CHAVE_AVISO_GRADUACAO, janelaAvisoGraduacao } from "@/lib/aviso-graduacao";
import { NovaConquistaModal, type ConquistaPorVer } from "@/components/NovaConquistaModal";
import { carregarEstadoGamificacao } from "@/lib/conquistas-sync";
import { getDiasAtraso, getMaiorAtraso } from "@/lib/mensalidade-status";
import { hojeLisboa } from "@/lib/gamificacao";
import { escolherProximaReserva, formatarQuando, horaLisboa, type LinhaReserva } from "@/lib/proxima-reserva";
import { rotulosModalidades } from "@/lib/modalidades";
import { formatarMes } from "@/lib/utils";
import type { AptoGraduar, KpisAdmin, ProximaAulaHome, ResumoGamificacao } from "./home-tipos";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** A partir daqui o MensalidadeVencidaBanner do layout já avisa — a home não repete. */
const DIAS_BANNER_MENSALIDADE = 5;

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const ultimoTreino = (ultimaPresenca?.[0] as { registrado_em: string } | undefined)?.registrado_em ?? null;
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
  let aptosGraduar: AptoGraduar[] = [];
  let kpisAdmin: KpisAdmin | null = null;

  if (isAdminOrProfessor) {
    const admin = createAdminClient();
    const isAdmin = p.perfil === "admin";
    // Mesmas janelas e regras dos cards do /admin
    const fimMes = fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const hojeStr = fmt(now);

    const [{ data: alunosAtivos }, { count: presencasMesAcademia }, { data: atrasadas }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, nome_completo, faixa, graus, categoria, data_nascimento, created_at")
        .eq("perfil", "aluno")
        .eq("status", "ativo"),
      admin
        .from("presencas")
        .select("*", { count: "exact", head: true })
        .gte("dia_registro", inicioMes)
        .lte("dia_registro", fimMes),
      isAdmin
        ? admin.from("mensalidades").select("aluno_id").neq("status", "pago").lt("data_vencimento", hojeStr)
        : Promise.resolve({ data: null }),
    ]);

    kpisAdmin = {
      ativos: (alunosAtivos ?? []).length,
      presencasMes: presencasMesAcademia ?? 0,
      mes: MESES_PT[now.getMonth()],
      emAtraso: isAdmin ? new Set((atrasadas ?? []).map((m) => m.aluno_id as string)).size : null,
    };

    const activeIds = (alunosAtivos ?? []).map((a) => a.id as string);

    if (activeIds.length > 0) {
      const [presencasAtivos, { data: historicoAtivos }] = await Promise.all([
        fetchAllPresencasDias(admin, activeIds),
        admin.from("historico_graduacoes")
          .select("id, aluno_id, faixa_nova, faixa_anterior, graus_nova, graus_anterior, data_graduacao, graduado_por, observacoes, created_at")
          .in("aluno_id", activeIds)
          .order("data_graduacao", { ascending: false }),
      ]);

      const diasByAluno: Record<string, string[]> = {};
      for (const pr of presencasAtivos) {
        const aid = pr.aluno_id;
        if (!diasByAluno[aid]) diasByAluno[aid] = [];
        diasByAluno[aid].push(pr.dia_registro);
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

      aptosGraduar = ordenarAptosGraduar(aptosGraduar);
    }
  }

  const janelaAviso = janelaAvisoGraduacao();
  const mostrarAvisoGraduacao =
    isAdminOrProfessor &&
    aptosGraduar.length > 0 &&
    user.user_metadata?.[CHAVE_AVISO_GRADUACAO] !== janelaAviso;

  // Gamificação: sequência e medalhas do próprio (se treina) e dos dependentes.
  // Uma falha aqui não pode partir a página principal da app.
  const pessoasGamificacao = [
    ...(p?.perfil !== "responsavel" ? [{ id: user.id, nome: "Eu" }] : []),
    ...dependentes.map((d) => ({ id: d.id, nome: d.nome_completo.split(" ")[0] })),
  ];
  let gamificacao: ResumoGamificacao[] = [];
  let conquistasPorVer: ConquistaPorVer[] = [];
  try {
    const ids = pessoasGamificacao.map((x) => x.id);
    const [estado, { data: conquistas }] = await Promise.all([
      carregarEstadoGamificacao(createAdminClient(), pessoasGamificacao),
      supabase.from("conquistas").select("id, aluno_id, codigo, vista_em").in("aluno_id", ids),
    ]);
    gamificacao = pessoasGamificacao.map((x) => ({
      id: x.id,
      nome: x.nome,
      sequencia: estado[x.id]?.sequencia.atual ?? 0,
      semanaAulas: estado[x.id]?.sequencia.semanaAtual.aulas ?? 0,
      medalhas: (conquistas ?? []).filter((c) => c.aluno_id === x.id).length,
    }));
    conquistasPorVer = (conquistas ?? [])
      .filter((c) => !c.vista_em)
      .map((c) => ({
        id: c.id as string,
        codigo: c.codigo as string,
        dependente: c.aluno_id === user.id ? undefined : pessoasGamificacao.find((x) => x.id === c.aluno_id)?.nome,
      }));
  } catch (e) {
    console.error("[perfil] gamificação", e);
  }

  // Próxima aula reservada (do próprio ou de um dependente). Ids só do próprio e dos
  // seus dependentes; uma falha mostra o estado de erro em vez de partir a página.
  let proximaAula: ProximaAulaHome = { estado: "vazio" };
  try {
    const nomes = new Map<string, string>([
      [user.id, (p?.nome_completo ?? "").split(" ")[0]],
      ...dependentes.map((d) => [d.id, d.nome_completo.split(" ")[0]] as [string, string]),
    ]);
    const admin = createAdminClient();
    const diaHoje = hojeLisboa();
    const { data: reservas, error } = await admin
      .from("reservas")
      .select("aluno_id, aula:aulas!inner(id, data, horario, status, turma:turmas(nome, modalidade_id))")
      .in("aluno_id", [...nomes.keys()])
      .eq("status", "confirmada")
      .gte("aula.data", diaHoje);
    if (error) throw error;

    const prox = escolherProximaReserva((reservas ?? []) as unknown as LinhaReserva[], diaHoje, horaLisboa());
    if (prox) {
      const rotulos = prox.modalidadeId ? await rotulosModalidades(admin) : null;
      const soProprio = prox.alunoIds.length === 1 && prox.alunoIds[0] === user.id;
      proximaAula = {
        estado: "ok",
        modalidade: (prox.modalidadeId && rotulos?.get(prox.modalidadeId)) || null,
        turma: prox.turma,
        quando: formatarQuando(prox.data, prox.horario, diaHoje),
        // Ordem: o próprio primeiro, depois os dependentes pela ordem da lista
        para: soProprio ? [] : [...nomes.keys()].filter((id) => prox.alunoIds.includes(id)).map((id) => nomes.get(id)!),
        outras: prox.outras,
      };
    }
  } catch (e) {
    console.error("[perfil] próxima aula", e);
    proximaAula = { estado: "erro" };
  }

  // Não empilhar com o aviso de graduação nem com o de mensalidade em atraso (≥2 dias)
  const hoje = new Date();
  const atrasoMensalidade = Math.max(
    getMaiorAtraso((mensalidades ?? []) as Mensalidade[], hoje),
    ...dependentes.flatMap((d) => d.mensalidades.map((m) => getDiasAtraso(m, hoje))),
  );
  const mostrarNovaConquista =
    conquistasPorVer.length > 0 && !mostrarAvisoGraduacao && atrasoMensalidade < 2;

  // Aviso compacto na home só enquanto o banner do layout ainda não aparece
  let avisoMensalidade: string | null = null;
  if (atrasoMensalidade > 0 && atrasoMensalidade < DIAS_BANNER_MENSALIDADE) {
    const donos: { nome: string | null; ms: Mensalidade[] }[] = [
      { nome: null, ms: (mensalidades ?? []) as Mensalidade[] },
      ...dependentes.map((d) => ({ nome: d.nome_completo.split(" ")[0], ms: d.mensalidades })),
    ];
    for (const dono of donos) {
      const m = dono.ms.find((x) => getDiasAtraso(x, hoje) > 0);
      if (!m) continue;
      const mes = formatarMes(Number(m.mes_referencia.slice(0, 4)), Number(m.mes_referencia.slice(5, 7)));
      avisoMensalidade = dono.nome
        ? `Mensalidade de ${mes} de ${dono.nome} em atraso`
        : `Mensalidade de ${mes} em atraso`;
      break;
    }
  }

  return (
    <>
      {mostrarAvisoGraduacao && <GraduacaoAptosModal janela={janelaAviso} />}
      {mostrarNovaConquista && <NovaConquistaModal conquistas={conquistasPorVer} />}
      <PerfilView
        profile={p}
        mensalidades={(mensalidades ?? []) as Mensalidade[]}
        historicoGraduacoes={(graduacoes ?? []) as HistoricoGraduacao[]}
        totalAulas={totalAulas}
        aulasMes={aulasMes}
        ultimoTreino={ultimoTreino}
        avisosNotif={avisosNotif}
        dependentes={dependentes}
        aptosGraduar={aptosGraduar}
        gamificacao={gamificacao}
        proximaAula={proximaAula}
        kpisAdmin={kpisAdmin}
        avisoMensalidade={avisoMensalidade}
      />
    </>
  );
}
