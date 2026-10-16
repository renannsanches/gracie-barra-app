import { Skeleton, SkeletonDark } from "@/components/ui/skeleton";
import { AppPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppPageSkeleton
      title="Aulas"
      headerExtra={
        <div className="flex gap-2 mt-4 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonDark key={i} className="w-12 h-14 rounded-xl shrink-0" />
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        <Skeleton className="h-3.5 w-24 mx-1" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </AppPageSkeleton>
  );
}
