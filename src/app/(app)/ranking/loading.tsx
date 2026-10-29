import { Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppPageSkeleton title="Ranking de presenças" icon={<Trophy size={20} />} back={{ href: "/perfil", label: "Início" }}>
      <div className="bg-surface rounded-2xl border border-line divide-y divide-line">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-5 shrink-0" />
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-[10rem]" />
            <Skeleton className="h-4 w-8 ml-auto" />
          </div>
        ))}
      </div>
    </AppPageSkeleton>
  );
}
