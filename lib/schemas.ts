import { z } from "zod";

export const ExerciseSchema = z.object({
  name: z.string(),
  scheme: z.string(),
  rpe: z.string(),
  rest: z.string(),
  note: z.string().optional().default(""),
  swap: z.string().optional().default(""),
  muscleGroup: z.string().optional().default(""),
});

export const BlockSchema = z.object({
  name: z.string(),
  exercises: z.array(ExerciseSchema),
});

export const WorkoutOutputSchema = z.object({
  title: z.string(),
  focus: z.string(),
  estMinutes: z.number().int(),
  readiness: z.object({
    score: z.number().min(0).max(100),
    label: z.string(),
    summary: z.string(),
  }),
  adapted: z.string(),
  warmup: z.array(z.string()),
  blocks: z.array(BlockSchema),
  cooldown: z.array(z.string()),
  coachNote: z.string(),
  fuel: z.string(),
});

export type WorkoutOutput = z.infer<typeof WorkoutOutputSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Block = z.infer<typeof BlockSchema>;

export const toolInputSchema = {
  type: "object" as const,
  properties: {
    title: { type: "string", description: "Short catchy workout title" },
    focus: { type: "string", description: "Primary muscle focus today" },
    estMinutes: { type: "number", description: "Estimated session duration in minutes" },
    readiness: {
      type: "object",
      properties: {
        score: { type: "number", description: "Readiness score 0-100" },
        label: { type: "string", description: "One word: Elite | High | Moderate | Low | Rest" },
        summary: { type: "string", description: "2 sentences explaining today's readiness" },
      },
      required: ["score", "label", "summary"],
    },
    adapted: { type: "string", description: "One line: what changed today vs baseline and why" },
    warmup: { type: "array", items: { type: "string" }, description: "Warmup steps list" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                scheme: { type: "string", description: "e.g. '4x5' or '3x8-10'" },
                rpe: { type: "string", description: "e.g. 'RPE 7-8'" },
                rest: { type: "string", description: "e.g. '90s'" },
                note: { type: "string", description: "Cue or context, max 12 words" },
                swap: { type: "string", description: "Easier or harder swap option" },
                muscleGroup: { type: "string", description: "Primary muscle group" },
              },
              required: ["name", "scheme", "rpe", "rest"],
            },
          },
        },
        required: ["name", "exercises"],
      },
    },
    cooldown: { type: "array", items: { type: "string" }, description: "Cooldown steps list" },
    coachNote: { type: "string", description: "Personal coach note for today's session" },
    fuel: { type: "string", description: "Qualitative nutrition/hydration guidance for this session" },
  },
  required: ["title", "focus", "estMinutes", "readiness", "adapted", "warmup", "blocks", "cooldown", "coachNote", "fuel"],
};
