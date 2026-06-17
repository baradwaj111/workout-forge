"use client";

import { useActionState, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { submitCheckIn } from "@/app/actions";
import type { CheckInFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";

const ENERGY = [
  { v: 1, emoji: "😴", label: "Exhausted" },
  { v: 2, emoji: "😕", label: "Low" },
  { v: 3, emoji: "😐", label: "Okay" },
  { v: 4, emoji: "😊", label: "Good" },
  { v: 5, emoji: "🔥", label: "Great" },
];

const HYDRATION = [
  { v: 1, emoji: "🏜️", label: "Very dry" },
  { v: 2, emoji: "💧", label: "A bit dry" },
  { v: 3, emoji: "💦", label: "Good" },
  { v: 4, emoji: "🌊", label: "Hydrated" },
];

const FUEL = [
  { value: "UNDERFUELED", emoji: "💨", label: "Empty", desc: "Barely eaten" },
  { value: "LIGHT", emoji: "🍎", label: "Light", desc: "Snack only" },
  { value: "FED", emoji: "🍗", label: "Fed", desc: "Good meal ~2h ago" },
  { value: "HEAVY", emoji: "🍖", label: "Heavy", desc: "Just ate a lot" },
];

const PAIN_AREAS = [
  "Neck", "Left shoulder", "Right shoulder", "Upper back", "Lower back",
  "Left knee", "Right knee", "Left hip", "Right hip",
  "Left ankle", "Right ankle", "Left wrist", "Right wrist", "Chest",
];

const MINUTES = [20, 30, 45, 60, 75, 90];


function EmojiChip({ emoji, label, active, onClick }: { emoji: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition-all min-w-[60px]",
        active
          ? "border-primary bg-primary/15 chip-active"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className={cn("text-xs font-medium", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
    </motion.button>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 space-y-3"
    >
      <p className="text-sm font-bold flex items-center gap-2">
        <span>{emoji}</span> {title}
      </p>
      {children}
    </motion.div>
  );
}

export default function CheckInForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<CheckInFormState, FormData>(submitCheckIn, { status: "idle" });
  const [energy, setEnergy] = useState<number | null>(null);
  const [hydration, setHydration] = useState<number | null>(null);
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [fuel, setFuel] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  function togglePain(area: string) {
    setPainAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]);
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="energy" value={energy ?? ""} />
      <input type="hidden" name="hydration" value={hydration ?? ""} />
      {painAreas.map((a) => <input key={a} type="hidden" name="painAreas" value={a} />)}
      <input type="hidden" name="fuelLevel" value={fuel ?? ""} />
      <input type="hidden" name="minutesAvailable" value={minutes ?? ""} />

      <Section emoji="⚡" title="Energy level today?">
        <div className="flex gap-2 flex-wrap">
          {ENERGY.map(({ v, emoji, label }) => (
            <EmojiChip key={v} emoji={emoji} label={label} active={energy === v} onClick={() => setEnergy(v)} />
          ))}
        </div>
      </Section>

      <Section emoji="💧" title="Hydration — how do you feel?">
        <div className="flex gap-2 flex-wrap">
          {HYDRATION.map(({ v, emoji, label }) => (
            <EmojiChip key={v} emoji={emoji} label={label} active={hydration === v} onClick={() => setHydration(v)} />
          ))}
        </div>
      </Section>

      <Section emoji="🩹" title="Any pain or soreness?">
        <div className="flex flex-wrap gap-1.5">
          {PAIN_AREAS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => togglePain(area)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                painAreas.includes(area)
                  ? "border-destructive bg-destructive/15 text-destructive"
                  : "border-border bg-secondary text-muted-foreground hover:border-destructive/40"
              )}
            >
              {area}
            </button>
          ))}
        </div>
        {painAreas.length > 0 && (
          <Textarea name="painNote" placeholder="Sharp? Dull? When does it hurt?" className="resize-none bg-secondary border-border mt-1" rows={2} />
        )}
      </Section>

      <Section emoji="🍽️" title="How fueled are you?">
        <div className="grid grid-cols-2 gap-2">
          {FUEL.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFuel(f.value)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all",
                fuel === f.value
                  ? "border-primary bg-primary/10 chip-active"
                  : "border-border bg-secondary hover:border-primary/40"
              )}
            >
              <span className="text-xl">{f.emoji}</span>
              <div>
                <p className={cn("text-sm font-semibold", fuel === f.value ? "text-primary" : "text-foreground")}>{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <Textarea name="mealNote" placeholder="Optional: what did you eat?" className="resize-none bg-secondary border-border mt-1" rows={1} />
      </Section>

      <Section emoji="⏱️" title="Minutes available?">
        <div className="flex flex-wrap gap-2">
          {MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className={cn(
                "rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all",
                minutes === m
                  ? "border-primary bg-primary/10 text-primary chip-active"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
              )}
            >
              {m}<span className="text-xs font-normal opacity-70">m</span>
            </button>
          ))}
        </div>
      </Section>

      {state.status === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full font-bold text-base h-14 rounded-2xl shadow-[0_0_24px_oklch(0.705_0.213_46/0.3)]"
        disabled={pending}
      >
        {pending ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Building your session…</>
        ) : (
          <><Zap className="mr-2 h-5 w-5" /> Generate today&apos;s session</>
        )}
      </Button>
    </form>
  );
}
