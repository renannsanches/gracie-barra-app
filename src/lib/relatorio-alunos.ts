// Relatório de alunos (/admin/relatorios → Alunos): uma linha por aluno activo, para conferir planos.
// Funções puras — sem Supabase nem React — testadas em relatorio-alunos.test.ts.

import type { CategoriaFaixa, CorFaixa, Modalidade } from "./types";
import { grupoRanking } from "./gamificacao";
import type { LinhaPlano } from "./modalidades";

/** "status" não é escolhido no modal: entra sozinho quando o filtro inclui inactivos. */
export type ColunaRelatorioAluno = "status" | "categoria" | "vencimento" | "valor" | "plano" | "alerta";

export type FiltroStatusAluno = "ativos" | "inativos" | "todos";

/** Inactivos = tudo o que não está activo (inativo ou trancado). */
export const FILTROS_STATUS_ALUNO: { id: FiltroStatusAluno; rotulo: string }[] = [
  { id: "ativos", rotulo: "Ativos" },
  { id: "inativos", rotulo: "Inativos" },
  { id: "todos", rotulo: "Ativos e inativos" },
];

export function rotuloStatus(status: string): string {
  if (status === "ativo") return "Ativo";
  if (status === "trancado") return "Trancado";
  return "Inativo";
}

/** Colunas opcionais do modal, pela ordem em que saem. O nome sai sempre. */
export const COLUNAS_RELATORIO_ALUNO: { id: Exclude<ColunaRelatorioAluno, "status">; rotulo: string }[] = [
  { id: "categoria", rotulo: "Categoria" },
  { id: "vencimento", rotulo: "Vencimento" },
  { id: "valor", rotulo: "Valor" },
  { id: "plano", rotulo: "Plano" },
  { id: "alerta", rotulo: "Alerta" },
];

export type AlertaAluno = "sem_mensalidade" | "valor_diferente_plano" | "kids_valor_adulto" | "vencimento_diferente";

export const ROTULO_ALERTA: Record<AlertaAluno, string> = {
  sem_mensalidade: "Sem mensalidade",
  valor_diferente_plano: "Valor ≠ plano",
  kids_valor_adulto: "Kids com valor adulto",
  vencimento_diferente: "Vencimento diferente",
};

export interface LinhaRelatorioAluno {
  aluno_id: string;
  nome: string;
  /** "Ativo" | "Inativo" | "Trancado" */
  status: string;
  categoria: "Adulto" | "Kids";
  /** YYYY-MM-DD da mensalidade do mês; null = sem mensalidade */
  vencimento: string | null;
  /** Valor da mensalidade do mês; null = sem mensalidade */
  valor: number | null;
  /** Total do plano (modalidades cobradas − descontos) */
  plano: number;
  alertas: AlertaAluno[];
}

/** Adulto/Kids pela regra da graduação (faixa infantil → Kids), igual ao ranking. */
export function categoriaRelatorio(faixa: CorFaixa | string | null, categoria: CategoriaFaixa | string | null): "Adulto" | "Kids" {
  return grupoRanking(faixa, categoria) === "infantil" ? "Kids" : "Adulto";
}

function emCentimos(valor: number): number {
  return Math.round(Number(valor) * 100);
}

/**
 * Dias "combinados" que esta data pode representar.
 * O cadastro passa o dia 5 de sábado/domingo para segunda (dia 6 ou 7),
 * por isso uma segunda-feira no dia d pode ser o dia d, d−1 ou d−2.
 */
export function diasNominais(iso: string): number[] {
  const dia = Number(iso.slice(8, 10));
  const ehSegunda = new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay() === 1;
  return ehSegunda ? [dia, dia - 1, dia - 2].filter((d) => d >= 1) : [dia];
}

/**
 * true quando o vencimento não bate com a maioria das outras mensalidades do aluno.
 * Sem outras mensalidades para comparar → false.
 */
export function vencimentoDiferente(data: string, outrasDatas: string[]): boolean {
  if (outrasDatas.length === 0) return false;
  const deste = diasNominais(data);
  const iguais = outrasDatas.filter((o) => diasNominais(o).some((d) => deste.includes(d))).length;
  return iguais * 2 < outrasDatas.length;
}

/**
 * Menor de 16 a pagar o valor de adulto numa modalidade que tem preço infantil mais baixo.
 * Sem data de nascimento → false (não dá para saber).
 */
export function kidsComValorAdulto(
  idade: number | null,
  linhas: LinhaPlano[],
  modalidades: Map<string, Pick<Modalidade, "valor" | "valor_infantil">>,
): boolean {
  if (idade === null || idade >= 16) return false;
  return linhas.some((l) => {
    if (!l.cobrar) return false;
    const m = modalidades.get(l.modalidade_id);
    if (!m || m.valor_infantil === null) return false;
    const adulto = Number(m.valor);
    if (Number(m.valor_infantil) >= adulto) return false;
    return Number(l.valor) >= adulto;
  });
}

export function alertasDoAluno(p: {
  /** Inactivos não pagam: não ter mensalidade é normal */
  ativo: boolean;
  mensalidade: { valor: number; data_vencimento: string } | null;
  /** Vencimentos das outras mensalidades do aluno (meses vizinhos) */
  outrasDatas: string[];
  plano: number;
  temPlano: boolean;
  kidsValorAdulto: boolean;
}): AlertaAluno[] {
  const alertas: AlertaAluno[] = [];
  if (!p.mensalidade) {
    // Plano a 0 € (tudo pago no local ou desconto total) → é normal não haver mensalidade.
    if (p.ativo && !(p.temPlano && emCentimos(p.plano) === 0)) alertas.push("sem_mensalidade");
  } else if (emCentimos(p.mensalidade.valor) !== emCentimos(p.plano)) {
    alertas.push("valor_diferente_plano");
  }
  if (p.kidsValorAdulto) alertas.push("kids_valor_adulto");
  if (p.mensalidade && vencimentoDiferente(p.mensalidade.data_vencimento, p.outrasDatas)) {
    alertas.push("vencimento_diferente");
  }
  return alertas;
}

/** Alunos com alerta primeiro; dentro de cada grupo, por nome. */
export function ordenarLinhas(linhas: LinhaRelatorioAluno[]): LinhaRelatorioAluno[] {
  return [...linhas].sort(
    (a, b) =>
      Number(b.alertas.length > 0) - Number(a.alertas.length > 0) ||
      a.nome.localeCompare(b.nome, "pt", { sensitivity: "base" }),
  );
}

/** "2026-10" → "2026-07-01" e "2027-01-01" (janela de ±3 meses à volta do mês). */
export function janelaMeses(mes: string, raio = 3): { inicio: string; fim: string } {
  const [ano, m] = mes.split("-").map(Number);
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return {
    inicio: fmt(new Date(Date.UTC(ano, m - 1 - raio, 1))),
    fim: fmt(new Date(Date.UTC(ano, m - 1 + raio, 1))),
  };
}
