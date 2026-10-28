import { cn } from "@/lib/utils";

/** Bloco cinzento pulsante — dimensionar com as medidas reais do conteúdo. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-line/80", className)}
      {...props}
    />
  );
}

/** Variante para fundos escuros (header preto). */
function SkeletonDark({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("bg-white/10", className)} {...props} />;
}

export { Skeleton, SkeletonDark };
