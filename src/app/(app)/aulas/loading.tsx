import { Skeleton } from "@/components/ui/skeleton";
import { AppPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppPageSkeleton title="Aulas">
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, d) => (
          <div key={d} className="space-y-2.5">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3.5 w-1/3" />
                </div>
                <Skeleton className="h-9 w-24 rounded-xl" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </AppPageSkeleton>
  );
}
