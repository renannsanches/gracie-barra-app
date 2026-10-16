import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full p-4 md:p-6 space-y-5 max-w-2xl mx-auto" aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <Skeleton className="h-5 w-20" />
      <div className="bg-surface rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-surface rounded-2xl border border-gray-100 p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
