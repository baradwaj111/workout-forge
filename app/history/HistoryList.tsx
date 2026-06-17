"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, MinusCircle, Clock, TrendingUp, Pencil } from "lucide-react";
import { completeWorkout, skipWorkout } from "@/app/actions";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type WorkoutSummary = {
  id: number; date: string; title: string; focus: string; estMinutes: number;
  readinessScore: number; readinessLabel: string; status: string;
  perceivedDifficulty: string | null; sessionNote: string | null;
};
type TrendPoint = { date: string; score: number; status: string };

const DIFFICULTY = [
  { value: "EASY", emoji: "😅", label: "Too easy" },
  { value: "RIGHT", emoji: "💯", label: "Just right" },
  { value: "HARD", emoji: "🥵", label: "Too hard" },
] as const;

function scoreColor(score: number) {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-500";
}

function scoreGlow(score: number) {
  if (score >= 75) return "shadow-[0_0_8px_#10b981]";
  if (score >= 45) return "shadow-[0_0_8px_#f59e0b]";
  return "shadow-[0_0_8px_#ef4444]";
}

function ReadinessTrend({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;
  const w = 320, h = 80, pad = 12;
  const max = 100;
  const step = (w - pad * 2) / (points.length - 1);
  const pts = points.map((p, i) => ({
    x: pad + i * step,
    y: h - pad - (p.score / max) * (h - pad * 2),
    ...p,
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${d} L ${pts[pts.length-1].x} ${h} L ${pts[0].x} ${h} Z`;

  return (
    <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> Readiness trend
        </p>
        <span className="text-xs text-muted-foreground">{points.length} sessions</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" style={{ height: h }}>
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.48 0.21 265)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="oklch(0.48 0.21 265)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((v) => {
          const y = h - pad - (v / max) * (h - pad * 2);
          return <line key={v} x1={pad} x2={w - pad} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />;
        })}
        <path d={area} fill="url(#area-grad)" />
        <path d={d} fill="none" stroke="oklch(0.48 0.21 265)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4}
            fill={p.status === "COMPLETED" ? "oklch(0.48 0.21 265)" : "oklch(0.80 0.01 265)"}
            stroke="white" strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  );
}

function EditStatusDialog({ workout, open, onClose }: { workout: WorkoutSummary; open: boolean; onClose: () => void }) {
  const [difficulty, setDifficulty] = useState<string>(workout.perceivedDifficulty || "RIGHT");
  const [note, setNote] = useState(workout.sessionNote || "");
  const [saving, setSaving] = useState(false);

  async function handleComplete() {
    setSaving(true);
    const fd = new FormData();
    fd.set("workoutId", String(workout.id));
    fd.set("perceivedDifficulty", difficulty);
    if (note) fd.set("sessionNote", note);
    try {
      await completeWorkout(fd);
      toast.success("Session marked as done.");
      onClose();
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    try {
      await skipWorkout(workout.id);
      toast.info("Marked as skipped.");
      onClose();
    } catch {
      toast.error("Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update session</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          {workout.title} · {new Date(workout.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </p>
        <div className="space-y-4 pt-1">
          <div>
            <p className="text-sm font-bold mb-2">How did it feel?</p>
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
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Session notes, PRs, how it felt…"
            className="resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <Button onClick={handleComplete} className="flex-1 font-bold h-11 rounded-xl" disabled={saving}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {saving ? "Saving…" : "Mark complete"}
            </Button>
            <Button type="button" variant="outline" onClick={handleSkip} className="h-11 rounded-xl px-4" disabled={saving} title="Mark as skipped">
              <MinusCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function HistoryList({ workouts, trend }: { workouts: WorkoutSummary[]; trend: TrendPoint[] }) {
  const [editing, setEditing] = useState<WorkoutSummary | null>(null);

  if (workouts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <span className="text-5xl">📭</span>
        <p className="text-lg font-bold">No sessions yet</p>
        <p className="text-sm text-muted-foreground">Complete your first session on the Today tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ReadinessTrend points={trend} />

      {workouts.map((w, i) => (
        <motion.div
          key={w.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {new Date(w.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
              <p className="font-bold leading-tight truncate">{w.title}</p>
              <p className="text-xs text-muted-foreground">{w.focus}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                {w.status === "COMPLETED" ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </span>
                ) : w.status === "SKIPPED" ? (
                  <span className="flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    <MinusCircle className="h-3 w-3" /> Skipped
                  </span>
                ) : (
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">Planned</span>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(w)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Update session status"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {w.perceivedDifficulty && (
                <span className="text-xs text-muted-foreground">
                  {w.perceivedDifficulty === "EASY" ? "😅 Easy" : w.perceivedDifficulty === "RIGHT" ? "💯 Right" : "🥵 Hard"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {w.estMinutes}m
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={cn("h-2 w-2 rounded-full", scoreColor(w.readinessScore), scoreGlow(w.readinessScore))} />
              <span className="text-muted-foreground">{w.readinessLabel} · {w.readinessScore}</span>
            </div>
          </div>

          {w.sessionNote && (
            <p className="text-xs italic text-muted-foreground border-t border-border pt-2">
              &ldquo;{w.sessionNote}&rdquo;
            </p>
          )}
        </motion.div>
      ))}

      {editing && (
        <EditStatusDialog
          workout={editing}
          open={true}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
