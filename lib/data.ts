import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

// Deduplicated within a single render tree
export const getProfile = cache(async () => {
  return prisma.profile.findUnique({ where: { id: 1 } });
});

// Profile is a singleton that barely changes — cache across requests for 60s
export const getCachedProfile = unstable_cache(
  async () => prisma.profile.findUnique({ where: { id: 1 } }),
  ["profile"],
  { revalidate: 60, tags: ["profile"] }
);

export const getTodayCheckIn = cache(async (date: Date) => {
  return prisma.checkIn.findUnique({
    where: { date },
    include: { workout: { include: { exerciseLogs: true } } },
  });
});

export const getTodayDailyLog = cache(async (date: Date) => {
  return prisma.dailyLog.findUnique({ where: { date } });
});

export const getRecentWorkouts = cache(async () => {
  return prisma.workout.findMany({
    orderBy: { date: "desc" },
    take: 30,
    select: {
      id: true,
      date: true,
      title: true,
      focus: true,
      estMinutes: true,
      readinessScore: true,
      readinessLabel: true,
      status: true,
      perceivedDifficulty: true,
      sessionNote: true,
    },
  });
});

export const getAnalyticsData = cache(async () => {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [workouts, dailyLogs] = await Promise.all([
    prisma.workout.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        title: true,
        status: true,
        readinessScore: true,
        estMinutes: true,
        perceivedDifficulty: true,
        exerciseLogs: {
          select: { name: true, muscleGroup: true, sets: true, reps: true, load: true },
        },
      },
    }),
    prisma.dailyLog.findMany({
      where: { date: { gte: new Date(Date.now() - 30 * 86400000) } },
      orderBy: { date: "asc" },
      select: { date: true, sleepStart: true, sleepEnd: true, waterGlasses: true },
    }),
  ]);

  return { workouts, dailyLogs };
});
