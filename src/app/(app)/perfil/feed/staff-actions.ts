"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireMembro } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushNovoPost } from "@/lib/push-sender";
import {
  BUCKET_FEED,
  ERRO_POST_INEXISTENTE,
  caminhoNoBucket,
  eStaff,
  podeApagarPost,
  podeEditarPost,
  validarPost,
  type Sessao,
} from "@/lib/feed";
import type { ActionResult } from "@/lib/types";
import { ehUuid } from "./dados";

// Acções de staff do feed (publicar, editar, apagar). Exportam-se só as 3 acções: tudo o resto
// é privado ao módulo. As fotos vão para o bucket público "feed" com nomes não adivinháveis.
//
// Regra de ouro do storage: só se apaga do bucket o que o SERVIDOR guardou na linha do post
// (nunca URLs vindos do cliente) e, nas escritas, tudo-ou-nada — se algo falha, remove-se o que
// este pedido já tinha enviado.

type Falha = { ok: false; erro: string };

const SEM_PERMISSAO: Falha = { ok: false, erro: "Sem permissão." };
const POST_INEXISTENTE: Falha = { ok: false, erro: ERRO_POST_INEXISTENTE };
const PEDIDO_INVALIDO: Falha = { ok: false, erro: "Pedido inválido." };
const FOTO_INVALIDA: Falha = { ok: false, erro: "Foto inválida ou demasiado grande." };
const FALHA_UPLOAD: Falha = { ok: false, erro: "Não foi possível enviar as fotos. Tenta outra vez." };

const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;
// WebP por defeito; JPEG quando o browser não gera WebP (Safari/iPhone). Extensão no bucket por tipo.
const EXTENSAO_POR_TIPO: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg" };

type Admin = ReturnType<typeof createAdminClient>;

// Remove ficheiros do bucket sem nunca lançar: uma falha aqui só deixa lixo, não pode estragar
// o resultado da acção
async function removerDoBucket(admin: Admin, caminhos: string[]): Promise<void> {
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
function caminhosDeUrls(postId: string, urls: string[]): string[] {
  return urls
    .map((u) => caminhoNoBucket(u))
    .filter((c): c is string => c !== null && c.startsWith(`${postId}/`));
}

function lerTexto(formData: FormData): string {
  const texto = formData.get("texto");
  return typeof texto === "string" ? texto : "";
}

// null = há algum ficheiro que não é uma imagem WebP/JPEG dentro do limite
function lerFotosNovas(formData: FormData): File[] | null {
  const valores = formData.getAll("fotos");
  const ficheiros: File[] = [];
  for (const v of valores) {
    if (!(v instanceof File)) return null;
    if (!Object.hasOwn(EXTENSAO_POR_TIPO, v.type) || v.size === 0 || v.size > TAMANHO_MAXIMO_FOTO) return null;
    ficheiros.push(v);
  }
  return ficheiros;
}

// Envia as fotos uma a uma. Se uma falhar, remove as que este pedido já enviou e devolve a falha.
// `caminhos` serve a quem chama para limpar se um passo seguinte (insert/update) falhar.
async function enviarFotos(
  admin: Admin,
  postId: string,
  ficheiros: File[],
  inicio: number,
): Promise<{ ok: true; urls: string[]; caminhos: string[] } | Falha> {
  const urls: string[] = [];
  const caminhos: string[] = [];
  for (let i = 0; i < ficheiros.length; i++) {
    const tipo = ficheiros[i].type;
    const caminho = `${postId}/${inicio + i}-${crypto.randomUUID()}.${EXTENSAO_POR_TIPO[tipo]}`;
    try {
      const { error } = await admin.storage
        .from(BUCKET_FEED)
        .upload(caminho, ficheiros[i], { contentType: tipo });
      if (error) {
        console.error("[feed] upload de foto", error.message);
        // Pode ter ficado gravado mesmo com erro (ex.: resposta perdida): tenta-se remover
        await removerDoBucket(admin, [...caminhos, caminho]);
        return FALHA_UPLOAD;
      }
      caminhos.push(caminho);
      urls.push(admin.storage.from(BUCKET_FEED).getPublicUrl(caminho).data.publicUrl);
    } catch (e) {
      console.error("[feed] upload de foto (excepção)", e);
      await removerDoBucket(admin, [...caminhos, caminho]);
      return FALHA_UPLOAD;
    }
  }
  return { ok: true, urls, caminhos };
}

export async function criarPost(formData: FormData): Promise<ActionResult> {
  const guard = await requireMembro();
  if (!guard.ok) return guard;
  if (!eStaff(guard.perfil)) return SEM_PERMISSAO;

  const ficheiros = lerFotosNovas(formData);
  if (!ficheiros) return FOTO_INVALIDA;

  const validacao = validarPost(lerTexto(formData), ficheiros.length);
  if (!validacao.ok) return validacao;

  const admin = createAdminClient();
  const postId = crypto.randomUUID();

  const envio = await enviarFotos(admin, postId, ficheiros, 0);
  if (!envio.ok) return envio;

  try {
    const { error } = await admin.from("feed_posts").insert({
      id: postId,
      autor_id: guard.userId,
      tipo: "manual",
      texto: validacao.texto,
      fotos: envio.urls,
    });
    if (error) {
      console.error("[feed] criarPost insert", error.message);
      await removerDoBucket(admin, envio.caminhos);
      return { ok: false, erro: error.message };
    }
  } catch (e) {
    console.error("[feed] criarPost insert (excepção)", e);
    await removerDoBucket(admin, envio.caminhos);
    return FALHA_UPLOAD;
  }

  revalidatePath("/perfil");
  after(() =>
    sendPushNovoPost(guard.userId, validacao.texto).catch((e) => console.error("[feed] sendPushNovoPost", e)),
  );
  return { ok: true };
}

// O que o card precisa para se actualizar sem recarregar a lista
export type PostEditado = { texto: string; fotos: string[]; editadoEm: string };

export async function editarPost(
  postId: string,
  formData: FormData,
): Promise<{ ok: true; post: PostEditado } | Falha> {
  const guard = await requireMembro();
  if (!guard.ok) return guard;
  if (!ehUuid(postId)) return POST_INEXISTENTE;
  const sessao: Sessao = { userId: guard.userId, perfil: guard.perfil };
  if (!eStaff(sessao.perfil)) return SEM_PERMISSAO;

  const admin = createAdminClient();
  const { data: post, error: erroLeitura } = await admin
    .from("feed_posts")
    .select("autor_id, fotos")
    .eq("id", postId)
    .maybeSingle();
  if (erroLeitura) return { ok: false, erro: erroLeitura.message };
  if (!post) return POST_INEXISTENTE;
  if (!podeEditarPost(sessao, (post.autor_id as string | null) ?? null)) return SEM_PERMISSAO;

  // `manter` vem do cliente: só conta o que já está na linha do post (e sem repetidos)
  const fotosActuais = ((post.fotos as string[] | null) ?? []).filter((u) => typeof u === "string");
  const bruto = formData.get("manter");
  // Campo em falta não é "manter nada": apagaria todas as fotos por engano
  if (typeof bruto !== "string") return PEDIDO_INVALIDO;
  let pedidas: unknown;
  try {
    pedidas = JSON.parse(bruto);
  } catch {
    return PEDIDO_INVALIDO;
  }
  if (!Array.isArray(pedidas) || !pedidas.every((u) => typeof u === "string")) return PEDIDO_INVALIDO;
  const actuais = new Set(fotosActuais);
  const manter = [...new Set(pedidas as string[])].filter((u) => actuais.has(u));

  const novas = lerFotosNovas(formData);
  if (!novas) return FOTO_INVALIDA;

  const validacao = validarPost(lerTexto(formData), manter.length + novas.length);
  if (!validacao.ok) return validacao;

  const envio = await enviarFotos(admin, postId, novas, manter.length);
  if (!envio.ok) return envio;

  const editado: PostEditado = {
    texto: validacao.texto,
    fotos: [...manter, ...envio.urls],
    editadoEm: new Date().toISOString(),
  };

  try {
    const { data: actualizado, error } = await admin
      .from("feed_posts")
      .update({
        texto: editado.texto,
        fotos: editado.fotos,
        editado_em: editado.editadoEm,
      })
      .eq("id", postId)
      .select("id");
    if (error || !actualizado || actualizado.length === 0) {
      if (error) console.error("[feed] editarPost update", error.message);
      await removerDoBucket(admin, envio.caminhos);
      return error ? { ok: false, erro: error.message } : POST_INEXISTENTE;
    }
  } catch (e) {
    console.error("[feed] editarPost update (excepção)", e);
    await removerDoBucket(admin, envio.caminhos);
    return FALHA_UPLOAD;
  }

  // Só agora, com a linha já gravada, saem do bucket as fotos que o post deixou de ter
  const mantidas = new Set(manter);
  await removerDoBucket(admin, caminhosDeUrls(postId, fotosActuais.filter((u) => !mantidas.has(u))));

  revalidatePath("/perfil");
  return { ok: true, post: editado };
}

export async function apagarPost(postId: string): Promise<ActionResult> {
  const guard = await requireMembro();
  if (!guard.ok) return guard;
  if (!ehUuid(postId)) return POST_INEXISTENTE;
  if (!podeApagarPost({ userId: guard.userId, perfil: guard.perfil })) return SEM_PERMISSAO;

  const admin = createAdminClient();
  const { data: post, error: erroLeitura } = await admin
    .from("feed_posts")
    .select("fotos")
    .eq("id", postId)
    .maybeSingle();
  if (erroLeitura) return { ok: false, erro: erroLeitura.message };
  if (!post) return POST_INEXISTENTE;

  // A cascata leva gostos e comentários. A linha sai primeiro: se o storage falhar, fica só lixo.
  const { error } = await admin.from("feed_posts").delete().eq("id", postId);
  if (error) return { ok: false, erro: error.message };

  await removerDoBucket(admin, caminhosDeUrls(postId, ((post.fotos as string[] | null) ?? []).filter((u) => typeof u === "string")));

  revalidatePath("/perfil");
  return { ok: true };
}
