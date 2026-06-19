"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useActionState } from "react";
import { completeWorkout, skipWorkout, regenerateWorkout, type RegenerateState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import ReadinessGauge from "@/components/ReadinessGauge";
import { Clock, CheckCircle2, SkipForward, ChevronDown, ChevronUp, ArrowLeftRight, Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Workout } from "@prisma/client";

type Exercise = { name: string; scheme: string; rpe: string; rest: string; note?: string; swap?: string; muscleGroup?: string };
type Block = { name: string; exercises: Exercise[] };

const DIFFICULTY = [
  { value: "EASY", emoji: "😅", label: "Too easy" },
  { value: "RIGHT", emoji: "💯", label: "Just right" },
  { value: "HARD", emoji: "🥵", label: "Too hard" },
] as const;

function ExerciseRow({ ex, index }: { ex: Exercise; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-border bg-background overflow-hidden"
    >
      <div className="flex items-center gap-3 p-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-black text-muted-foreground">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{ex.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs font-mono font-bold text-primary">{ex.scheme}</span>
            <span className="text-xs text-muted-foreground">{ex.rpe}</span>
            <span className="text-xs text-muted-foreground">· {ex.rest} rest</span>
          </div>
        </div>
        {(ex.note || ex.swap) && (
          <button type="button" onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-foreground p-1">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-border bg-secondary/40 px-3 py-2.5 space-y-1.5">
              {ex.note && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3 w-3 mt-0.5 shrink-0 text-primary" />{ex.note}
                </p>
              )}
              {ex.swap && (
                <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <ArrowLeftRight className="h-3 w-3 shrink-0 text-primary" />{ex.swap}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ListCard({ emoji, title, items }: { emoji: string; title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-2.5">
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{emoji} {title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WorkoutPlan({ workout }: { workout: Workout }) {
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenState, regenAction, regenPending] = useActionState<RegenerateState, FormData>(
    regenerateWorkout,
    { status: "idle" }
  );

  const blocks = workout.blocks as Block[];
  const warmup = workout.warmup as string[];
  const cooldown = workout.cooldown as string[];
  const isDone = workout.status === "COMPLETED" || workout.status === "SKIPPED";

  async function handleComplete(formData: FormData) {
    if (!difficulty) { toast.error("Pick a difficulty first."); return; }
    formData.set("workoutId", String(workout.id));
    formData.set("perceivedDifficulty", difficulty);
    setCompleting(true);
    try {
      await completeWorkout(formData);
      toast.success("Session logged. Nice work.");
    } catch {
      toast.error("Failed to save. Try again.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    try {
      await skipWorkout(workout.id);
      toast.info("Skipped. Rest up.");
    } catch {
      toast.error("Failed to skip.");
    } finally {
      setSkipping(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card card-elevated p-5 space-y-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {isDone && (
              <Badge className={cn("mb-1 text-xs font-semibold",
                workout.status === "COMPLETED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-secondary text-muted-foreground border-border"
              )}>
                {workout.status === "COMPLETED" ? "✓ Completed" : "Skipped"}
              </Badge>
            )}
            <h1 className="text-2xl font-black leading-tight text-foreground">{workout.title}</h1>
            <p className="text-sm text-muted-foreground">{workout.focus}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 rounded-xl bg-secondary px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-bold">{workout.estMinutes}m</span>
          </div>
        </div>

        {/* Adapted note */}
        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
          <span className="text-primary mt-0.5 text-sm font-bold shrink-0">↳</span>
          <p className="text-sm text-foreground/80">{workout.adapted}</p>
        </div>
      </motion.div>

      <ReadinessGauge score={workout.readinessScore} label={workout.readinessLabel} />

      <ListCard emoji="🌡️" title="Warm-up" items={warmup} />

      {blocks.map((block, bi) => (
        <motion.div key={bi}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + bi * 0.06 }}
          className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="h-1 w-3 rounded-full bg-primary" />
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{block.name}</h3>
          </div>
          <div className="space-y-2">
            {block.exercises.map((ex, ei) => <ExerciseRow key={ei} ex={ex} index={ei} />)}
          </div>
        </motion.div>
      ))}

      <ListCard emoji="❄️" title="Cool-down" items={cooldown} />

      {/* Coach + Fuel */}
      <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Coach note</p>
          <p className="text-sm leading-relaxed">{workout.coachNote}</p>
        </div>
        <div className="h-px bg-border" />
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Fuel</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{workout.fuelNote}</p>
        </div>
      </div>

      {/* Regenerate */}
      {!isDone && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <button
            type="button"
            onClick={() => setRegenOpen((o) => !o)}
            className="w-full flex items-center justify-between rounded-2xl border border-border bg-card card-elevated px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Not feeling this plan?
            </span>
            {regenOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <AnimatePresence>
            {regenOpen && (
              <motion.form
                action={regenAction}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-b-2xl border border-t-0 border-border bg-card px-4 pb-4 pt-3 space-y-3">
                  <input type="hidden" name="workoutId" value={workout.id} />
                  <Textarea
                    name="feedback"
                    placeholder="Tell the coach why — e.g. 'my knees are sore today', 'I only have 30 min', 'too much chest, add more back'…"
                    className="resize-none text-sm"
                    rows={3}
                  />
                  {regenState.status === "error" && (
                    <p className="text-xs text-destructive">{regenState.message}</p>
                  )}
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full h-10 rounded-xl font-semibold"
                    disabled={regenPending}
                  >
                    <RefreshCw className={cn("mr-1.5 h-4 w-4", regenPending && "animate-spin")} />
                    {regenPending ? "Generating…" : "Regenerate workout"}
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Completion */}
      {!isDone && (
        <motion.form action={handleComplete}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-4"
        >
          <p className="text-sm font-bold">How did it feel?</p>
          <div className="flex gap-2">
            {DIFFICULTY.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setDifficulty(opt.value)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition-all",
                  difficulty === opt.value
                    ? "border-primary bg-primary/8 text-primary chip-active"
                    : "border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <span className="text-xl">{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
          <Textarea name="sessionNote" placeholder="Session notes, PRs, how it felt…" className="resize-none" rows={2} />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 font-bold h-11 rounded-xl" disabled={completing}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {completing ? "Saving…" : "Mark complete"}
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-xl px-4" onClick={handleSkip} disabled={skipping}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </motion.form>
      )}
    </div>
  );
}
