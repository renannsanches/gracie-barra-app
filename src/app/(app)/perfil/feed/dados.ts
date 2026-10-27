// Leitura do feed (server-only). Módulo simples, SEM "use server": recebe o admin client por
// parâmetro, por isso não pode ser exposto como server action. Só é importado por Server
// Components e por server actions.
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  AUTOR_ACADEMIA,
  POSTS_POR_PAGINA,
  codificarCursor,
  descodificarCursor,
  nomeCurto,
  type AutorFeed,
  type PaginaFeed,
  type PostFeed,
  type TipoPost,
} from "@/lib/feed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Os ids chegam do cliente (server actions): nada que não seja UUID chega a uma query
export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

interface LinhaPost {
  id: string;
  autor_id: string | null;
  tipo: string;
  texto: string;
  fotos: string[] | null;
  criado_em: string;
  editado_em: string | null;
}

interface LinhaPerfil {
  id: string;
  nome_completo: string;
  foto_url: string | null;
}

const PAGINA_VAZIA: PaginaFeed = { posts: [], cursor: null };

// `count: "exact", head: true` não devolve linhas — por isso não esbarra no limite de 1000
// linhas por resposta do PostgREST, ao contrário de ir buscar todas as linhas para as contar.
async function contar(
  admin: ReturnType<typeof createAdminClient>,
  tabela: "feed_curtidas" | "feed_comentarios",
  postId: string,
): Promise<number> {
  const { count, error } = await admin
    .from(tabela)
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (error) throw new Error(`feed: contagem em ${tabela} falhou — ${error.message}`);
  return count ?? 0;
}

export async function carregarPaginaFeed(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  cursor: string | null,
): Promise<PaginaFeed> {
  let consulta = admin
    .from("feed_posts")
    .select("id, autor_id, tipo, texto, fotos, criado_em, editado_em")
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(POSTS_POR_PAGINA + 1);

  if (cursor !== null) {
    // O cursor vem do cliente e vai parar a um filtro `.or()`: um cursor estragado ou
    // desactualizado dá uma página vazia (sem erro), nunca um filtro partido.
    const c = descodificarCursor(cursor);
    if (!c || !ehUuid(c.id)) return PAGINA_VAZIA;
    consulta = consulta.or(`criado_em.lt.${c.criadoEm},and(criado_em.eq.${c.criadoEm},id.lt.${c.id})`);
  }

  const { data, error } = await consulta;
  if (error) throw new Error(`feed: leitura dos posts falhou — ${error.message}`);

  const linhas = (data ?? []) as LinhaPost[];
  const temMais = linhas.length > POSTS_POR_PAGINA;
  const mostrados = temMais ? linhas.slice(0, POSTS_POR_PAGINA) : linhas;
  if (mostrados.length === 0) return PAGINA_VAZIA;

  const ids = mostrados.map((p) => p.id);
  const autorIds = [...new Set(mostrados.map((p) => p.autor_id).filter((id): id is string => id !== null))];

  const [perfis, curtidas, comentarios, minhas] = await Promise.all([
    autorIds.length > 0
      ? admin.from("profiles").select("id, nome_completo, foto_url").in("id", autorIds)
      : Promise.resolve({ data: [] as LinhaPerfil[], error: null }),
    Promise.all(ids.map((id) => contar(admin, "feed_curtidas", id))),
    Promise.all(ids.map((id) => contar(admin, "feed_comentarios", id))),
    admin.from("feed_curtidas").select("post_id").eq("user_id", userId).in("post_id", ids),
  ]);
  if (perfis.error) throw new Error(`feed: leitura dos autores falhou — ${perfis.error.message}`);
  if (minhas.error) throw new Error(`feed: leitura dos gostos falhou — ${minhas.error.message}`);

  const autores = new Map<string, AutorFeed>(
    ((perfis.data ?? []) as LinhaPerfil[]).map((p) => [
      p.id,
      { id: p.id, nome: nomeCurto(p.nome_completo), foto: p.foto_url },
    ]),
  );
  const curtidosPorMim = new Set(((minhas.data ?? []) as { post_id: string }[]).map((l) => l.post_id));

  const posts: PostFeed[] = mostrados.map((p, i) => ({
    id: p.id,
    tipo: p.tipo as TipoPost,
    texto: p.texto,
    fotos: p.fotos ?? [],
    criadoEm: p.criado_em,
    editadoEm: p.editado_em,
    // Sem autor = post automático da academia (a FK é ON DELETE SET NULL, por isso um autor
    // que não aparece em profiles também cai aqui)
    autor: (p.autor_id && autores.get(p.autor_id)) || AUTOR_ACADEMIA,
    curtidas: curtidas[i],
    curtiEu: curtidosPorMim.has(p.id),
    comentarios: comentarios[i],
    dados: null, // provisório — a Task 2 lê a coluna `dados`
  }));

  const ultimo = mostrados[mostrados.length - 1];
  return { posts, cursor: temMais ? codificarCursor(ultimo.criado_em, ultimo.id) : null };
}
