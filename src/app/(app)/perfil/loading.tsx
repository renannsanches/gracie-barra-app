import { Skeleton, SkeletonDark } from "@/components/ui/skeleton";

/** Forma da home compacta: header baixo + próxima aula + frequência + faixa. */
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas" aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <div className="bg-ink px-4 pt-header pb-4">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <SkeletonDark className="h-7 w-7 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <SkeletonDark className="h-3.5 w-32" />
            <SkeletonDark className="h-5 w-40" />
          </div>
          <SkeletonDark className="h-11 w-11 rounded-full shrink-0" />
          <SkeletonDark className="h-11 w-11 rounded-full shrink-0" />
        </div>
      </div>
      <div className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 space-y-3 pb-bottom-nav">
        <div className="bg-surface border border-gray-100 rounded-2xl p-4 space-y-2.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="bg-surface border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
          <Skeleton className="w-10 h-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>
        <div className="bg-surface border border-gray-100 rounded-2xl p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}
