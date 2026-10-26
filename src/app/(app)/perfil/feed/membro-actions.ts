"use server";

import { after } from "next/server";
import { requireMembro } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushComentario } from "@/lib/push-sender";
import {
  nomeCurto,
  podeApagarComentario,
  validarComentario,
  type AutorFeed,
  type ComentarioFeed,
  type PaginaFeed,
  type Sessao,
} from "@/lib/feed";
import type { ActionResult } from "@/lib/types";
import { carregarPaginaFeed, ehUuid } from "./dados";

// Acções do feed para qualquer membro (gostos e comentários). O estado vive no cliente, por
// isso nenhuma chama revalidatePath. Todas começam por requireMembro() e escrevem com o
// admin client: as tabelas do feed não têm policies (só service_role).

type Falha = { ok: false; erro: string };

const POST_INEXISTENTE: Falha = { ok: false, erro: "Esta publicação já não existe." };
const COMENTARIO_INEXISTENTE: Falha = { ok: false, erro: "Comentário não encontrado." };
// Código do Postgres para violação de chave estrangeira (o post foi apagado entretanto)
const FK_VIOLADA = "23503";

type Admin = ReturnType<typeof createAdminClient>;

// null = o post existe; senão, a falha a devolver
async function verificarPost(admin: Admin, postId: string): Promise<Falha | null> {
  if (!ehUuid(postId)) return POST_INEXISTENTE;
  const { data, error } = await admin.from("feed_posts").select("id").eq("id", postId).maybeSingle();
  if (error) return { ok: false, erro: error.message };
  return data ? null : POST_INEXISTENTE;
}

// Embed to-one do PostgREST: objecto, ou null se o perfil não existir
interface PerfilEmbebido {
  nome_completo: string;
  foto_url: string | null;
}

function autorDe(id: string, perfil: PerfilEmbebido | PerfilEmbebido[] | null): AutorFeed {
  const p = Array.isArray(perfil) ? (perfil[0] ?? null) : perfil;
  return { id, nome: p ? nomeCurto(p.nome_completo) : "Membro", foto: p?.foto_url ?? null };
}

export async function carregarMaisPosts(
  cursor: string,
): Promise<{ ok: true; pagina: PaginaFeed } | Falha> {
  const guard = await requireMembro();
  if (!guard.ok) return guard;

  // Cursor que não é texto, ou estragado/desactualizado (carregarPaginaFeed valida a forma):
  // página vazia, sem erro — o cliente simplesmente deixa de pedir mais
  if (typeof cursor !== "string") return { ok: true, pagina: { posts: [], cursor: null } };

  try {
    const pagina = await carregarPaginaFeed(createAdminClient(), guard.userId, cursor);
    return { ok: true, pagina };
  } catch (e) {
    console.error("[feed] carregarMaisPosts", e);
    return { ok: false, erro: "Não foi possível carregar mais publicações." };
  }
}

export async function alternarCurtida(
  postId: string,
): Promise<{ ok: true; curtiu: boolean; total: number } | Falha> {
  const guard = await requireMembro();
  if (!guard.ok) return guard;
  const admin = createAdminClient();

  const semPost = await verificarPost(admin, postId);
  if (semPost) return semPost;

  const { data: existente, error: erroLeitura } = await admin
    .from("feed_curtidas")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", guard.userId)
    .maybeSingle();
  if (erroLeitura) return { ok: false, erro: erroLeitura.message };

  const curtiu = !existente;
  if (existente) {
    const { error } = await admin
      .from("feed_curtidas")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", guard.userId);
    if (error) return { ok: false, erro: error.message };
  } else {
    // ignoreDuplicates: dois toques seguidos não dão erro de chave duplicada
    const { error } = await admin
      .from("feed_curtidas")
      .upsert({ post_id: postId, user_id: guard.userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
    if (error) return error.code === FK_VIOLADA ? POST_INEXISTENTE : { ok: false, erro: error.message };
  }

  // Total contado depois da escrita — nunca calculado no cliente. head: não traz linhas, por
  // isso não esbarra no limite de 1000 linhas do PostgREST.
  const { count, error: erroTotal } = await admin
    .from("feed_curtidas")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (erroTotal) return { ok: false, erro: erroTotal.message };
  return { ok: true, curtiu, total: count ?? 0 };
}

export async function listarCurtidas(
  postId: string,
): Promise<{ ok: true; pessoas: AutorFeed[] } | Falha> {
  const guard = await requireMembro();
  if (!guard.ok) return guard;
  const admin = createAdminClient();

  const semPost = await verificarPost(admin, postId);
  if (semPost) return semPost;

  // O nome e a foto vêm no mesmo pedido (FK user_id → profiles), sem lista de ids no URL
  const { data, error } = await admin
    .from("feed_curtidas")
    .select("user_id, profiles(nome_completo, foto_url)")
    .eq("post_id", postId)
    .order("criado_em", { ascending: true });
  if (error) return { ok: false, erro: error.message };

  const linhas = (data ?? []) as unknown as { user_id: string; profiles: PerfilEmbebido | PerfilEmbebido[] | null }[];
  return { ok: true, pessoas: linhas.map((l) => autorDe(l.user_id, l.profiles)) };
}

export async function listarComentarios(
  postId: string,
): Promise<{ ok: true; comentarios: ComentarioFeed[] } | Falha> {
  const guard = await requireMembro();
  if (!guard.ok) return guard;
  const admin = createAdminClient();

  const semPost = await verificarPost(admin, postId);
  if (semPost) return semPost;

  const { data, error } = await admin
    .from("feed_comentarios")
    .select("id, texto, criado_em, autor_id, profiles(nome_completo, foto_url)")
    .eq("post_id", postId)
    .order("criado_em", { ascending: true });
  if (error) return { ok: false, erro: error.message };

  const sessao: Sessao = { userId: guard.userId, perfil: guard.perfil };
  const linhas = (data ?? []) as unknown as {
    id: string;
    texto: string;
    criado_em: string;
    autor_id: string;
    profiles: PerfilEmbebido | PerfilEmbebido[] | null;
  }[];
  return {
    ok: true,
    comentarios: linhas.map((l) => ({
      id: l.id,
      texto: l.texto,
      criadoEm: l.criado_em,
      autor: autorDe(l.autor_id, l.profiles),
      podeApagar: podeApagarComentario(sessao, l.autor_id),
    })),
  };
}

export async function comentar(
  postId: string,
  texto: string,
): Promise<{ ok: true; comentario: ComentarioFeed } | Falha> {
  const guard = await requireMembro();
  if (!guard.ok) return guard;

  // O argumento vem do cliente: se não for texto, lê-se como vazio
  const validacao = validarComentario(typeof texto === "string" ? texto : "");
  if (!validacao.ok) return validacao;

  const admin = createAdminClient();
  const semPost = await verificarPost(admin, postId);
  if (semPost) return semPost;

  const [inserido, perfil] = await Promise.all([
    admin
      .from("feed_comentarios")
      .insert({ post_id: postId, autor_id: guard.userId, texto: validacao.texto })
      .select("id, texto, criado_em")
      .single(),
    admin.from("profiles").select("nome_completo, foto_url").eq("id", guard.userId).maybeSingle(),
  ]);
  if (inserido.error) {
    return inserido.error.code === FK_VIOLADA ? POST_INEXISTENTE : { ok: false, erro: inserido.error.message };
  }

  // Avisa o autor do post depois da resposta, sem atrasar quem comenta
  after(() =>
    sendPushComentario(postId, guard.userId, validacao.texto).catch((e) =>
      console.error("[feed] sendPushComentario", e),
    ),
  );

  const novo = inserido.data as { id: string; texto: string; criado_em: string };
  return {
    ok: true,
    comentario: {
      id: novo.id,
      texto: novo.texto,
      criadoEm: novo.criado_em,
      autor: autorDe(guard.userId, (perfil.data as PerfilEmbebido | null) ?? null),
      podeApagar: true,
    },
  };
}

export async function apagarComentario(comentarioId: string): Promise<ActionResult> {
  const guard = await requireMembro();
  if (!guard.ok) return guard;
  if (!ehUuid(comentarioId)) return COMENTARIO_INEXISTENTE;
  const admin = createAdminClient();

  const { data: comentario, error } = await admin
    .from("feed_comentarios")
    .select("autor_id")
    .eq("id", comentarioId)
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  if (!comentario) return COMENTARIO_INEXISTENTE;

  const sessao: Sessao = { userId: guard.userId, perfil: guard.perfil };
  if (!podeApagarComentario(sessao, comentario.autor_id as string)) {
    return { ok: false, erro: "Sem permissão." };
  }

  const { error: erroApagar } = await admin.from("feed_comentarios").delete().eq("id", comentarioId);
  if (erroApagar) return { ok: false, erro: erroApagar.message };
  return { ok: true };
}
