import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-secondary", className)} />
  );
}

export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === 0 ? "w-3/4" : "w-1/2")} />
      ))}
    </div>
  );
}
