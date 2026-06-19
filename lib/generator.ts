import Anthropic from "@anthropic-ai/sdk";
import type { Profile, CheckIn, Workout, ExerciseLog, DailyLog } from "@prisma/client";
import { WorkoutOutputSchema, toolInputSchema, type WorkoutOutput } from "./schemas";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an elite strength & conditioning coach and exercise physiologist programming ONE training session for a single client for today. Apply evidence-based principles: progressive overload, autoregulation via RPE/RIR, specificity, sensible weekly volume per muscle, fatigue management and deloads, and recovery.

Hard rules:
- Autoregulate to readiness. Low energy/hydration/fuel or poor recent recovery -> cut volume and intensity, shorten the session, favor technique or active recovery. High readiness -> progress (small load/rep/set bump or a top set).
- NEVER program movements that load a reported pain area. Treat sharp or joint pain as a hard stop for that movement and substitute; treat general muscle soreness more leniently. Never tell the client to push through joint or sharp pain.
- TRAINING SPLIT — choose based on daysPerWeek to hit each muscle 2-3x/week:
  • 3 days/week → Full-body every session (only way to achieve 3x frequency).
  • 4 days/week → Full-body every session, or upper/lower done TWICE each (2x frequency minimum). Do NOT do isolated single-muscle days.
  • 5-6 days/week → Push/Pull/Legs or Upper/Lower is acceptable (each hit 2x). Pure "leg day only" or "chest day only" splits are forbidden unless the client explicitly requested them.
  Never default to an isolated split (pure upper, pure lower, pure arms) unless daysPerWeek ≥ 5 AND goal is MUSCLE or STRENGTH with explicit justification.
- EXERCISE COUNT — hard cap: 4 to 6 working exercises per session. 7 is the absolute maximum and only if minutesAvailable ≥ 75. More exercises is not better; depth (sets, load, quality) beats breadth. Warmup drills and cooldown stretches are NOT counted toward this limit.
- Build on history: rotate muscle emphasis across sessions; nudge progression vs the last similar session and the client's perceivedDifficulty feedback.
- VARIETY — enforce all three layers every session:
  1. Exercise rotation: Do NOT repeat any exercise that appears in the two most recent COMPLETED sessions (see analytics below). For cornerstone compounds (squat, deadlift, bench press, row) that must recur, change the implement or stance — barbell→dumbbell→machine→cable, conventional→sumo, flat→incline, etc.
  2. Movement pattern rotation: vary which patterns lead the session. Cycle across: horizontal push, vertical push, horizontal pull, vertical pull, knee-dominant, hip-dominant, core/carry. No two consecutive sessions should open with the same pattern.
  3. Rep range rotation: cycle strength (2–5), hypertrophy (6–12), and pump/endurance (13–20) across sessions. Do not run the same primary rep range two sessions in a row.
- Fuel and hydration guidance is for performance and recovery only — supportive and qualitative (e.g. protein + carbs around training, hydrate). NEVER count calories, prescribe restriction, or comment on weight or body image.
- Respect equipment, goal, experience, and minutesAvailable.
- If readiness is very low or pain is significant, prescribe a genuine recovery/mobility day or rest; that is a valid output.
Return your answer ONLY by calling the provided tool. Keep every 'note' field under ~12 words.`;

type RecentWorkout = Workout & { exerciseLogs: ExerciseLog[]; checkIn: CheckIn };

function computeAnalytics(recentWorkouts: RecentWorkout[]): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const muscleLastWorked: Record<string, Date> = {};
  for (const w of recentWorkouts) {
    const wDate = new Date(w.date);
    wDate.setHours(0, 0, 0, 0);
    for (const log of w.exerciseLogs) {
      if (log.muscleGroup) {
        const ex = muscleLastWorked[log.muscleGroup];
        if (!ex || wDate > ex) muscleLastWorked[log.muscleGroup] = wDate;
      }
    }
  }

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weeklyVolume: Record<string, number> = {};
  for (const w of recentWorkouts) {
    const wDate = new Date(w.date);
    wDate.setHours(0, 0, 0, 0);
    if (wDate >= weekStart && w.status === "COMPLETED") {
      for (const log of w.exerciseLogs) {
        if (log.muscleGroup)
          weeklyVolume[log.muscleGroup] = (weeklyVolume[log.muscleGroup] || 0) + log.sets;
      }
    }
  }

  const liftSessions: Record<string, { load: number; date: Date }[]> = {};
  for (const w of recentWorkouts) {
    if (w.status !== "COMPLETED") continue;
    const wDate = new Date(w.date);
    for (const log of w.exerciseLogs) {
      if (log.load != null) {
        if (!liftSessions[log.name]) liftSessions[log.name] = [];
        liftSessions[log.name].push({ load: log.load, date: wDate });
      }
    }
  }
  const progressionLines: string[] = [];
  for (const [name, sessions] of Object.entries(liftSessions)) {
    const sorted = sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sorted.length < 2) continue;
    const prev = sorted[sorted.length - 2].load;
    const last = sorted[sorted.length - 1].load;
    const trend = last > prev ? "↑ progressing" : last < prev ? "↓ regressing" : "→ stalled";
    progressionLines.push(`  ${name}: ${prev} → ${last} (${trend})`);
  }

  const completed = recentWorkouts
    .filter((w) => w.status === "COMPLETED")
    .map((w) => { const d = new Date(w.date); d.setHours(0, 0, 0, 0); return d.getTime(); })
    .sort((a, b) => b - a);
  let consecutive = 0;
  let check = today.getTime();
  for (const ts of completed) {
    if (ts === check) { consecutive++; check -= 86400000; }
    else if (ts < check) break;
  }

  const recencyLines = Object.entries(muscleLastWorked).map(([m, d]) => {
    const days = Math.round((today.getTime() - d.getTime()) / 86400000);
    return `  ${m}: ${days === 0 ? "today" : `${days}d ago`}`;
  });
  const volumeLines = Object.entries(weeklyVolume).map(([m, s]) => `  ${m}: ${s} sets`);

  const recentExerciseLines = recentWorkouts
    .filter((w) => w.status === "COMPLETED")
    .slice(0, 5)
    .map((w) => {
      const dateStr = new Date(w.date).toISOString().slice(0, 10);
      const names = [...new Set(w.exerciseLogs.map((l) => l.name))].join(", ");
      return `  ${dateStr}: ${names || "none logged"}`;
    });

  return `== PRE-COMPUTED ANALYTICS ==
Consecutive training days: ${consecutive}

Muscle group last worked:
${recencyLines.join("\n") || "  No data"}

Weekly volume (sets completed this week):
${volumeLines.join("\n") || "  No data"}

Lift progression (last two logged sessions):
${progressionLines.join("\n") || "  No data — no load history yet"}

Recent exercises by session (newest first — use this to enforce variety):
${recentExerciseLines.join("\n") || "  No data"}`;
}

function buildUserMessage(profile: Profile, checkIn: CheckIn, recentWorkouts: RecentWorkout[], dailyLog?: DailyLog | null, userFeedback?: string): string {
  const goalMap: Record<string, string> = {
    STRENGTH: "Maximum strength", MUSCLE: "Muscle hypertrophy",
    FAT_LOSS: "Fat loss with muscle retention", ENDURANCE: "Cardiovascular endurance",
    GENERAL: "General fitness", ATHLETIC: "Athletic performance",
  };
  const locationMap: Record<string, string> = {
    FULL_GYM: "Full commercial gym", HOME_DUMBBELLS: "Home gym with dumbbells",
    MINIMAL: "Minimal/bodyweight only",
  };
  const fuelMap: Record<string, string> = {
    UNDERFUELED: "underfueled (low energy intake)", LIGHT: "lightly fueled",
    FED: "well fed", HEAVY: "heavily fed (potentially sluggish)",
  };

  const historyLines = recentWorkouts.map((w) => {
    const keyLifts = w.exerciseLogs
      .map((e) => `${e.name} ${e.sets}x${e.reps}${e.load ? ` @ ${e.load}${profile.units}` : ""}`)
      .join(", ");
    const dateStr = w.date instanceof Date ? w.date.toISOString().slice(0, 10) : String(w.date).slice(0, 10);
    return `• ${dateStr} | ${w.title} (${w.focus}) | ${w.status}${w.perceivedDifficulty ? ` | Felt: ${w.perceivedDifficulty}` : ""} | Key lifts: ${keyLifts || "none logged"}`;
  });

  function sleepSummary(): string {
    const s = dailyLog?.sleepStart ?? null;
    const e = dailyLog?.sleepEnd ?? null;
    if (!s || !e) return "not logged";
    const [sh, sm] = s.split(":").map(Number);
    const [eh, em] = e.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    const duration = endMins >= startMins ? endMins - startMins : 1440 - startMins + endMins;
    const hrs = Math.floor(duration / 60);
    const mins = duration % 60;
    const fmt = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const p = h >= 12 ? "PM" : "AM";
      return `${h % 12 || 12}${m ? `:${m.toString().padStart(2, "0")}` : ""} ${p}`;
    };
    return `${fmt(s)} → ${fmt(e)} (${hrs}h${mins ? ` ${mins}m` : ""})`;
  }

  const waterGlasses = dailyLog?.waterGlasses ?? null;

  const dateStr = checkIn.date instanceof Date ? checkIn.date.toISOString().slice(0, 10) : String(checkIn.date).slice(0, 10);

  const regenSection = userFeedback
    ? `\n== REGENERATION REQUEST ==\nThe client reviewed the generated plan and asked for a revision. Their feedback:\n"${userFeedback}"\nGenerate a meaningfully different session that directly addresses this feedback while respecting all constraints above.\n`
    : "";

  return `== CLIENT PROFILE ==
Goal: ${goalMap[profile.goal] || profile.goal}
Experience: ${profile.experience}
Training location: ${locationMap[profile.trainingLocation] || profile.trainingLocation}
Equipment note: ${profile.equipmentNote || "none"}
Days per week: ${profile.daysPerWeek}
Focus note: ${profile.focusNote || "none"}
Avoid/limitations: ${profile.avoidNote || "none"}
Units: ${profile.units}

== TODAY'S CHECK-IN ==
Date: ${dateStr}
Energy level: ${checkIn.energy}/5
Hydration: ${checkIn.hydration}/4
Sleep last night: ${sleepSummary()}
Water so far today: ${waterGlasses != null ? `${waterGlasses} glasses (${waterGlasses * 250}ml)` : "not logged"}
Pain areas: ${checkIn.painAreas.length > 0 ? checkIn.painAreas.join(", ") : "none"}
Pain note: ${checkIn.painNote || "none"}
Fuel: ${fuelMap[checkIn.fuelLevel] || checkIn.fuelLevel}
Meal note: ${checkIn.mealNote || "none"}
Time available: ${checkIn.minutesAvailable} minutes

== LAST 7 SESSIONS ==
${historyLines.length > 0 ? historyLines.join("\n") : "No history yet — this is the first session."}

Generate today's session now. Be specific about load suggestions based on history (estimate if no history). Ensure variety from recent sessions.

${computeAnalytics(recentWorkouts)}${regenSection}`;
}

async function callModel(userMessage: string): Promise<WorkoutOutput> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "log_workout",
        description: "Log today's programmed workout session",
        input_schema: toolInputSchema,
      },
    ],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not call the tool — no structured output returned");
  }

  const parsed = WorkoutOutputSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${JSON.stringify(parsed.error.issues)}`);
  }
  return parsed.data;
}

export async function generateWorkout(
  profile: Profile,
  recentWorkouts: RecentWorkout[],
  checkIn: CheckIn,
  dailyLog?: DailyLog | null,
  userFeedback?: string
): Promise<{ output: WorkoutOutput; rawOutput: string }> {
  const userMessage = buildUserMessage(profile, checkIn, recentWorkouts, dailyLog, userFeedback);

  try {
    const output = await callModel(userMessage);
    return { output, rawOutput: JSON.stringify(output) };
  } catch (firstError) {
    try {
      const output = await callModel(userMessage);
      return { output, rawOutput: JSON.stringify(output) };
    } catch {
      throw new Error(
        `Workout generation failed after 2 attempts: ${firstError instanceof Error ? firstError.message : String(firstError)}`
      );
    }
  }
}
