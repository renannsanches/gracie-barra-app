// Gamificação (Fase 17): ranking de presenças, sequências semanais e medalhas.
// Funções puras — sem Supabase nem React — para serem testadas em gamificacao.test.ts.
//
// Regras (decididas com a academia):
// - Cada aula registada conta 1 (2 aulas no mesmo dia = 2), como o "Total de aulas" do /perfil.
// - Datas em hora de Lisboa, no formato YYYY-MM-DD; semanas de segunda a domingo.
// - Sequência = semanas seguidas com ≥ META_SEMANAL aulas. A semana em curso nunca quebra a
//   sequência; uma semana em que ninguém treinou na academia (férias) é pausa — não conta
//   nem quebra.
import type { CategoriaFaixa, CorFaixa } from "./types";
import { getMondayKey, resolveCategoria } from "./graduacao-rules";

export const META_SEMANAL = 2;
// Top 3 do mês só a partir do mês de lançamento (antes há só importações parciais)
export const PRIMEIRO_MES_TOP3 = "2026-10";
export const MIN_AULAS_TOP3 = 4;
// Conquistas com mais de N dias quando são gravadas (backfill) não geram push
export const DIAS_SEM_PUSH = 2;

// ── Catálogo ──────────────────────────────────────────────────────────────────

export type NivelConquista = "bronze" | "prata" | "ouro";
export type GrupoConquista = "marcos" | "sequencias" | "especiais";

export interface DefConquista {
  codigo: string;
  grupo: GrupoConquista;
  titulo: string;
  descricao: string;
  nivel: NivelConquista;
  /** Aulas (marcos), semanas (sequências) ou anos (aniversários) */
  limiar?: number;
  /** Pode ser ganha várias vezes (uma por mês) */
  repetivel?: boolean;
}

const MARCOS_AULAS: [number, NivelConquista][] = [
  [10, "bronze"], [25, "bronze"], [50, "prata"], [100, "prata"], [250, "ouro"], [500, "ouro"],
];
const MARCOS_SEQUENCIA: [number, NivelConquista][] = [
  [4, "bronze"], [8, "prata"], [12, "prata"], [26, "ouro"], [52, "ouro"],
];
const MARCOS_ANOS: [number, NivelConquista][] = [[1, "bronze"], [2, "prata"], [3, "ouro"]];

export const CONQUISTAS: DefConquista[] = [
  ...MARCOS_AULAS.map(([n, nivel]): DefConquista => ({
    codigo: `aulas_${n}`, grupo: "marcos", nivel, limiar: n,
    titulo: `${n} aulas`,
    descricao: `Chegou às ${n} aulas no tatame.`,
  })),
  ...MARCOS_SEQUENCIA.map(([n, nivel]): DefConquista => ({
    codigo: `sequencia_${n}`, grupo: "sequencias", nivel, limiar: n,
    titulo: `${n} semanas seguidas`,
    descricao: `${n} semanas seguidas com ${META_SEMANAL} ou mais aulas.`,
  })),
  {
    codigo: "mes_perfeito", grupo: "especiais", nivel: "prata", repetivel: true,
    titulo: "Mês perfeito",
    descricao: `${META_SEMANAL} ou mais aulas em todas as semanas do mês.`,
  },
  {
    codigo: "top3_mes", grupo: "especiais", nivel: "ouro", repetivel: true,
    titulo: "Top 3 do mês",
    descricao: "Terminou o mês no pódio do ranking.",
  },
  ...MARCOS_ANOS.map(([n, nivel]): DefConquista => ({
    codigo: `aniversario_${n}`, grupo: "especiais", nivel, limiar: n,
    titulo: n === 1 ? "1 ano de treino" : `${n} anos de treino`,
    descricao: n === 1 ? "Um ano desde a primeira aula." : `${n} anos desde a primeira aula.`,
  })),
];

export const CONQUISTAS_POR_CODIGO: Record<string, DefConquista> = Object.fromEntries(
  CONQUISTAS.map((c) => [c.codigo, c]),
);

export interface ConquistaCalculada {
  codigo: string;
  /** '' nas únicas; 'YYYY-MM' nas repetíveis */
  referencia: string;
  conquistada_em: string;
}

// ── Datas ─────────────────────────────────────────────────────────────────────

/** Data de hoje em Lisboa (YYYY-MM-DD). */
export function hojeLisboa(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

function mesSeguinte(mes: string): string {
  return addDias(ultimoDiaDoMes(mes), 1).slice(0, 7);
}

/** Limites (inclusivos) do mês ou do ano corrente. */
export function limitesPeriodo(periodo: "mes" | "ano", hoje: string): { inicio: string; fim: string } {
  if (periodo === "mes") {
    const mes = hoje.slice(0, 7);
    return { inicio: `${mes}-01`, fim: ultimoDiaDoMes(mes) };
  }
  const ano = hoje.slice(0, 4);
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
}

function aulasPorSemana(dias: string[]): Map<string, string[]> {
  const semanas = new Map<string, string[]>();
  for (const dia of [...dias].sort()) {
    const seg = getMondayKey(dia);
    const lista = semanas.get(seg);
    if (lista) lista.push(dia);
    else semanas.set(seg, [dia]);
  }
  return semanas;
}

// ── Sequência ─────────────────────────────────────────────────────────────────

export interface Sequencia {
  /** Semanas seguidas até agora (inclui a semana em curso se já cumpriu a meta) */
  atual: number;
  melhor: number;
  semanaAtual: { aulas: number; meta: number };
  /** 1ª vez que a sequência chegou a cada tamanho: tamanho → dia da aula que o fechou */
  atingidaEm: Map<number, string>;
}

export function calcularSequencia(dias: string[], semanasAcademia: string[], hoje: string): Sequencia {
  const porSemana = aulasPorSemana(dias);
  const academia = new Set(semanasAcademia);
  const semanaHoje = getMondayKey(hoje);
  const atingidaEm = new Map<number, string>();
  let atual = 0;
  let melhor = 0;

  const primeira = [...porSemana.keys()].sort()[0];
  if (primeira) {
    for (let seg = primeira; seg <= semanaHoje; seg = addDias(seg, 7)) {
      const aulas = porSemana.get(seg) ?? [];
      if (aulas.length >= META_SEMANAL) {
        atual++;
        melhor = Math.max(melhor, atual);
        if (!atingidaEm.has(atual)) atingidaEm.set(atual, aulas[META_SEMANAL - 1]);
      } else if (seg === semanaHoje || !academia.has(seg)) {
        // semana em curso ou academia fechada: pausa
      } else {
        atual = 0;
      }
    }
  }

  return {
    atual,
    melhor,
    semanaAtual: { aulas: porSemana.get(semanaHoje)?.length ?? 0, meta: META_SEMANAL },
    atingidaEm,
  };
}

// ── Mês perfeito ──────────────────────────────────────────────────────────────

/** Meses fechados ('YYYY-MM') em que todas as semanas (com segunda no mês) tiveram a meta. */
export function mesesPerfeitos(dias: string[], semanasAcademia: string[], hoje: string): string[] {
  const porSemana = aulasPorSemana(dias);
  const academia = new Set(semanasAcademia);
  const mesAtual = hoje.slice(0, 7);
  const meses = [...new Set(dias.map((d) => d.slice(0, 7)))].filter((m) => m < mesAtual).sort();

  return meses.filter((mes) => {
    let contadas = 0;
    for (let seg = getMondayKey(`${mes}-01`); seg <= ultimoDiaDoMes(mes); seg = addDias(seg, 7)) {
      if (seg.slice(0, 7) !== mes || !academia.has(seg)) continue;
      if ((porSemana.get(seg)?.length ?? 0) < META_SEMANAL) return false;
      contadas++;
    }
    return contadas > 0;
  });
}

// ── Ranking ───────────────────────────────────────────────────────────────────

export type GrupoRanking = "adulto" | "infantil";

/** Adultos/Kids pela mesma regra da graduação: faixa infantil → Kids. */
export function grupoRanking(faixa: CorFaixa | string | null, categoria: CategoriaFaixa | string | null): GrupoRanking {
  if (!faixa) return categoria === "infantil" ? "infantil" : "adulto";
  return resolveCategoria(faixa as CorFaixa, (categoria ?? "adulto") as CategoriaFaixa);
}

/** Ordena por aulas (desc) e nome; posição com empates partilhados (1, 1, 3). */
export function ordenarRanking<T extends { aulas: number; nome: string }>(linhas: T[]): (T & { posicao: number })[] {
  const ordenadas = [...linhas].sort((a, b) => b.aulas - a.aulas || a.nome.localeCompare(b.nome, "pt"));
  let posicao = 0;
  return ordenadas.map((l, i) => {
    if (i === 0 || l.aulas !== ordenadas[i - 1].aulas) posicao = i + 1;
    return { ...l, posicao };
  });
}

/** Nome curto: adultos "Primeiro Último"; kids "Primeiro U." */
export function nomeRanking(nome: string, grupo: GrupoRanking): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? "";
  const ultimo = partes[partes.length - 1];
  return grupo === "infantil" ? `${partes[0]} ${ultimo[0].toUpperCase()}.` : `${partes[0]} ${ultimo}`;
}

export interface ParticipanteTop3 {
  alunoId: string;
  nome: string;
  grupo: GrupoRanking;
  dias: string[];
}

/** Alunos no pódio (posição ≤ 3, com mínimo de aulas) de um mês, por grupo. */
export function top3DoMes(participantes: ParticipanteTop3[], mes: string): Set<string> {
  const vencedores = new Set<string>();
  for (const grupo of ["adulto", "infantil"] as GrupoRanking[]) {
    const linhas = participantes
      .filter((p) => p.grupo === grupo)
      .map((p) => ({ alunoId: p.alunoId, nome: p.nome, aulas: p.dias.filter((d) => d.startsWith(mes)).length }))
      .filter((l) => l.aulas >= MIN_AULAS_TOP3);
    for (const l of ordenarRanking(linhas)) if (l.posicao <= 3) vencedores.add(l.alunoId);
  }
  return vencedores;
}

/** Meses fechados elegíveis para o Top 3 (do lançamento até ao mês passado). */
export function mesesTop3(hoje: string): string[] {
  const meses: string[] = [];
  for (let m = PRIMEIRO_MES_TOP3; m < hoje.slice(0, 7); m = mesSeguinte(m)) meses.push(m);
  return meses;
}

// ── Conquistas ────────────────────────────────────────────────────────────────

export interface EntradaConquistas {
  /** Uma entrada por aula (Lisboa) */
  dias: string[];
  semanasAcademia: string[];
  /** Aulas antes da app, sem data */
  aulasManual: number;
  /** Datas conhecidas de início (data_inicio, created_at); a 1ª aula também conta */
  inicioCandidatos: (string | null | undefined)[];
  /** Meses 'YYYY-MM' em que ficou no Top 3 */
  mesesTop3: string[];
  hoje: string;
}

export function calcularConquistas(e: EntradaConquistas): ConquistaCalculada[] {
  const dias = [...e.dias].sort();
  const res: ConquistaCalculada[] = [];
  const add = (codigo: string, conquistada_em: string, referencia = "") =>
    res.push({ codigo, referencia, conquistada_em });

  // Marcos de aulas: a base manual conta antes da 1ª aula com data
  for (const [n] of MARCOS_AULAS) {
    if (e.aulasManual >= n) add(`aulas_${n}`, dias[0] ?? e.hoje);
    else if (dias.length + e.aulasManual >= n) add(`aulas_${n}`, dias[n - e.aulasManual - 1]);
  }

  // Sequências
  const { atingidaEm } = calcularSequencia(dias, e.semanasAcademia, e.hoje);
  for (const [n] of MARCOS_SEQUENCIA) {
    const dia = atingidaEm.get(n);
    if (dia) add(`sequencia_${n}`, dia);
  }

  // Especiais
  for (const mes of mesesPerfeitos(dias, e.semanasAcademia, e.hoje)) {
    add("mes_perfeito", ultimoDiaDoMes(mes), mes);
  }
  for (const mes of e.mesesTop3) add("top3_mes", ultimoDiaDoMes(mes), mes);

  const inicio = [...e.inicioCandidatos, dias[0]]
    .filter((d): d is string => !!d && d >= "2000-01-01")
    .map((d) => d.slice(0, 10))
    .sort()[0];
  if (inicio) {
    const [a, m, d] = inicio.split("-").map(Number);
    for (const [n] of MARCOS_ANOS) {
      // Date.UTC passa 29/02 num ano não bissexto para 01/03
      const dia = new Date(Date.UTC(a + n, m - 1, d)).toISOString().slice(0, 10);
      if (dia <= e.hoje) add(`aniversario_${n}`, dia);
    }
  }

  return res;
}

/** Progresso para as medalhas ainda bloqueadas. */
export function progressoConquista(
  def: DefConquista,
  estado: { totalAulas: number; melhorSequencia: number; anos: number },
): { atual: number; alvo: number } | null {
  if (!def.limiar) return null;
  if (def.grupo === "marcos") return { atual: Math.min(estado.totalAulas, def.limiar), alvo: def.limiar };
  if (def.grupo === "sequencias") return { atual: Math.min(estado.melhorSequencia, def.limiar), alvo: def.limiar };
  if (def.codigo.startsWith("aniversario_")) return { atual: Math.min(estado.anos, def.limiar), alvo: def.limiar };
  return null;
}
