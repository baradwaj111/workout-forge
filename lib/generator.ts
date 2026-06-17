import Anthropic from "@anthropic-ai/sdk";
import type { Profile, CheckIn, Workout, ExerciseLog, DailyLog } from "@prisma/client";
import { WorkoutOutputSchema, toolInputSchema, type WorkoutOutput } from "./schemas";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an elite strength & conditioning coach and exercise physiologist programming ONE training session for a single client for today. Apply evidence-based principles: progressive overload, autoregulation via RPE/RIR, specificity, sensible weekly volume per muscle, fatigue management and deloads, and recovery.

Hard rules:
- Autoregulate to readiness. Low energy/hydration/fuel or poor recent recovery -> cut volume and intensity, shorten the session, favor technique or active recovery. High readiness -> progress (small load/rep/set bump or a top set).
- NEVER program movements that load a reported pain area. Treat sharp or joint pain as a hard stop for that movement and substitute; treat general muscle soreness more leniently. Never tell the client to push through joint or sharp pain.
- Build on history: don't hammer the same muscle group hard on back-to-back days; rotate emphasis; nudge progression vs the last similar session and the client's perceivedDifficulty feedback.
- Fuel and hydration guidance is for performance and recovery only — supportive and qualitative (e.g. protein + carbs around training, hydrate). NEVER count calories, prescribe restriction, or comment on weight or body image.
- Respect equipment, goal, experience, and minutesAvailable.
- Keep it engaging and varied — rotate exercise selection, occasionally add a fun finisher — but never at the cost of safety or coherence.
- If readiness is very low or pain is significant, prescribe a genuine recovery/mobility day or rest; that is a valid output.
Return your answer ONLY by calling the provided tool. Keep every 'note' field under ~12 words.`;

type RecentWorkout = Workout & { exerciseLogs: ExerciseLog[]; checkIn: CheckIn };

function buildUserMessage(profile: Profile, checkIn: CheckIn, recentWorkouts: RecentWorkout[], dailyLog?: DailyLog | null): string {
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
      .slice(0, 4)
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

Generate today's session now. Be specific about load suggestions based on history (estimate if no history). Ensure variety from recent sessions.`;
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
  dailyLog?: DailyLog | null
): Promise<{ output: WorkoutOutput; rawOutput: string }> {
  const userMessage = buildUserMessage(profile, checkIn, recentWorkouts, dailyLog);

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
