import { PageHeader } from "@/components/PageHeader";
import { Skeleton, SkeletonDark } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Esqueletos usados pelos loading.tsx. Mostram logo o header real da página
 * (título conhecido) e blocos com o formato do conteúdo que vai chegar, para a
 * navegação parecer instantânea e não haver saltos de layout.
 */

type AppPageSkeletonProps = {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  back?: { href: string; label: string };
  /** Conteúdo extra dentro do header (ex.: barra de dias em /aulas) */
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
};

/** Página do aluno: header escuro + corpo. */
export function AppPageSkeleton({ title, icon, back, headerExtra, children }: AppPageSkeletonProps) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas" aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <PageHeader
        title={title ?? <SkeletonDark className="h-6 w-40 rounded-md" />}
        icon={icon}
        back={back}
        subtitle={<SkeletonDark className="h-4 w-28 mt-1.5 rounded-md" />}
      >
        {headerExtra}
      </PageHeader>
      <div className="flex-1 px-4 py-5 pb-bottom-nav">
        {children ?? <CardListSkeleton />}
      </div>
    </div>
  );
}

/** Lista de cards brancos com título + 2 linhas. */
export function CardListSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface rounded-2xl border border-gray-100 p-5 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/** Grelha 2 colunas (galeria). */
export function GridSkeleton({ count = 6, aspect = "aspect-square" }: { count?: number; aspect?: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-2xl", aspect)} />
      ))}
    </div>
  );
}

/** Página do painel admin: título, barra de filtros e linhas de tabela. */
export function AdminPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-4 md:p-6 space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 max-w-xs rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      <div className="bg-surface rounded-2xl border border-gray-100 divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
