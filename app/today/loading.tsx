import { Skeleton, CardSkeleton } from "@/components/Skeleton";

export default function TodayLoading() {
  return (
    <div className="py-8 space-y-3">
      <div className="space-y-1 mb-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-3 w-36" />
      </div>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={2} />
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  );
}
