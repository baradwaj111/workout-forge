"use client";

import { motion } from "framer-motion";

function scoreColor(score: number) {
  if (score >= 75) return { from: "#10b981", to: "#34d399", text: "text-emerald-600", label: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 45) return { from: "#f59e0b", to: "#fbbf24", text: "text-amber-600", label: "bg-amber-50 text-amber-700 border-amber-200" };
  return { from: "#ef4444", to: "#f87171", text: "text-red-600", label: "bg-red-50 text-red-700 border-red-200" };
}

export default function ReadinessGauge({ score, label, summary }: { score: number; label: string; summary?: string }) {
  const c = scoreColor(score);

  return (
    <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Readiness</span>
        <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${c.label}`}>{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-5xl font-black tabular-nums ${c.text}`}>{score}</span>
        <span className="text-muted-foreground text-lg mb-1">/100</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${c.from}, ${c.to})` }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </div>
      {summary && <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>}
    </div>
  );
}
