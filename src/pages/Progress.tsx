import { useMemo } from "react";
import { motion } from "framer-motion";
import { format, subDays, startOfDay } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { useAllSessionLogs } from "@/hooks/useSessionLogs";
import { Activity, TrendingUp, CheckCircle2, Target } from "lucide-react";

const CHART_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(220 18% 10%)",
    border: "1px solid hsl(220 16% 18%)",
    borderRadius: "8px",
    color: "hsl(180 10% 92%)",
    fontSize: 12,
  },
};

export default function Progress() {
  const { data: allLogs = [], isLoading } = useAllSessionLogs();

  // Build last-7-days series
  const last7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(new Date(), 6 - i);
      const label = format(day, "EEE");
      const dayStr = startOfDay(day).toDateString();

      const dayLogs = allLogs.filter(
        (l) => new Date(l.completed_at).toDateString() === dayStr
      );

      const totalCorrect = dayLogs.reduce((a, l) => a + l.correct_reps, 0);
      const totalIncorrect = dayLogs.reduce((a, l) => a + l.incorrect_reps, 0);
      const totalReps = totalCorrect + totalIncorrect;
      const avgScore = dayLogs.length > 0
        ? Math.round(dayLogs.reduce((a, l) => a + (l.average_form_score ?? 0), 0) / dayLogs.length)
        : null;

      return { day: label, correct: totalCorrect, incorrect: totalIncorrect, score: avgScore, totalReps };
    });
  }, [allLogs]);

  // Overall stats
  const totalSessions = allLogs.length;
  const totalCorrect = allLogs.reduce((a, l) => a + l.correct_reps, 0);
  const totalIncorrect = allLogs.reduce((a, l) => a + l.incorrect_reps, 0);
  const totalReps = totalCorrect + totalIncorrect;
  const accuracy = totalReps > 0 ? Math.round((totalCorrect / totalReps) * 100) : 0;
  const avgFormScore = allLogs.length > 0
    ? Math.round(allLogs.reduce((a, l) => a + (l.average_form_score ?? 0), 0) / allLogs.length)
    : 0;

  // Form trend (only days that have data)
  const formTrend = last7.filter(d => d.score !== null);

  // Exercise breakdown
  const byExercise = useMemo(() => {
    const map: Record<string, { correct: number; incorrect: number; sets: number }> = {};
    allLogs.forEach((l) => {
      const name = (l as any).assigned_exercises?.exercises?.name ?? "Unknown";
      if (!map[name]) map[name] = { correct: 0, incorrect: 0, sets: 0 };
      map[name].correct += l.correct_reps;
      map[name].incorrect += l.incorrect_reps;
      map[name].sets += 1;
    });
    return Object.entries(map).map(([name, v]) => ({
      name: name.replace("Analysis", "").replace("Standing ", "").trim(),
      ...v,
      accuracy: v.correct + v.incorrect > 0
        ? Math.round((v.correct / (v.correct + v.incorrect)) * 100)
        : 100,
    }));
  }, [allLogs]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-2">
          Your <span className="text-gradient-teal">Progress</span>
        </h1>
        <p className="text-muted-foreground mb-8">Live data from your Supabase session logs</p>

        {/* ── Summary stats ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Sets", value: String(totalSessions), icon: Activity, color: "text-primary" },
            { label: "Total Reps", value: String(totalReps), icon: Target, color: "text-warning" },
            { label: "Avg Form", value: avgFormScore ? `${avgFormScore}%` : "—", icon: TrendingUp, color: "text-success" },
            { label: "Rep Accuracy", value: totalReps > 0 ? `${accuracy}%` : "—", icon: CheckCircle2, color: "text-success" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className={`font-display text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* ── Form score trend ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-6"
          >
            <h3 className="font-display font-semibold mb-4">Form Score — Last 7 Days</h3>
            {formTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No sessions recorded yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={formTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 16% 18%)" />
                  <XAxis dataKey="day" stroke="hsl(220 10% 55%)" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="hsl(220 10% 55%)" fontSize={12} unit="%" />
                  <Tooltip {...CHART_STYLE} formatter={(v: number) => [`${v}%`, "Form Score"]} />
                  <Line
                    type="monotone" dataKey="score"
                    stroke="hsl(174 72% 50%)" strokeWidth={2}
                    dot={{ fill: "hsl(174 72% 50%)", r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* ── Rep accuracy per day ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6"
          >
            <h3 className="font-display font-semibold mb-4">Rep Accuracy — Last 7 Days</h3>
            {totalReps === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No sessions recorded yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 16% 18%)" />
                  <XAxis dataKey="day" stroke="hsl(220 10% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(220 10% 55%)" fontSize={12} />
                  <Tooltip {...CHART_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "hsl(220 10% 55%)" }} />
                  <Bar dataKey="correct" stackId="a" fill="hsl(155 72% 45%)" name="Correct" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="incorrect" stackId="a" fill="hsl(0 72% 55%)" name="Incorrect" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* ── By exercise ──────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <h3 className="font-display font-semibold mb-4">By Exercise</h3>
            {byExercise.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No data yet</p>
            ) : (
              <div className="space-y-4">
                {byExercise.map((ex) => (
                  <div key={ex.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{ex.name}</span>
                      <span className="font-semibold text-primary">{ex.accuracy}% accuracy</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${ex.accuracy}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ex.sets} sets · {ex.correct + ex.incorrect} total reps · {ex.correct} correct
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Weekly summary ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-6"
          >
            <h3 className="font-display font-semibold mb-4">Weekly Summary</h3>
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 mb-4">
              {totalReps === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Complete your first session to see your summary here.
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This week you completed{" "}
                  <span className="text-foreground font-medium">{totalSessions} sets</span> with{" "}
                  <span className={accuracy >= 80 ? "text-success font-medium" : "text-warning font-medium"}>
                    {accuracy}% rep accuracy
                  </span>.{" "}
                  {accuracy >= 90
                    ? "Excellent form! Keep maintaining this consistency."
                    : accuracy >= 75
                      ? "Good progress. Focus on slowing down each rep for better accuracy."
                      : "Keep practising. Focus on form over speed — quality reps matter more."}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Sets Done</p>
                <p className="font-display text-xl font-bold text-primary">{totalSessions}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Total Reps</p>
                <p className="font-display text-xl font-bold">{totalReps}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Accuracy</p>
                <p className={`font-display text-xl font-bold ${accuracy >= 80 ? "text-success" : "text-warning"}`}>
                  {totalReps > 0 ? `${accuracy}%` : "—"}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
