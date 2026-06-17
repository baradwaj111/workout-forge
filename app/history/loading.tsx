import { Skeleton, CardSkeleton } from "@/components/Skeleton";

export default function HistoryLoading() {
  return (
    <div className="py-8 space-y-3">
      <Skeleton className="h-8 w-48 mb-6" />
      {/* Trend chart skeleton */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <CardSkeleton key={i} lines={3} />
      ))}
    </div>
  );
}
