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
