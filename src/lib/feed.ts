// Feed da academia: regras puras (validação, tempo relativo, permissões, cursor).
// Sem Supabase nem React — é importado tanto por server actions como por componentes
// cliente, por isso só usa APIs que existem no browser e no Node (TextEncoder, btoa, Intl).
// Testado em feed.test.ts.
import type { CategoriaFaixa, CorFaixa, PerfilUsuario } from "./types";

// ── Limites ───────────────────────────────────────────────────────────────────
export const LIMITE_COMENTARIO = 300;
export const LIMITE_TEXTO_POST = 2000;
export const LIMITE_FOTOS = 10;
export const POSTS_POR_PAGINA = 10;
export const BUCKET_FEED = "feed";
// Total de bytes das fotos novas por envio (a Vercel limita o corpo do pedido a 4,5 MB)
export const LIMITE_ENVIO_BYTES = 4 * 1024 * 1024;

// Erro das acções quando o post foi apagado entretanto — o cliente compara com isto para tirar o card
export const ERRO_POST_INEXISTENTE = "Esta publicação já não existe.";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type TipoPost = "manual" | "graduacao" | "podio";

export interface AutorFeed {
  id: string | null;
  nome: string;
  foto: string | null;
}

// Autor dos posts automáticos (graduações, pódio)
export const AUTOR_ACADEMIA: AutorFeed = {
  id: null,
  nome: "Gracie Barra Famalicão",
  foto: "/logo.webp",
};

// Dados estruturados dos posts automáticos (coluna `dados` de feed_posts)
export interface DadosGraduacao {
  kind: "graduacao";
  alunoId: string;
  nome: string;
  faixa: CorFaixa;
  graus: number;
  categoria: CategoriaFaixa;
}

export interface EntradaPodio {
  alunoId: string;
  nome: string;
  foto: string | null;
  faixa: string | null;
  graus: number;
  categoria: string | null;
  aulas: number;
  posicao: number;
}

export interface DadosPodio {
  kind: "podio";
  mes: string; // "YYYY-MM"
  adultos: EntradaPodio[];
  kids: EntradaPodio[];
}

export interface PostFeed {
  id: string;
  tipo: TipoPost;
  texto: string;
  fotos: string[];
  criadoEm: string;
  editadoEm: string | null;
  autor: AutorFeed;
  curtidas: number;
  curtiEu: boolean;
  comentarios: number;
  dados: DadosGraduacao | DadosPodio | null;
}

// cursor null = não há mais páginas
export interface PaginaFeed {
  posts: PostFeed[];
  cursor: string | null;
}

export interface ComentarioFeed {
  id: string;
  texto: string;
  criadoEm: string;
  autor: AutorFeed;
  podeApagar: boolean;
}

export interface Sessao {
  userId: string;
  perfil: PerfilUsuario;
}

// ── Validação ─────────────────────────────────────────────────────────────────
// Conta code points (um emoji conta 1), não unidades UTF-16
export function contarCaracteres(texto: string): number {
  return [...texto].length;
}

// O Postgres rejeita o caracter NUL em colunas text — tira-se antes de validar
function limparTexto(texto: string): string {
  return texto.split("\u0000").join("").trim();
}

export function validarComentario(
  texto: string,
): { ok: true; texto: string } | { ok: false; erro: string } {
  const limpo = limparTexto(texto);
  if (!limpo) return { ok: false, erro: "Escreve um comentário." };
  if (contarCaracteres(limpo) > LIMITE_COMENTARIO) {
    return { ok: false, erro: `Máximo de ${LIMITE_COMENTARIO} caracteres.` };
  }
  return { ok: true, texto: limpo };
}

// nFotos = fotos que o post fica a ter (já com as novas). Texto vazio é válido com fotos.
export function validarPost(
  texto: string,
  nFotos: number,
): { ok: true; texto: string } | { ok: false; erro: string } {
  const limpo = limparTexto(texto);
  if (nFotos > LIMITE_FOTOS) {
    return { ok: false, erro: `Máximo de ${LIMITE_FOTOS} fotos por publicação.` };
  }
  if (!limpo && nFotos === 0) {
    return { ok: false, erro: "Escreve um texto ou junta uma foto." };
  }
  if (contarCaracteres(limpo) > LIMITE_TEXTO_POST) {
    return { ok: false, erro: `Máximo de ${LIMITE_TEXTO_POST} caracteres.` };
  }
  return { ok: true, texto: limpo };
}

// ── Tempo relativo ────────────────────────────────────────────────────────────
// Meses escritos à mão: o formato pt-PT do Intl varia entre motores
const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

// Criado uma vez: construir um Intl.DateTimeFormat é caro e isto corre por cada post da lista
const FORMATO_LISBOA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function diaLisboa(d: Date): { ano: number; mes: number; dia: number } {
  const partes = FORMATO_LISBOA.formatToParts(d);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return { ano: valor("year"), mes: valor("month"), dia: valor("day") };
}

export function tempoRelativo(iso: string, agora: Date): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";

  // Relógio desfasado (data no futuro) também cai aqui: lê-se "agora", nunca um número negativo
  const segundos = (agora.getTime() - data.getTime()) / 1000;
  if (segundos < 60) return "agora";

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;

  // A partir de 24 h conta-se por dias de calendário em Lisboa, não por blocos de 24 h
  const d = diaLisboa(data);
  const a = diaLisboa(agora);
  const dias = Math.round((Date.UTC(a.ano, a.mes - 1, a.dia) - Date.UTC(d.ano, d.mes - 1, d.dia)) / 86_400_000);

  // Só acontece no dia de 25 h (fim do horário de verão): 24 h atrás ainda é o mesmo dia
  if (dias < 1) return `há ${horas} h`;
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;

  const curto = `${d.dia} ${MESES[d.mes - 1]}`;
  return d.ano === a.ano ? curto : `${curto} ${d.ano}`;
}

// ── Nomes ─────────────────────────────────────────────────────────────────────
// "Renan Silva Sanches" → "Renan Sanches" (primeiro + último nome)
export function nomeCurto(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

// ── Permissões ────────────────────────────────────────────────────────────────
export function eStaff(perfil: PerfilUsuario): boolean {
  return perfil === "admin" || perfil === "professor";
}

// O autor apaga o seu comentário; staff apaga qualquer um
export function podeApagarComentario(s: Sessao, autorComentarioId: string): boolean {
  return s.userId === autorComentarioId || eStaff(s.perfil);
}

// Só staff edita. Cada um edita os seus posts; os automáticos (autor null) qualquer staff edita.
export function podeEditarPost(s: Sessao, autorPostId: string | null): boolean {
  if (!eStaff(s.perfil)) return false;
  return autorPostId === null || autorPostId === s.userId;
}

// Staff apaga qualquer post
export function podeApagarPost(s: Sessao): boolean {
  return eStaff(s.perfil);
}

// ── Cursor de paginação ───────────────────────────────────────────────────────
// `${criadoEm}|${id}` em base64url. Opaco para o cliente. Funciona no browser e no Node
// (TextEncoder + btoa em vez de Buffer) e aguenta UTF-8.
export function codificarCursor(criadoEm: string, id: string): string {
  const bytes = new TextEncoder().encode(`${criadoEm}|${id}`);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Os dois valores descodificados são metidos num filtro `.or()` do PostgREST, e o cursor vem do
// cliente — por isso só passam formas que não conseguem partir o filtro:
// - criadoEm: timestamp ISO-8601 (o Postgres devolve "2026-10-26T12:00:00.123456+00:00");
// - id: não vazio, sem vírgula, parênteses nem espaços (não exige UUID).
const FORMA_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;
const FORMA_ID = /^[^,()\s]+$/;

// Nunca lança: devolve null se não descodificar, não tiver 2 partes ou os valores forem inválidos
export function descodificarCursor(c: string): { criadoEm: string; id: string } | null {
  try {
    const b64 = c.replace(/-/g, "+").replace(/_/g, "/");
    const binario = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(binario, (ch) => ch.charCodeAt(0));
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const partes = texto.split("|");
    if (partes.length !== 2) return null;
    const [criadoEm, id] = partes;
    if (!FORMA_TIMESTAMP.test(criadoEm) || Number.isNaN(Date.parse(criadoEm))) return null;
    if (!FORMA_ID.test(id)) return null;
    return { criadoEm, id };
  } catch {
    return null;
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────
// URL público de uma foto do bucket "feed" → caminho dentro do bucket (para remover).
// Devolve null para URLs de outros buckets.
export function caminhoNoBucket(url: string): string | null {
  const marca = `/object/public/${BUCKET_FEED}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;
  const caminho = url.slice(i + marca.length).split(/[?#]/)[0];
  return caminho || null;
}
