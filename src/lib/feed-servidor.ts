// Lado servidor dos posts do feed que não são acções públicas: recebem o admin client e por isso
// NÃO podem ter "use server" (virariam endpoints). Quem chama (server actions, cron) já autorizou.
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  BUCKET_FEED,
  ERRO_POST_INEXISTENTE,
  caminhoNoBucket,
  type DadosGraduacao,
  type DadosPodio,
} from "@/lib/feed";
import {
  dentroJanelaPodio,
  deveCriarPostGraduacao,
  mesDoPodio,
  montarPodio,
  textoGraduacao,
  textoPodio,
} from "@/lib/feed-automatico";
import { grupoRanking, hojeLisboa, limitesPeriodo, nomeRanking } from "@/lib/gamificacao";
import type { CategoriaFaixa, CorFaixa } from "@/lib/types";

export type Admin = ReturnType<typeof createAdminClient>;

// Remove ficheiros do bucket sem nunca lançar: uma falha aqui só deixa lixo, não pode estragar
// o resultado da acção
export async function removerDoBucket(admin: Admin, caminhos: string[]): Promise<void> {
  if (caminhos.length === 0) return;
  try {
    const { error } = await admin.storage.from(BUCKET_FEED).remove(caminhos);
    if (error) console.error("[feed] remover do bucket", error.message, caminhos);
  } catch (e) {
    console.error("[feed] remover do bucket", e, caminhos);
  }
}

// Caminhos no bucket de URLs guardados pelo servidor numa linha de post. Só entram os que
// estão na pasta deste post: qualquer outro caminho que apareça na linha fica intocado.
export function caminhosDeUrls(postId: string, urls: string[]): string[] {
  return urls
    .map((u) => caminhoNoBucket(u))
    .filter((c): c is string => c !== null && c.startsWith(`${postId}/`));
}

// Apaga a linha do post (a cascata leva gostos e comentários) e depois as fotos dele no bucket.
// A linha sai primeiro: se o storage falhar, fica só lixo.
export async function apagarPostEFotos(
  admin: Admin,
  postId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { data: post, error: erroLeitura } = await admin
    .from("feed_posts")
    .select("fotos")
    .eq("id", postId)
    .maybeSingle();
  if (erroLeitura) return { ok: false, erro: erroLeitura.message };
  if (!post) return { ok: false, erro: ERRO_POST_INEXISTENTE };

  const { error } = await admin.from("feed_posts").delete().eq("id", postId);
  if (error) return { ok: false, erro: error.message };

  await removerDoBucket(
    admin,
    caminhosDeUrls(postId, ((post.fotos as string[] | null) ?? []).filter((u) => typeof u === "string")),
  );
  return { ok: true };
}

// Post automático "faixa nova". Nunca lança: o registo da graduação não pode falhar por causa do feed.
export async function publicarPostGraduacao(
  admin: Admin,
  g: {
    graduacaoId: string;
    alunoId: string;
    faixaAnterior: CorFaixa | null;
    faixaNova: CorFaixa;
    graus: number;
    categoria: CategoriaFaixa;
    dataGraduacao: string;
  },
): Promise<void> {
  try {
    const { data: aluno, error: erroAluno } = await admin
      .from("profiles")
      .select("nome_completo, ocultar_ranking")
      .eq("id", g.alunoId)
      .maybeSingle();
    if (erroAluno) {
      console.error("[feed] post de graduação:", erroAluno.message);
      return;
    }
    if (!aluno) return;

    const deve = deveCriarPostGraduacao({
      faixaAnterior: g.faixaAnterior,
      faixaNova: g.faixaNova,
      dataGraduacao: g.dataGraduacao,
      ocultarRanking: aluno.ocultar_ranking === true,
      hoje: hojeLisboa(),
    });
    if (!deve) return;

    // Sem nome não há post: sairia "recebeu a faixa…" sem ninguém
    if (!((aluno.nome_completo as string | null) ?? "").trim()) {
      console.error("[feed] post de graduação: aluno sem nome", g.alunoId);
      return;
    }
    const nome = nomeRanking(
      (aluno.nome_completo as string | null) ?? "",
      grupoRanking(g.faixaNova, g.categoria),
    );
    const dados: DadosGraduacao = {
      kind: "graduacao",
      alunoId: g.alunoId,
      nome,
      faixa: g.faixaNova,
      graus: g.graus,
      categoria: g.categoria,
    };

    const { error } = await admin.from("feed_posts").insert({
      tipo: "graduacao",
      autor_id: null,
      referencia: g.graduacaoId,
      texto: textoGraduacao(nome, g.faixaNova),
      dados,
    });
    // 23505 = já existe post para esta graduação: nada a fazer
    if (error && error.code !== "23505") console.error("[feed] post de graduação:", error.message);
  } catch (e) {
    console.error("[feed] post de graduação:", e);
  }
}

// Apaga o post (e as fotos) da graduação que foi excluída. Nunca lança.
export async function apagarPostGraduacao(admin: Admin, graduacaoId: string): Promise<void> {
  try {
    const { data: post, error } = await admin
      .from("feed_posts")
      .select("id")
      .eq("tipo", "graduacao")
      .eq("referencia", graduacaoId)
      .maybeSingle();
    if (error) {
      console.error("[feed] apagar post de graduação:", error.message);
      return;
    }
    if (!post) return;
    const r = await apagarPostEFotos(admin, post.id as string);
    if (!r.ok) console.error("[feed] apagar post de graduação:", r.erro);
  } catch (e) {
    console.error("[feed] apagar post de graduação:", e);
  }
}

interface LinhaRankingRpc {
  aluno_id: string;
  nome_completo: string;
  foto_url: string | null;
  faixa: string | null;
  graus: number;
  categoria: string | null;
  aulas: number;
}

// Pódio do mês anterior (a publicar nos dias 1 a 3 do mês, para tolerar falhas do cron). Idempotente:
// um post por mês; fora dessa janela não publica (um post apagado não ressuscita). Com `dry` só
// calcula, nunca escreve, e ignora a janela (pré-visualização). Lança se o RPC falhar, para o cron
// registar o erro em vez de saltar um mês em silêncio.
export async function gerarPostPodio(
  admin: Admin,
  opts: { dry: boolean; hoje?: string },
): Promise<{ mes: string | null; publicado: boolean; jaExistia: boolean; podio: DadosPodio | null }> {
  const hoje = opts.hoje ?? hojeLisboa();
  const mes = mesDoPodio(hoje);
  if (!mes) return { mes: null, publicado: false, jaExistia: false, podio: null };
  if (!opts.dry && !dentroJanelaPodio(hoje)) return { mes, publicado: false, jaExistia: false, podio: null };

  const { data: existente, error: erroExistente } = await admin
    .from("feed_posts")
    .select("id")
    .eq("tipo", "podio")
    .eq("referencia", mes)
    .maybeSingle();
  if (erroExistente) throw new Error(`[feed] pódio: ${erroExistente.message}`);
  if (existente) return { mes, publicado: false, jaExistia: true, podio: null };

  const { inicio, fim } = limitesPeriodo("mes", `${mes}-01`);
  const { data: linhas, error: erroRpc } = await admin.rpc("ranking_presencas", {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (erroRpc) throw new Error(`[feed] pódio: ranking_presencas: ${erroRpc.message}`);

  const podio = montarPodio(
    ((linhas ?? []) as LinhaRankingRpc[])
      .filter((r) => (r.nome_completo ?? "").trim() !== "") // sem nome não há pódio
      .map((r) => ({
        alunoId: r.aluno_id,
        nomeCompleto: r.nome_completo,
        foto: r.foto_url,
        faixa: r.faixa,
        graus: r.graus,
        categoria: r.categoria,
        aulas: r.aulas,
      })),
    mes,
  );
  if (opts.dry || !podio) return { mes, publicado: false, jaExistia: false, podio };

  const { error } = await admin.from("feed_posts").insert({
    tipo: "podio",
    autor_id: null,
    referencia: mes,
    texto: textoPodio(podio),
    dados: podio,
  });
  // 23505 = outro pedido publicou entretanto: quem não inseriu não manda push
  if (error?.code === "23505") return { mes, publicado: false, jaExistia: true, podio };
  if (error) throw new Error(`[feed] pódio: ${error.message}`);
  return { mes, publicado: true, jaExistia: false, podio };
}
