import { Skeleton } from "@/components/ui/skeleton";
import { AppPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppPageSkeleton title="Registrar Presença">
      <div className="flex flex-col items-center gap-6 pt-6">
        <Skeleton className="w-28 h-28 rounded-full" />
        <div className="w-full max-w-sm flex flex-col items-center gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-14 w-full max-w-sm rounded-2xl" />
      </div>
    </AppPageSkeleton>
  );
}
