import { cn } from "@/lib/utils";

/** Card branco da home: cantos 16 px, borda discreta, sem sombra. */
export function Cartao({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) {
  return (
    <section className={cn("bg-surface border border-gray-100 rounded-2xl", className)} {...rest}>
      {children}
    </section>
  );
}

/** Linha de título de um card (ícone + título + acção opcional à direita). */
export function TituloCartao({
  icon,
  titulo,
  extra,
  acao,
}: {
  icon: React.ReactNode;
  titulo: string;
  /** Contador ou etiqueta junto ao título */
  extra?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 min-h-12 border-b border-gray-100">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-gray-900 min-w-0">
        <span className="text-gray-400 shrink-0 flex">{icon}</span>
        <span className="truncate">{titulo}</span>
        {extra}
      </h2>
      {acao}
    </div>
  );
}
