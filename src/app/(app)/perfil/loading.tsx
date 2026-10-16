import { Skeleton, SkeletonDark } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas" aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <div className="bg-ink px-5 pt-header pb-6">
        <div className="flex items-center justify-between mb-5 min-h-9">
          <SkeletonDark className="h-8 w-48" />
          <div className="flex gap-3">
            <SkeletonDark className="h-9 w-9 rounded-full" />
            <SkeletonDark className="h-9 w-9 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <SkeletonDark className="w-[72px] h-[72px] rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonDark className="h-3.5 w-24" />
            <SkeletonDark className="h-6 w-44" />
            <div className="flex gap-1.5">
              <SkeletonDark className="h-5 w-14 rounded-full" />
              <SkeletonDark className="h-5 w-12 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 px-4 pt-4 space-y-3 pb-bottom-nav">
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface border border-gray-100 rounded-xl p-4 space-y-2.5">
              <Skeleton className="w-10 h-10" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface border border-gray-100 rounded-xl px-4 py-3.5 flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
