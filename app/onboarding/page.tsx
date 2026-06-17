import OnboardingForm from "./OnboardingForm";
import { Flame } from "lucide-react";

export default function OnboardingPage() {
  return (
    <div className="py-8 min-h-[100dvh] flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-[0_0_24px_oklch(0.705_0.213_46/0.4)]">
            <Flame className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black gradient-text">FORGE</h1>
            <p className="text-xs text-muted-foreground">Your personal AI coach</p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Answer 5 quick questions and I&apos;ll build a science-backed program tailored to you — then adapt it daily based on how you feel.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
