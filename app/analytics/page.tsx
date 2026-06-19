import { getAnalyticsData } from "@/lib/data";
import { BarChart2, TrendingUp, Moon, Droplets, Zap } from "lucide-react";

function sleepHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return parseFloat(((mins < 0 ? mins + 1440 : mins) / 60).toFixed(1));
}

function scoreColor(s: number) {
  if (s >= 75) return "oklch(0.72 0.17 152)";
  if (s >= 45) return "oklch(0.72 0.18 85)";
  return "oklch(0.63 0.22 25)";
}

// ─── SVG line chart ──────────────────────────────────────────────────────────
function LineChart({
  points,
  color = "oklch(0.48 0.21 265)",
  min,
  max,
}: {
  points: { x: number; y: number | null }[];
  color?: string;
  min?: number;
  max?: number;
}) {
  const W = 320, H = 72, P = 10;
  const valid = points.filter((p) => p.y != null) as { x: number; y: number }[];
  if (valid.length < 2) return <p className="text-xs text-muted-foreground py-4 text-center">Not enough data</p>;
  const lo = min ?? Math.min(...valid.map((p) => p.y));
  const hi = max ?? Math.max(...valid.map((p) => p.y));
  const range = hi - lo || 1;
  const xStep = (W - P * 2) / (points.length - 1);
  const toSvg = (p: { x: number; y: number }) => ({
    sx: P + p.x * xStep,
    sy: H - P - ((p.y - lo) / range) * (H - P * 2),
  });
  const mapped = valid.map((p) => toSvg(p));
  const d = mapped.map((p, i) => `${i === 0 ? "M" : "L"} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`).join(" ");
  const area = `${d} L ${mapped[mapped.length - 1].sx} ${H} L ${mapped[0].sx} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id={`lg-${color.slice(0, 6).replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => {
        const y = H - P - t * (H - P * 2);
        return <line key={t} x1={P} x2={W - P} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />;
      })}
      <path d={area} fill={`url(#lg-${color.slice(0, 6).replace(/\s/g, "")})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {mapped.map((p, i) => (
        <circle key={i} cx={p.sx} cy={p.sy} r={3.5} fill={color} stroke="white" strokeWidth={2} />
      ))}
    </svg>
  );
}

// ─── Horizontal bar ──────────────────────────────────────────────────────────
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium capitalize">{label}</span>
        <span className="text-muted-foreground tabular-nums">{value} sets</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-1">
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-3xl font-black tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Muscle colour map ───────────────────────────────────────────────────────
const MUSCLE_COLORS: Record<string, string> = {
  chest: "oklch(0.65 0.22 25)",
  back: "oklch(0.48 0.21 265)",
  legs: "oklch(0.72 0.17 152)",
  quads: "oklch(0.72 0.17 152)",
  hamstrings: "oklch(0.68 0.19 140)",
  glutes: "oklch(0.70 0.17 130)",
  shoulders: "oklch(0.72 0.18 85)",
  triceps: "oklch(0.65 0.20 300)",
  biceps: "oklch(0.60 0.22 310)",
  core: "oklch(0.72 0.18 55)",
  calves: "oklch(0.68 0.14 160)",
};
function muscleColor(m: string) {
  return MUSCLE_COLORS[m.toLowerCase()] ?? "oklch(0.55 0.10 265)";
}

export default async function AnalyticsPage() {
  const { workouts, dailyLogs } = await getAnalyticsData();

  // ── Summary stats ──────────────────────────────────────────────────────────
  const completed = workouts.filter((w) => w.status === "COMPLETED");
  const completionRate = workouts.length > 0 ? Math.round((completed.length / workouts.length) * 100) : 0;
  const avgReadiness =
    completed.length > 0
      ? Math.round(completed.reduce((s, w) => s + w.readinessScore, 0) / completed.length)
      : 0;
  const avgDuration =
    completed.length > 0
      ? Math.round(completed.reduce((s, w) => s + w.estMinutes, 0) / completed.length)
      : 0;

  // ── Consecutive days ───────────────────────────────────────────────────────
  const todayTs = new Date(); todayTs.setHours(0, 0, 0, 0);
  const completedTs = completed
    .map((w) => { const d = new Date(w.date); d.setHours(0, 0, 0, 0); return d.getTime(); })
    .sort((a, b) => b - a);
  let streak = 0;
  let check = todayTs.getTime();
  for (const ts of completedTs) {
    if (ts === check) { streak++; check -= 86400000; }
    else if (ts < check) break;
  }

  // ── Readiness trend (last 30) ─────────────────────────────────────────────
  const trendWorkouts = [...workouts].slice(-30);
  const trendPoints = trendWorkouts.map((w, i) => ({
    x: i,
    y: w.status === "COMPLETED" ? w.readinessScore : null,
  }));

  // ── Weekly muscle volume (last 30 days) ───────────────────────────────────
  const muscleVolume: Record<string, number> = {};
  for (const w of completed) {
    const wDate = new Date(w.date);
    wDate.setHours(0, 0, 0, 0);
    if (wDate.getTime() >= Date.now() - 30 * 86400000) {
      for (const log of w.exerciseLogs) {
        if (log.muscleGroup) {
          muscleVolume[log.muscleGroup] = (muscleVolume[log.muscleGroup] || 0) + log.sets;
        }
      }
    }
  }
  const sortedMuscles = Object.entries(muscleVolume).sort((a, b) => b[1] - a[1]);
  const maxMuscleSets = sortedMuscles[0]?.[1] ?? 0;

  // ── Difficulty distribution ───────────────────────────────────────────────
  const diffCount = { EASY: 0, RIGHT: 0, HARD: 0 };
  for (const w of completed) {
    if (w.perceivedDifficulty) diffCount[w.perceivedDifficulty]++;
  }
  const totalDiff = diffCount.EASY + diffCount.RIGHT + diffCount.HARD;

  // ── Key lift progression ───────────────────────────────────────────────────
  const liftMap: Record<string, { date: Date; load: number }[]> = {};
  for (const w of completed) {
    for (const log of w.exerciseLogs) {
      if (log.load != null) {
        if (!liftMap[log.name]) liftMap[log.name] = [];
        liftMap[log.name].push({ date: new Date(w.date), load: log.load });
      }
    }
  }
  const topLifts = Object.entries(liftMap)
    .filter(([, s]) => s.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([name, sessions]) => {
      const sorted = sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
      const first = sorted[0].load;
      const last = sorted[sorted.length - 1].load;
      const diff = +(last - first).toFixed(1);
      const points = sorted.map((s, i) => ({ x: i, y: s.load }));
      return { name, first, last, diff, points, sessions: sorted.length };
    });

  // ── Sleep trend ────────────────────────────────────────────────────────────
  const sleepPoints = dailyLogs.map((d, i) => ({
    x: i,
    y: sleepHours(d.sleepStart, d.sleepEnd),
  }));
  const sleepLogged = sleepPoints.filter((p) => p.y != null).length;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-black tracking-tight gradient-text">Analytics</h1>
        </div>
        <p className="text-sm text-muted-foreground">Last 90 days</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Sessions" value={String(completed.length)} sub={`${workouts.length} total`} />
        <StatCard label="Completion" value={`${completionRate}%`} sub={`${workouts.length - completed.length} skipped`} />
        <StatCard label="Avg readiness" value={avgReadiness > 0 ? String(avgReadiness) : "—"} sub="out of 100" />
        <StatCard label="Streak" value={streak > 0 ? `${streak}d` : "0d"} sub="consecutive days" />
      </div>

      {/* Readiness trend */}
      <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> Readiness trend
        </p>
        <LineChart
          points={trendPoints}
          color="oklch(0.48 0.21 265)"
          min={0}
          max={100}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{trendWorkouts[0] ? new Date(trendWorkouts[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
          <span>avg {avgReadiness}</span>
          <span>{trendWorkouts.at(-1) ? new Date(trendWorkouts.at(-1)!.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
        </div>
      </div>

      {/* Muscle volume */}
      {sortedMuscles.length > 0 && (
        <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> Volume by muscle
            </p>
            <span className="text-xs text-muted-foreground">last 30 days</span>
          </div>
          <div className="space-y-3">
            {sortedMuscles.map(([muscle, sets]) => (
              <HBar key={muscle} label={muscle} value={sets} max={maxMuscleSets} color={muscleColor(muscle)} />
            ))}
          </div>
        </div>
      )}

      {/* Difficulty distribution */}
      {totalDiff > 0 && (
        <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Session difficulty</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "EASY", emoji: "😅", label: "Too easy", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" },
              { key: "RIGHT", emoji: "💯", label: "Just right", color: "text-primary", bg: "bg-primary/8 border-primary/25" },
              { key: "HARD", emoji: "🥵", label: "Too hard", color: "text-red-400", bg: "bg-red-500/10 border-red-500/25" },
            ].map(({ key, emoji, label, color, bg }) => {
              const count = diffCount[key as keyof typeof diffCount];
              const pct = totalDiff > 0 ? Math.round((count / totalDiff) * 100) : 0;
              return (
                <div key={key} className={`rounded-xl border p-3 text-center space-y-1 ${bg}`}>
                  <span className="text-2xl">{emoji}</span>
                  <p className={`text-lg font-black tabular-nums ${color}`}>{pct}%</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{count} sessions</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key lift progression */}
      {topLifts.length > 0 && (
        <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" /> Lift progression
          </p>
          <div className="space-y-3">
            {topLifts.map((lift) => {
              const trending = lift.diff > 0 ? "↑" : lift.diff < 0 ? "↓" : "→";
              const trendColor = lift.diff > 0 ? "text-emerald-400" : lift.diff < 0 ? "text-red-400" : "text-muted-foreground";
              return (
                <div key={lift.name} className="flex items-center justify-between gap-4 rounded-xl bg-secondary/50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{lift.name}</p>
                    <p className="text-xs text-muted-foreground">{lift.sessions} sessions</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black tabular-nums">
                      {lift.first} → {lift.last}
                    </p>
                    <p className={`text-xs font-bold ${trendColor}`}>
                      {trending} {Math.abs(lift.diff) > 0 ? `${Math.abs(lift.diff)}` : "no change"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sleep trend */}
      {sleepLogged >= 3 && (
        <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5 text-primary" /> Sleep trend
          </p>
          <LineChart
            points={sleepPoints}
            color="oklch(0.58 0.20 285)"
            min={4}
            max={10}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{dailyLogs[0] ? new Date(dailyLogs[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
            <span>{sleepLogged} nights logged</span>
            <span>{dailyLogs.at(-1) ? new Date(dailyLogs.at(-1)!.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
          </div>
        </div>
      )}

      {/* Water */}
      {dailyLogs.length > 0 && (
        <div className="rounded-2xl border border-border bg-card card-elevated p-4 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5 text-primary" /> Hydration trend
          </p>
          <LineChart
            points={dailyLogs.map((d, i) => ({ x: i, y: d.waterGlasses }))}
            color="oklch(0.62 0.19 220)"
            min={0}
          />
          <p className="text-xs text-muted-foreground text-center">glasses of water per day</p>
        </div>
      )}

      {workouts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
          <span className="text-5xl">📊</span>
          <p className="text-lg font-bold">No data yet</p>
          <p className="text-sm text-muted-foreground">Complete a few sessions to see your analytics.</p>
        </div>
      )}
    </main>
  );
}
