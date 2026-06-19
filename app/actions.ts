"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateWorkout } from "@/lib/generator";
import type { Goal, Experience, TrainingLocation, Units, FuelLevel, WorkoutStatus, PerceivedDifficulty } from "@prisma/client";

// ── Onboarding ──────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  goal: z.enum(["STRENGTH", "MUSCLE", "FAT_LOSS", "ENDURANCE", "GENERAL", "ATHLETIC"]),
  experience: z.enum(["NEW", "INTERMEDIATE", "ADVANCED"]),
  trainingLocation: z.enum(["FULL_GYM", "HOME_DUMBBELLS", "MINIMAL"]),
  equipmentNote: z.string().optional(),
  daysPerWeek: z.coerce.number().int().min(1).max(7),
  focusNote: z.string().optional(),
  avoidNote: z.string().optional(),
  units: z.enum(["KG", "LB"]).default("KG"),
});

export async function saveProfile(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid profile data");

  await prisma.profile.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/today");
  revalidatePath("/history");
  redirect("/today");
}

// ── Check-in + Workout generation ───────────────────────────────────────────

const CheckInSchema = z.object({
  energy: z.coerce.number().int().min(1).max(5),
  hydration: z.coerce.number().int().min(1).max(4),
  painAreas: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",") : []), z.array(z.string())),
  painNote: z.string().optional(),
  fuelLevel: z.enum(["UNDERFUELED", "LIGHT", "FED", "HEAVY"]),
  mealNote: z.string().optional(),
  minutesAvailable: z.coerce.number().int().min(10).max(240),
  sleepStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sleepEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  waterGlasses: z.coerce.number().int().min(0).max(20).optional(),
});

export type CheckInFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; workoutId: number };

export async function submitCheckIn(
  _prev: CheckInFormState,
  formData: FormData
): Promise<CheckInFormState> {
  const raw = Object.fromEntries(formData.entries());

  // pain areas come as multiple values
  const painAreasRaw = formData.getAll("painAreas") as string[];

  const parsed = CheckInSchema.safeParse({ ...raw, painAreas: painAreasRaw });
  if (!parsed.success) {
    return { status: "error", message: "Please fill in all check-in fields." };
  }

  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  if (!profile) return { status: "error", message: "Profile not found. Please complete onboarding." };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // upsert check-in for today
  let checkIn = await prisma.checkIn.findUnique({ where: { date: today } });
  if (!checkIn) {
    checkIn = await prisma.checkIn.create({
      data: {
        date: today,
        energy: parsed.data.energy,
        hydration: parsed.data.hydration,
        painAreas: parsed.data.painAreas,
        painNote: parsed.data.painNote,
        fuelLevel: parsed.data.fuelLevel as FuelLevel,
        mealNote: parsed.data.mealNote,
        minutesAvailable: parsed.data.minutesAvailable,
        sleepStart: parsed.data.sleepStart,
        sleepEnd: parsed.data.sleepEnd,
        waterGlasses: parsed.data.waterGlasses,
      },
    });
  }

  // check if workout already exists for today
  const existing = await prisma.workout.findUnique({ where: { checkInId: checkIn.id } });
  if (existing) return { status: "success", workoutId: existing.id };

  // fetch last 7 workouts with logs and today's daily log
  const [recentWorkouts, dailyLog] = await Promise.all([
    prisma.workout.findMany({
      orderBy: { date: "desc" },
      take: 7,
      include: { exerciseLogs: true, checkIn: true },
    }),
    prisma.dailyLog.findUnique({ where: { date: today } }),
  ]);

  try {
    const { output, rawOutput } = await generateWorkout(profile, recentWorkouts, checkIn, dailyLog);

    const workout = await prisma.workout.create({
      data: {
        date: today,
        title: output.title,
        focus: output.focus,
        estMinutes: output.estMinutes,
        readinessScore: output.readiness.score,
        readinessLabel: output.readiness.label,
        adapted: output.adapted,
        warmup: output.warmup,
        blocks: output.blocks,
        cooldown: output.cooldown,
        coachNote: output.coachNote,
        fuelNote: output.fuel,
        rawModelOutput: rawOutput,
        checkInId: checkIn.id,
      },
    });

    revalidatePath("/today");
    return { status: "success", workoutId: workout.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      status: "error",
      message: `Could not generate workout: ${msg}. Check your ANTHROPIC_API_KEY and try again.`,
    };
  }
}

// ── Complete workout ─────────────────────────────────────────────────────────

const CompleteSchema = z.object({
  workoutId: z.coerce.number().int(),
  perceivedDifficulty: z.enum(["EASY", "RIGHT", "HARD"]),
  sessionNote: z.string().optional(),
});

export async function completeWorkout(formData: FormData): Promise<void> {
  const parsed = CompleteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Invalid completion data");

  const workout = await prisma.workout.findUnique({
    where: { id: parsed.data.workoutId },
    include: { exerciseLogs: true },
  });
  if (!workout) throw new Error("Workout not found");

  // parse blocks JSON and create ExerciseLogs if none exist yet
  if (workout.exerciseLogs.length === 0) {
    type BlockJson = { name: string; exercises: { name: string; scheme: string; rpe: string; rest: string; muscleGroup?: string }[] };
    const blocks = workout.blocks as BlockJson[];
    const logs = blocks.flatMap((block) =>
      block.exercises.map((ex) => {
        const [sets, reps] = ex.scheme.replace(/x/i, "×").split("×");
        return {
          workoutId: workout.id,
          name: ex.name,
          muscleGroup: ex.muscleGroup || block.name,
          sets: parseInt(sets || "1", 10),
          reps: reps || ex.scheme,
          rpe: parseFloat(ex.rpe.replace(/[^0-9.]/g, "")) || null,
        };
      })
    );
    if (logs.length > 0) {
      await prisma.exerciseLog.createMany({ data: logs });
    }
  }

  await prisma.workout.update({
    where: { id: parsed.data.workoutId },
    data: {
      status: "COMPLETED" as WorkoutStatus,
      perceivedDifficulty: parsed.data.perceivedDifficulty as PerceivedDifficulty,
      sessionNote: parsed.data.sessionNote,
    },
  });

  revalidatePath("/today");
  revalidatePath("/history");
}

export type RegenerateState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function regenerateWorkout(
  _prev: RegenerateState,
  formData: FormData
): Promise<RegenerateState> {
  const workoutId = parseInt(formData.get("workoutId") as string, 10);
  const feedback = (formData.get("feedback") as string || "").trim();

  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: { checkIn: true },
  });
  if (!workout || workout.status !== "PLANNED") {
    return { status: "error", message: "Can only regenerate a planned workout." };
  }

  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  if (!profile) return { status: "error", message: "Profile not found." };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [recentWorkouts, dailyLog] = await Promise.all([
    prisma.workout.findMany({
      where: { id: { not: workoutId } },
      orderBy: { date: "desc" },
      take: 7,
      include: { exerciseLogs: true, checkIn: true },
    }),
    prisma.dailyLog.findUnique({ where: { date: today } }),
  ]);

  try {
    const { output, rawOutput } = await generateWorkout(profile, recentWorkouts, workout.checkIn, dailyLog, feedback || undefined);

    await prisma.workout.update({
      where: { id: workoutId },
      data: {
        title: output.title,
        focus: output.focus,
        estMinutes: output.estMinutes,
        readinessScore: output.readiness.score,
        readinessLabel: output.readiness.label,
        adapted: output.adapted,
        warmup: output.warmup,
        blocks: output.blocks,
        cooldown: output.cooldown,
        coachNote: output.coachNote,
        fuelNote: output.fuel,
        rawModelOutput: rawOutput,
      },
    });

    revalidatePath("/today");
    return { status: "success" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { status: "error", message: `Regeneration failed: ${msg}` };
  }
}

export async function skipWorkout(workoutId: number): Promise<void> {
  await prisma.workout.update({
    where: { id: workoutId },
    data: { status: "SKIPPED" as WorkoutStatus },
  });
  revalidatePath("/today");
  revalidatePath("/history");
}

// ── Daily log (sleep + water) ────────────────────────────────────────────────

const DailyLogSchema = z.object({
  sleepStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sleepEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  waterGlasses: z.coerce.number().int().min(0).max(20),
});

export async function saveDailyLog(formData: FormData): Promise<void> {
  const parsed = DailyLogSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Invalid daily log data");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailyLog.upsert({
    where: { date: today },
    create: { date: today, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/today");
}
