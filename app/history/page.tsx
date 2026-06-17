import { redirect } from "next/navigation";
import { getCachedProfile, getRecentWorkouts } from "@/lib/data";
import HistoryList from "./HistoryList";

export default async function HistoryPage() {
  const [profile, workouts] = await Promise.all([
    getCachedProfile(),
    getRecentWorkouts(),
  ]);

  if (!profile) redirect("/onboarding");

  const trend = workouts
    .slice(0, 14)
    .reverse()
    .map((w) => ({ date: w.date.toISOString().slice(0, 10), score: w.readinessScore, status: w.status }));

  return (
    <div className="py-8">
      <h1 className="mb-4 text-2xl font-black">Training History</h1>
      <HistoryList
        workouts={workouts.map((w) => ({ ...w, date: w.date.toISOString().slice(0, 10) }))}
        trend={trend}
      />
    </div>
  );
}
