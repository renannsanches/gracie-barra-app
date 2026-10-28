import { CalendarCheck, Cake, Flame, Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONQUISTAS_POR_CODIGO, type NivelConquista } from "@/lib/gamificacao";

const CORES: Record<NivelConquista, string> = {
  bronze: "bg-gradient-to-br from-amber-500 to-orange-700 text-orange-50",
  prata:  "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-700",
  ouro:   "bg-gradient-to-br from-yellow-200 to-amber-400 text-amber-800",
};

const TAMANHOS = {
  sm: { caixa: "w-9 h-9", icone: 16, numero: "text-[13px]", fogo: 9 },
  md: { caixa: "w-14 h-14", icone: 24, numero: "text-[18px]", fogo: 12 },
  lg: { caixa: "w-24 h-24", icone: 44, numero: "text-[34px]", fogo: 18 },
};

/** Medalha redonda: número para marcos de aulas e sequências, ícone para as especiais. */
export function Medalha({
  codigo,
  tamanho = "md",
  bloqueada = false,
  className,
  style,
}: {
  codigo: string;
  tamanho?: keyof typeof TAMANHOS;
  bloqueada?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const def = CONQUISTAS_POR_CODIGO[codigo];
  const t = TAMANHOS[tamanho];
  const nivel = def?.nivel ?? "bronze";

  let conteudo: React.ReactNode;
  if (bloqueada) {
    conteudo = <Lock size={t.icone * 0.7} />;
  } else if (codigo.startsWith("aulas_")) {
    conteudo = <span className={cn("font-black leading-none tabular-nums", t.numero)}>{def?.limiar}</span>;
  } else if (codigo.startsWith("sequencia_")) {
    conteudo = (
      <span className="flex flex-col items-center leading-none">
        <Flame size={t.fogo} className="mb-0.5" />
        <span className={cn("font-black tabular-nums", t.numero)}>{def?.limiar}</span>
      </span>
    );
  } else if (codigo === "mes_perfeito") {
    conteudo = <CalendarCheck size={t.icone} />;
  } else if (codigo === "top3_mes") {
    conteudo = <Trophy size={t.icone} />;
  } else {
    conteudo = <Cake size={t.icone} />;
  }

  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 ring-2 ring-white shadow-md",
        t.caixa,
        bloqueada ? "bg-subtle text-line-strong shadow-none" : CORES[nivel],
        className,
      )}
    >
      {conteudo}
    </div>
  );
}
