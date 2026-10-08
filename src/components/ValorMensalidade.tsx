import { cn, formatarMoeda } from "@/lib/utils";
import { descreverItens, formatarEuro } from "@/lib/modalidades";
import type { ItemMensalidade } from "@/lib/types";

interface DetalheProps {
  valor: number;
  itens: ItemMensalidade[] | null | undefined;
  className?: string;
}

/**
 * De onde vem o valor (ex.: "Jiu-Jitsu 50 € · Capoeira 20 €").
 * Só aparece quando há mais de uma modalidade ou um ajuste manual.
 */
export function DetalheMensalidade({ valor, itens, className }: DetalheProps) {
  const { linhas, ajuste, temDetalhe } = descreverItens(valor, itens);
  if (!temDetalhe) return null;
  return (
    <span className={cn("block text-xs font-normal text-gray-500 tabular-nums whitespace-normal", className)}>
      {linhas.map((l) => `${l.nome} ${formatarEuro(l.valor)}`).join(" · ")}
      {ajuste !== 0 && ` · Ajuste ${ajuste > 0 ? "+" : "−"}${formatarEuro(Math.abs(ajuste))}`}
    </span>
  );
}

interface Props extends DetalheProps {
  /** Alinhamento do detalhe (tabelas com valores à direita) */
  align?: "left" | "right";
}

/** Valor da mensalidade com a composição por baixo. */
export function ValorMensalidade({ valor, itens, className, align = "left" }: Props) {
  return (
    <span className={cn("inline-flex flex-col", align === "right" ? "items-end text-right" : "items-start", className)}>
      <span className="tabular-nums">{formatarMoeda(Number(valor))}</span>
      <DetalheMensalidade valor={valor} itens={itens} />
    </span>
  );
}
