import { redirect } from "next/navigation";
import { getCachedProfile, getTodayCheckIn, getTodayDailyLog } from "@/lib/data";
import CheckInForm from "./CheckInForm";
import WorkoutPlan from "./WorkoutPlan";
import DailyTracker from "./DailyTracker";

export default async function TodayPage() {
  const profile = await getCachedProfile();
  if (!profile) redirect("/onboarding");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [checkIn, dailyLog] = await Promise.all([
    getTodayCheckIn(today),
    getTodayDailyLog(today),
  ]);

  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateFmt = today.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const trackerInitial = dailyLog
    ? { sleepStart: dailyLog.sleepStart, sleepEnd: dailyLog.sleepEnd, waterGlasses: dailyLog.waterGlasses }
    : null;

  if (!checkIn || !checkIn.workout) {
    return (
      <div className="py-8 space-y-6">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">{dayName}</p>
          <h1 className="text-3xl font-black">{dateFmt}</h1>
          <p className="text-muted-foreground text-sm mt-1">How are you feeling today?</p>
        </div>
        <DailyTracker initial={trackerInitial} />
        <CheckInForm />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-primary">{dayName} · {dateFmt}</p>
      </div>
      <DailyTracker initial={trackerInitial} />
      <WorkoutPlan workout={checkIn.workout} />
    </div>
  );
}
