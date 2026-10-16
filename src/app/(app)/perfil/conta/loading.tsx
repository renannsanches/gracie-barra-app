import { AppPageSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { UserRound } from "lucide-react";

export default function Loading() {
  return (
    <AppPageSkeleton title="A minha conta" icon={<UserRound size={20} />} back={{ href: "/perfil", label: "Início" }}>
      <div className="space-y-3">
        <div className="bg-surface border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-surface border border-gray-100 rounded-2xl p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </AppPageSkeleton>
  );
}
