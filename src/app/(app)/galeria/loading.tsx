import { Images } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppPageSkeleton title="Galeria" icon={<Images size={20} />} back={{ href: "/perfil", label: "Início" }}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl border border-line overflow-hidden">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </AppPageSkeleton>
  );
}
