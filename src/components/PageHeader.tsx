import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Ícone ao lado do título (ex.: <Megaphone size={20} />), pintado com a cor da marca */
  icon?: React.ReactNode;
  /** Link "voltar". Omitir nas páginas que são tabs da barra inferior. */
  back?: { href: string; label: string };
  /** Conteúdo extra dentro do header (chips, segmentos, filtros) */
  children?: React.ReactNode;
  className?: string;
};

/**
 * Header escuro das páginas do aluno. Respeita o notch (pt-header) e usa
 * <Link> no voltar para o Next fazer prefetch.
 */
export function PageHeader({ title, subtitle, icon, back, children, className }: Props) {
  return (
    <header className={cn("bg-ink px-5 pt-header pb-6", className)}>
      <div className="flex items-center justify-between mb-5 min-h-11">
        {back ? (
          <Link
            href={back.href}
            className="-ml-2 flex items-center gap-1.5 h-11 px-2 rounded-lg text-white/60 hover:text-white active:bg-white/10 text-sm transition-colors duration-fast"
          >
            <ArrowLeft size={16} />
            {back.label}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Image src="/logo.webp" alt="" width={28} height={28} className="w-7 h-7 object-contain" priority />
          <span className="text-white font-bold text-xs tracking-wide">GRACIE BARRA</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {icon && <span className="text-brand shrink-0 flex">{icon}</span>}
        <h1 className="text-white font-bold text-xl leading-tight">{title}</h1>
      </div>
      {subtitle && <div className="text-white/50 text-sm mt-0.5">{subtitle}</div>}
      {children}
    </header>
  );
}
