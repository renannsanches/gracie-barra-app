import type { CorFaixa, CategoriaFaixa, HistoricoGraduacao, Profile } from "./types";

// ── Adulto: meses necessários por grau (índice = grau atual, 0-based) ─────────
const ADULTO_MESES: Partial<Record<CorFaixa, number[]>> = {
  branca: [1, 1, 2, 4, 4],
  azul:   [4, 5, 5, 5, 5],
  roxa:   [3, 3, 4, 4, 4],
  marrom: [3, 3, 4, 4, 4],
  preta:  [36, 36, 36, 60, 60, 60],
};

// ── Adulto: meses mínimos na faixa actual antes de subir de faixa ─────────────
const ADULTO_MIN_MESES_FAIXA: Partial<Record<CorFaixa, number>> = {
  branca: 12,
  azul:   24,
  roxa:   18,
  marrom: 18,
  preta:  372, // 31 anos
};

// ── Adulto: idade mínima para receber a faixa alvo ───────────────────────────
const ADULTO_IDADE_MIN: Partial<Record<CorFaixa, number>> = {
  azul:   16,
  roxa:   16,
  marrom: 18,
  preta:  19,
};

// ── Adulto: sequência de faixas ───────────────────────────────────────────────
const ADULTO_PROXIMA_FAIXA: Partial<Record<CorFaixa, CorFaixa>> = {
  branca: "azul",
  azul:   "roxa",
  roxa:   "marrom",
  marrom: "preta",
};

// ── Infantil: sequência de variantes (cada uma tem graus 0-4) ─────────────────
const INFANTIL_SEQUENCIA: CorFaixa[] = [
  "branca",
  "cinza_branca", "cinza", "cinza_preta",
  "amarela_branca", "amarela", "amarela_preta",
  "laranja_branca", "laranja", "laranja_preta",
  "verde_branca", "verde", "verde_preta",
];

// ── Infantil: meses mínimos em cada variante ──────────────────────────────────
const INFANTIL_MIN_MESES_FAIXA: Partial<Record<CorFaixa, number>> = {
  branca: 6,
  // todas as demais = 12 (default abaixo)
};

// ── Infantil: idade mínima para receber a faixa alvo (raiz da cor) ────────────
const INFANTIL_IDADE_MIN: Partial<Record<CorFaixa, number>> = {
  amarela_branca: 7, amarela: 7, amarela_preta: 7,
  laranja_branca: 10, laranja: 10, laranja_preta: 10,
  verde_branca: 13, verde: 13, verde_preta: 13,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isInfantilBelt(faixa: CorFaixa): boolean {
  return INFANTIL_SEQUENCIA.includes(faixa) && faixa !== "branca";
}

function resolveCategoria(faixa: CorFaixa, categoria: CategoriaFaixa): "adulto" | "infantil" {
  if (isInfantilBelt(faixa)) return "infantil";
  if (categoria === "infantil") return "infantil";
  return "adulto";
}

function diffMonths(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function idadeEm(dataNascimento: string, referencia: Date): number {
  const nasc = new Date(dataNascimento + "T12:00:00");
  let idade = referencia.getFullYear() - nasc.getFullYear();
  const m = referencia.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && referencia.getDate() < nasc.getDate())) idade--;
  return idade;
}

// Retorna segunda-feira da semana de uma data YYYY-MM-DD
function getMondayKey(dia: string): string {
  const d = new Date(dia + "T12:00:00");
  const dow = d.getDay(); // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

// ── Funções públicas ──────────────────────────────────────────────────────────

/** Próxima faixa/grau dado o estado actual. Null se não houver. */
export function getNextPromotion(
  faixa: CorFaixa,
  graus: number,
  categoria: CategoriaFaixa,
): { faixa: CorFaixa; graus: number } | null {
  const cat = resolveCategoria(faixa, categoria);

  if (cat === "infantil") {
    const idx = INFANTIL_SEQUENCIA.indexOf(faixa);
    if (idx === -1) return null;
    if (graus < 4) return { faixa, graus: graus + 1 };
    const next = INFANTIL_SEQUENCIA[idx + 1];
    return next ? { faixa: next, graus: 0 } : null;
  }

  // Adulto
  const meses = ADULTO_MESES[faixa];
  if (!meses) return null;
  if (graus < meses.length - 1) return { faixa, graus: graus + 1 };
  const nextFaixa = ADULTO_PROXIMA_FAIXA[faixa];
  return nextFaixa ? { faixa: nextFaixa, graus: 0 } : null;
}

/** Semanas qualificadas necessárias para o próximo grau/faixa. */
export function getRequiredWeeks(
  faixa: CorFaixa,
  graus: number,
  categoria: CategoriaFaixa,
): number {
  const cat = resolveCategoria(faixa, categoria);
  if (cat === "infantil") return 4; // 1 mês × 4 semanas

  const meses = ADULTO_MESES[faixa];
  if (!meses) return 0;
  const m = meses[graus] ?? meses[meses.length - 1];
  return m * 4;
}

/** Meses mínimos na faixa actual (checado ao mudar de faixa, não ao subir grau). */
export function getMinBeltMonths(faixa: CorFaixa, categoria: CategoriaFaixa): number {
  const cat = resolveCategoria(faixa, categoria);
  if (cat === "infantil") return INFANTIL_MIN_MESES_FAIXA[faixa] ?? 12;
  return ADULTO_MIN_MESES_FAIXA[faixa] ?? 0;
}

/** Quando o aluno recebeu a faixa actual (primeira entrada com faixa_nova = faixa). */
export function getBeltStartDate(
  historico: HistoricoGraduacao[],
  currentFaixa: CorFaixa,
  createdAt: string,
): string {
  // historico já vem ordenado DESC; pegar o mais antigo para esta faixa
  const entries = historico
    .filter((h) => h.faixa_nova === currentFaixa)
    .sort((a, b) => a.data_graduacao.localeCompare(b.data_graduacao));
  return entries.length > 0 ? entries[0].data_graduacao : createdAt.split("T")[0];
}

/** Data de referência para contar semanas qualificadas (última graduação ou created_at). */
export function getLastGradeDate(
  historico: HistoricoGraduacao[],
  createdAt: string,
): string {
  if (historico.length === 0) return createdAt.split("T")[0];
  // historico vem DESC
  return historico[0].data_graduacao;
}

/** Conta semanas (seg-dom) com ≥2 presenças desde fromDate (inclusive). */
export function calcularSemanasQualificadas(dias: string[], fromDate: string): number {
  const weekMap = new Map<string, number>();
  for (const dia of dias) {
    if (dia < fromDate) continue;
    const key = getMondayKey(dia);
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }
  let count = 0;
  for (const v of weekMap.values()) if (v >= 2) count++;
  return count;
}

// ── Resultado principal ───────────────────────────────────────────────────────

export interface ElegibilidadeResult {
  elegivel: boolean;
  proximaPromocao: { faixa: CorFaixa; graus: number } | null;
  semanasQualificadas: number;
  semanasNecessarias: number;
  /** 0 = mínimo de faixa já atingido */
  mesesFaixaRestantes: number;
  idadeInsuficiente: boolean;
}

/**
 * Calcula elegibilidade para próxima graduação.
 * @param diasPresenca  Array de strings YYYY-MM-DD de cada presença
 */
export function calcularElegibilidade(
  profile: Pick<Profile, "faixa" | "graus" | "categoria" | "data_nascimento" | "created_at">,
  diasPresenca: string[],
  historico: HistoricoGraduacao[],
): ElegibilidadeResult {
  const { faixa, graus, categoria, data_nascimento, created_at } = profile;

  const noResult: ElegibilidadeResult = {
    elegivel: false,
    proximaPromocao: null,
    semanasQualificadas: 0,
    semanasNecessarias: 0,
    mesesFaixaRestantes: 0,
    idadeInsuficiente: false,
  };

  if (!faixa) return noResult;

  const proximaPromocao = getNextPromotion(faixa, graus, categoria);
  if (!proximaPromocao) return noResult;

  const hoje = new Date();
  const refDate = getLastGradeDate(historico, created_at);
  const semanasQualificadas = calcularSemanasQualificadas(diasPresenca, refDate);
  const semanasNecessarias = getRequiredWeeks(faixa, graus, categoria);

  // Verificar tempo mínimo de faixa (só relevante quando vai mudar de faixa)
  let mesesFaixaRestantes = 0;
  const mudaFaixa = proximaPromocao.faixa !== faixa;
  if (mudaFaixa) {
    const beltStart = getBeltStartDate(historico, faixa, created_at);
    const beltStartDate = new Date(beltStart + "T12:00:00");
    const mesesNaFaixa = diffMonths(beltStartDate, hoje);
    const minMeses = getMinBeltMonths(faixa, categoria);
    mesesFaixaRestantes = Math.max(0, minMeses - mesesNaFaixa);
  }

  // Verificar idade mínima para faixa alvo
  let idadeInsuficiente = false;
  if (mudaFaixa) {
    const cat = resolveCategoria(faixa, categoria);
    const idadeMin = cat === "adulto"
      ? (ADULTO_IDADE_MIN[proximaPromocao.faixa] ?? 0)
      : (INFANTIL_IDADE_MIN[proximaPromocao.faixa] ?? 0);
    if (idadeMin > 0 && data_nascimento) {
      const idade = idadeEm(data_nascimento, hoje);
      idadeInsuficiente = idade < idadeMin;
    }
  }

  const elegivel =
    semanasQualificadas >= semanasNecessarias &&
    mesesFaixaRestantes === 0 &&
    !idadeInsuficiente;

  return {
    elegivel,
    proximaPromocao,
    semanasQualificadas,
    semanasNecessarias,
    mesesFaixaRestantes,
    idadeInsuficiente,
  };
}
