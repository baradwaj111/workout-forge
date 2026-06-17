"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveProfile } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, Flame } from "lucide-react";

const GOALS = [
  { value: "STRENGTH", emoji: "🏋️", label: "Strength", desc: "Move heavy things" },
  { value: "MUSCLE", emoji: "💪", label: "Muscle", desc: "Build size & definition" },
  { value: "FAT_LOSS", emoji: "🔥", label: "Fat Loss", desc: "Lean out, keep muscle" },
  { value: "ENDURANCE", emoji: "🏃", label: "Endurance", desc: "Cardio & stamina" },
  { value: "GENERAL", emoji: "⚡", label: "General", desc: "All-around fitness" },
  { value: "ATHLETIC", emoji: "🎯", label: "Athletic", desc: "Sport performance" },
];

const EXPERIENCE = [
  { value: "NEW", emoji: "🌱", label: "Beginner", desc: "Under 1 year" },
  { value: "INTERMEDIATE", emoji: "📈", label: "Intermediate", desc: "1–4 years" },
  { value: "ADVANCED", emoji: "🦅", label: "Advanced", desc: "4+ years serious" },
];

const LOCATIONS = [
  { value: "FULL_GYM", emoji: "🏟️", label: "Full Gym", desc: "Barbells, cables, machines" },
  { value: "HOME_DUMBBELLS", emoji: "🏠", label: "Home Gym", desc: "Dumbbells & basics" },
  { value: "MINIMAL", emoji: "🎒", label: "Minimal", desc: "Bodyweight / bands" },
];

const DAYS = [2, 3, 4, 5, 6];
const UNITS = [{ value: "KG", label: "kg" }, { value: "LB", label: "lb" }];

function OptionCard({
  emoji, label, desc, active, onClick,
}: {
  emoji: string; label: string; desc?: string; active: boolean; onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative flex items-center gap-3 w-full rounded-2xl border p-4 text-left transition-all duration-200",
        active
          ? "border-primary bg-primary/10 chip-active"
          : "border-border bg-card hover:border-primary/40 hover:bg-secondary"
      )}
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className={cn("font-semibold", active ? "text-primary" : "text-foreground")}>{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {active && (
        <motion.div
          layoutId="check"
          className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          ✓
        </motion.div>
      )}
    </motion.button>
  );
}

const STEPS = [
  { key: "goal", title: "What's your main goal?", subtitle: "This shapes your entire program." },
  { key: "experience", title: "How long have you been training?", subtitle: "Be honest — it helps calibrate volume and intensity." },
  { key: "location", title: "Where do you train?", subtitle: "We'll only program what you have access to." },
  { key: "days", title: "How many days per week?", subtitle: "Consistency beats intensity every time." },
  { key: "details", title: "Anything else we should know?", subtitle: "Optional — but the more you share, the better the program." },
];

export default function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<string | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [units, setUnits] = useState("KG");
  const [days, setDays] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const progress = ((step + 1) / STEPS.length) * 100;

  function canAdvance() {
    if (step === 0) return !!goal;
    if (step === 1) return !!experience;
    if (step === 2) return !!location;
    if (step === 3) return !!days;
    return true;
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    formData.set("goal", goal!);
    formData.set("experience", experience!);
    formData.set("trainingLocation", location!);
    formData.set("units", units);
    formData.set("daysPerWeek", String(days!));
    await saveProfile(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div>
            <h2 className="text-xl font-bold">{STEPS[step].title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{STEPS[step].subtitle}</p>
          </div>

          {step === 0 && (
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <OptionCard key={g.value} {...g} active={goal === g.value} onClick={() => setGoal(g.value)} />
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              {EXPERIENCE.map((e) => (
                <OptionCard key={e.value} {...e} active={experience === e.value} onClick={() => setExperience(e.value)} />
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              {LOCATIONS.map((l) => (
                <OptionCard key={l.value} {...l} active={location === l.value} onClick={() => setLocation(l.value)} />
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={cn(
                      "flex h-14 w-14 flex-col items-center justify-center rounded-2xl border font-bold text-lg transition-all",
                      days === d
                        ? "border-primary bg-primary/10 text-primary chip-active"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {d}
                    <span className="text-[10px] font-normal opacity-60">days</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <p className="text-sm text-muted-foreground self-center mr-1">Units:</p>
                {UNITS.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setUnits(u.value)}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-semibold transition-all",
                      units === u.value
                        ? "border-primary bg-primary/10 text-primary chip-active"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold flex items-center gap-2">
                  🏗️ Equipment available
                </label>
                <Textarea name="equipmentNote" placeholder="e.g. Pull-up bar, adjustable dumbbells up to 40kg, resistance bands" className="resize-none bg-card border-border" rows={2} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold flex items-center gap-2">
                  🎯 Specific focus or goals
                </label>
                <Textarea name="focusNote" placeholder="e.g. Bigger shoulders, stronger deadlift, run a 5k" className="resize-none bg-card border-border" rows={2} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold flex items-center gap-2">
                  🩹 Injuries or movements to avoid
                </label>
                <Textarea name="avoidNote" placeholder="e.g. Left knee — no deep squats, shoulder impingement — no overhead press" className="resize-none bg-card border-border" rows={2} />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(step - 1)}
            className="border-border"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            className="flex-1 font-bold"
            disabled={!canAdvance()}
            onClick={() => setStep(step + 1)}
          >
            Continue <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" className="flex-1 font-bold" disabled={submitting}>
            {submitting ? (
              "Building your program…"
            ) : (
              <>
                <Flame className="mr-2 h-4 w-4" />
                Let&apos;s forge it
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
