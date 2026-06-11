import type { Mensalidade, StatusMensalidade } from "./types";

/**
 * Status efetivo derivado da data de vencimento.
 * - "pago" sempre vence: mensalidade paga é paga.
 * - Não-paga + vencimento < hoje → "atrasado".
 * - Caso contrário → "pendente".
 *
 * Evita depender do enum `status` literal no DB, que não tem job
 * automático para flip "pendente"→"atrasado".
 */
export function getEffectiveStatus(
  m: Pick<Mensalidade, "status" | "data_vencimento">,
  today: Date = new Date(),
): StatusMensalidade {
  if (m.status === "pago") return "pago";
  const hojeStr = today.toISOString().slice(0, 10);
  return m.data_vencimento < hojeStr ? "atrasado" : "pendente";
}

/**
 * Aluno está bloqueado se tem mensalidade não-paga vencida há ≥10 dias.
 */
export function isBloqueadoFinanceiramente(
  mensalidades: Pick<Mensalidade, "status" | "data_vencimento">[],
  today: Date = new Date(),
): boolean {
  const limite = new Date(today);
  limite.setDate(limite.getDate() - 10);
  const limiteStr = limite.toISOString().slice(0, 10);
  return mensalidades.some(
    (m) => m.status !== "pago" && m.data_vencimento <= limiteStr,
  );
}

/**
 * Dias de atraso de uma mensalidade. 0 se paga ou ainda dentro do prazo.
 */
export function getDiasAtraso(
  m: Pick<Mensalidade, "status" | "data_vencimento">,
  today: Date = new Date(),
): number {
  if (m.status === "pago") return 0;
  const venc = new Date(m.data_vencimento + "T00:00:00");
  const diff = Math.floor((today.getTime() - venc.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

/**
 * Maior atraso (em dias) entre um conjunto de mensalidades.
 */
export function getMaiorAtraso(
  mensalidades: Pick<Mensalidade, "status" | "data_vencimento">[],
  today: Date = new Date(),
): number {
  if (mensalidades.length === 0) return 0;
  return Math.max(0, ...mensalidades.map((m) => getDiasAtraso(m, today)));
}
