"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import { saveDailyLog } from "@/app/actions";
import { cn } from "@/lib/utils";
import { Plus, Minus, Droplets, Check } from "lucide-react";
import { toast } from "sonner";

type DailyLogData = {
  sleepStart: string | null;
  sleepEnd: string | null;
  waterGlasses: number;
} | null;

function generateTimeSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  let h = startHour;
  while (true) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h === endHour) break;
    slots.push(`${h.toString().padStart(2, "0")}:30`);
    h = (h + 1) % 24;
  }
  return slots;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m ? `${hour}:${m.toString().padStart(2, "0")}` : `${hour} ${period}`;
}

function sleepDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const duration = endMins >= startMins ? endMins - startMins : 1440 - startMins + endMins;
  const hrs = Math.floor(duration / 60);
  const mins = duration % 60;
  return `${hrs}h${mins ? ` ${mins}m` : ""}`;
}

const BED_TIMES = generateTimeSlots(23, 6);  // 11 PM → 6 AM
const WAKE_TIMES = generateTimeSlots(4, 15); // 4 AM → 3 PM

function TimeScroll({ times, value, onChange, label }: {
  times: string[]; value: string | null; onChange: (t: string) => void; label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && ref.current) {
      const idx = times.indexOf(value);
      const chip = ref.current.children[idx] as HTMLElement | undefined;
      chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [value, times]);

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div ref={ref} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
        {times.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "shrink-0 snap-start rounded-xl border px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
              value === t
                ? "border-primary bg-primary/10 text-primary chip-active"
                : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
            )}
          >
            {formatTime(t)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DailyTracker({ initial }: { initial: DailyLogData }) {
  const [sleepStart, setSleepStart] = useState<string | null>(initial?.sleepStart ?? "23:00");
  const [sleepEnd, setSleepEnd] = useState<string | null>(initial?.sleepEnd ?? "06:00");
  const [waterGlasses, setWaterGlasses] = useState(initial?.waterGlasses ?? 0);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const fd = new FormData();
    if (sleepStart) fd.set("sleepStart", sleepStart);
    if (sleepEnd) fd.set("sleepEnd", sleepEnd);
    fd.set("waterGlasses", String(waterGlasses));

    startTransition(async () => {
      try {
        await saveDailyLog(fd);
        toast.success("Saved.");
      } catch {
        toast.error("Failed to save.");
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card card-elevated overflow-hidden"
    >
      <div className="p-4 space-y-4">
        {/* Sleep */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold flex items-center gap-2">🌙 Sleep</p>
            {sleepStart && sleepEnd && (
              <span className="text-xs font-semibold text-primary">
                {sleepDuration(sleepStart, sleepEnd)}
              </span>
            )}
          </div>
          <TimeScroll times={BED_TIMES} value={sleepStart} onChange={setSleepStart} label="Went to bed" />
          <TimeScroll times={WAKE_TIMES} value={sleepEnd} onChange={setSleepEnd} label="Woke up" />
        </div>

        <div className="h-px bg-border" />

        {/* Water */}
        <div className="space-y-3">
          <p className="text-sm font-bold">💧 Water</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setWaterGlasses((v) => Math.max(0, v - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="text-center min-w-[60px]">
                <p className="text-xl font-black">{waterGlasses}</p>
                <p className="text-xs text-muted-foreground">{waterGlasses * 250}ml</p>
              </div>
              <button
                type="button"
                onClick={() => setWaterGlasses((v) => Math.min(20, v + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-1 flex-wrap justify-end max-w-[160px]">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setWaterGlasses(n)}
                  className={cn(
                    "flex items-center justify-center rounded-lg border w-7 h-7 transition-all",
                    waterGlasses >= n
                      ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
                      : "border-border bg-secondary text-muted-foreground hover:border-blue-400/40"
                  )}
                >
                  <Droplets className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 border-t border-border py-3 text-sm font-bold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        {isPending ? "Saving…" : "Save"}
      </button>
    </motion.div>
  );
}
