import { Suspense } from "react";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularAptosGraduar, type AptoGraduar } from "@/lib/aptos-graduar";
import { eStaff } from "@/lib/feed";
import { AptosGraduarCard } from "@/components/AptosGraduarCard";
import type { CategoriaFaixa, CorFaixa, Mensalidade, PerfilUsuario } from "@/lib/types";
import { GraduacaoAptosModal } from "@/components/GraduacaoAptosModal";
import { CHAVE_AVISO_GRADUACAO, janelaAvisoGraduacao } from "@/lib/aviso-graduacao";
import { NovaConquistaModal, type ConquistaPorVer } from "@/components/NovaConquistaModal";
import { CardListSkeleton } from "@/components/skeletons";
import { getDiasAtraso, getMaiorAtraso } from "@/lib/mensalidade-status";
import { separadorValido, type Separador } from "@/lib/inicio";
import { InicioView } from "./InicioView";
import { carregarPaginaFeed } from "./feed/dados";
import { FeedLista } from "./feed/FeedLista";
import { RankingView } from "../ranking/RankingView";
import { carregarRanking } from "../ranking/dados";
import { ConquistasView } from "../conquistas/ConquistasView";
import { carregarConquistas } from "../conquistas/dados";
import { AlbunsGrid } from "../galeria/AlbunsGrid";
import { carregarAlbuns } from "../galeria/dados";

interface PerfilRow {
  id: string;
  nome_completo: string;
  foto_url: string | null;
  faixa: CorFaixa | null;
  graus: number | null;
  categoria: CategoriaFaixa;
  perfil: PerfilUsuario;
}

type DependenteRow = { dependente: { id: string; nome_completo: string } | null };

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const separador = separadorValido((await searchParams).tab);

  // A casca só carrega o que o cabeçalho (sino) e os modais precisam; o conteúdo do
  // separador activo carrega à parte, dentro do Suspense.
  const [{ data: profile }, { data: mensalidades }, { data: avisosData }, { data: dependentesData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome_completo, foto_url, faixa, graus, categoria, perfil")
        .eq("id", user.id)
        .single(),
      supabase
        .from("mensalidades")
        .select("*")
        .eq("aluno_id", user.id)
        .order("mes_referencia", { ascending: false }),
      supabase
        .from("avisos")
        .select("id, titulo, created_at")
        .eq("publicado", true)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("dependentes")
        .select("dependente:profiles!dependentes_dependente_id_fkey(id, nome_completo)")
        .eq("responsavel_id", user.id),
    ]);

  const p = profile as PerfilRow | null;
  // Não redirecionar para /login: o middleware devolve um utilizador com sessão a /perfil (ciclo)
  if (!p) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-canvas">
        <div className="text-center space-y-3">
          <p className="text-fg-muted">Perfil não encontrado.</p>
          <Link href="/conta" className="text-sm font-semibold text-brand">
            Ir para Minha conta
          </Link>
        </div>
      </div>
    );
  }

  const avisosNotif = (avisosData ?? []).map((a) => ({
    id: a.id as string,
    titulo: a.titulo as string,
    created_at: a.created_at as string,
  }));

  const dependentes = ((dependentesData ?? []) as unknown as DependenteRow[])
    .map((d) => d.dependente)
    .filter((d): d is { id: string; nome_completo: string } => Boolean(d));

  const isAdminOrProfessor = p.perfil === "admin" || p.perfil === "professor";
  const janelaAviso = janelaAvisoGraduacao();
  // Só calcula os aptos quando o aviso desta janela ainda não foi visto (sem aptos não há aviso)
  const avisoPorVer = isAdminOrProfessor && user.user_metadata?.[CHAVE_AVISO_GRADUACAO] !== janelaAviso;

  const pessoasGamificacao = [
    ...(p.perfil !== "responsavel" ? [{ id: user.id, nome: "Eu" }] : []),
    ...dependentes.map((d) => ({ id: d.id, nome: d.nome_completo.split(" ")[0] })),
  ];
  const idsGamificacao = pessoasGamificacao.map((x) => x.id);

  const [{ data: depMensalidades }, aptosGraduar, { data: conquistas }] = await Promise.all([
    dependentes.length > 0
      ? supabase
          .from("mensalidades")
          .select("aluno_id, status, data_vencimento")
          .in("aluno_id", dependentes.map((d) => d.id))
      : Promise.resolve({ data: [] as Pick<Mensalidade, "aluno_id" | "status" | "data_vencimento">[] }),
    avisoPorVer ? calcularAptosGraduar(createAdminClient()) : Promise.resolve([]),
    idsGamificacao.length > 0
      ? supabase.from("conquistas").select("id, aluno_id, codigo").in("aluno_id", idsGamificacao).is("vista_em", null)
      : Promise.resolve({ data: [] as { id: string; aluno_id: string; codigo: string }[] }),
  ]);

  const mostrarAvisoGraduacao = avisoPorVer && aptosGraduar.length > 0;

  const conquistasPorVer: ConquistaPorVer[] = (conquistas ?? []).map((c) => ({
    id: c.id as string,
    codigo: c.codigo as string,
    dependente: c.aluno_id === user.id ? undefined : pessoasGamificacao.find((x) => x.id === c.aluno_id)?.nome,
  }));

  // Não empilhar com o aviso de graduação nem com o de mensalidade em atraso (≥2 dias)
  const hoje = new Date();
  const atrasoMensalidade = Math.max(
    getMaiorAtraso((mensalidades ?? []) as Mensalidade[], hoje),
    ...(depMensalidades ?? []).map((m) => getDiasAtraso(m, hoje)),
  );
  const mostrarNovaConquista =
    conquistasPorVer.length > 0 && !mostrarAvisoGraduacao && atrasoMensalidade < 2;

  return (
    <>
      {mostrarAvisoGraduacao && <GraduacaoAptosModal janela={janelaAviso} />}
      {mostrarNovaConquista && <NovaConquistaModal conquistas={conquistasPorVer} />}
      <InicioView
        pessoa={{
          id: p.id,
          nome: p.nome_completo,
          foto: p.foto_url,
          faixa: p.faixa,
          graus: p.graus ?? 0,
          categoria: p.categoria,
          perfil: p.perfil,
        }}
        separador={separador}
        mensalidades={(mensalidades ?? []) as Mensalidade[]}
        avisosNotif={avisosNotif}
      >
        {/* key: ao trocar de separador mostra logo o esqueleto em vez do conteúdo anterior */}
        <Suspense key={separador} fallback={<CardListSkeleton count={2} />}>
          <ConteudoSeparador separador={separador} userId={user.id} perfil={p.perfil} />
        </Suspense>
      </InicioView>
    </>
  );
}

// Só o separador activo carrega dados
async function ConteudoSeparador({
  separador,
  userId,
  perfil,
}: {
  separador: Separador;
  userId: string;
  perfil: PerfilUsuario;
}) {
  // O tablet (Safari 15) não vê o feed nem os outros separadores
  if (perfil === "tablet") {
    return <p className="py-8 text-center text-sm text-fg-muted">Conteúdo não disponível no tablet.</p>;
  }

  let dados: DadosSeparador;
  try {
    dados = await carregarSeparador(separador, userId, perfil);
  } catch (erro) {
    // redirect()/notFound() e afins seguem para o Next; o resto fica neste cartão,
    // para uma falha aqui não partir a página principal da app (cabeçalho, pílulas, barra inferior)
    unstable_rethrow(erro);
    console.error(`[inicio] falha a carregar o separador "${separador}":`, erro);
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm text-fg">Não foi possível carregar. Tenta outra vez.</p>
        <Link
          href={separador === "feed" ? "/perfil" : `/perfil?tab=${separador}`}
          scroll={false}
          className="mt-3 inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
        >
          Tentar outra vez
        </Link>
      </div>
    );
  }

  switch (dados.separador) {
    case "ranking":
      return <RankingView {...dados.ranking} embutido />;
    case "conquistas":
      return <ConquistasView pessoas={dados.pessoas} embutido />;
    case "galeria":
      return <AlbunsGrid albuns={dados.albuns} />;
    case "feed":
      // key: o router.refresh() depois de publicar remonta a lista com a página nova
      return (
        <div className="space-y-4">
          {dados.aptos && <AptosGraduarCard aptos={dados.aptos} />}
          <FeedLista key={dados.pagina.posts[0]?.id ?? "vazio"} paginaInicial={dados.pagina} sessao={{ userId, perfil }} />
        </div>
      );
  }
}

type DadosSeparador =
  | { separador: "ranking"; ranking: Awaited<ReturnType<typeof carregarRanking>> }
  | { separador: "conquistas"; pessoas: Awaited<ReturnType<typeof carregarConquistas>> }
  | { separador: "galeria"; albuns: Awaited<ReturnType<typeof carregarAlbuns>> }
  // aptos: só staff; null = não mostrar o card (aluno, ou o cálculo falhou)
  | { separador: "feed"; pagina: Awaited<ReturnType<typeof carregarPaginaFeed>>; aptos: AptoGraduar[] | null };

async function carregarSeparador(
  separador: Separador,
  userId: string,
  perfil: PerfilUsuario,
): Promise<DadosSeparador> {
  const supabase = await createClient();
  switch (separador) {
    case "ranking":
      return { separador, ranking: await carregarRanking(supabase, userId) };
    case "conquistas":
      return { separador, pessoas: await carregarConquistas(supabase, userId) };
    case "galeria":
      return { separador, albuns: await carregarAlbuns(supabase) };
    case "feed": {
      const admin = createAdminClient();
      // Uma falha nos aptos não parte o feed: fica só sem o card
      const [pagina, aptos] = await Promise.all([
        carregarPaginaFeed(admin, userId, null),
        eStaff(perfil)
          ? calcularAptosGraduar(admin).catch((erro: unknown) => {
              console.error("[inicio] falha a calcular os aptos a graduar:", erro);
              return null;
            })
          : Promise.resolve(null),
      ]);
      return { separador, pagina, aptos };
    }
  }
}
