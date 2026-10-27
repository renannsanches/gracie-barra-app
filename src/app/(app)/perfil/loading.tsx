import { Skeleton, SkeletonDark } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas" aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <div className="bg-ink px-5 pt-header pb-6">
        <div className="flex items-center justify-between mb-5 min-h-11">
          <SkeletonDark className="h-8 w-48" />
          <div className="flex gap-2">
            <SkeletonDark className="h-9 w-9 m-1 rounded-full" />
            <SkeletonDark className="h-9 w-9 m-1 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <SkeletonDark className="w-[72px] h-[72px] rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonDark className="h-6 w-44" />
            <SkeletonDark className="h-5 w-32" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden px-4 pt-3 pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="rounded-full h-11 w-24 shrink-0" />
        ))}
      </div>
      <div className="flex-1 px-4 pt-1 space-y-4 pb-bottom-nav">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="aspect-[4/5] w-full rounded-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
