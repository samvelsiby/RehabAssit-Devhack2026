import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Flame,
  Target,
  TrendingUp,
  Play,
  CheckCircle2,
  Circle,
  UserCheck,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useMyPhysio, useLinkToPhysio } from "@/hooks/usePhysioLink";
import { useAssignedExercises } from "@/hooks/useExercises";
import { useTodaySessionLogs } from "@/hooks/useSessionLogs";

export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultCode, setConsultCode] = useState("");

  const { data: myPhysio, isLoading: physioLoading } = useMyPhysio();
  const linkMutation = useLinkToPhysio();
  const { data: assignedExercises = [] } = useAssignedExercises();
  const { data: todayLogs = [] } = useTodaySessionLogs();

  const linkPhysio = async () => {
    if (consultCode.length < 4) {
      toast.error("Please enter a valid consultation code");
      return;
    }
    try {
      await linkMutation.mutateAsync(consultCode);
      toast.success("Linked to physiotherapist!");
      setConsultCode("");
    } catch (err: unknown) {
      toast.error(err.message || "Failed to link");
    }
  };

  // Determine which exercises are completed today
  const completedAssignmentIds = new Set(
    todayLogs.map((log) => log.assigned_exercise_id)
  );

  // Group logs by assignment to count sets done
  const setsDoneMap: Record<string, number> = {};
  todayLogs.forEach((log) => {
    setsDoneMap[log.assigned_exercise_id] = (setsDoneMap[log.assigned_exercise_id] || 0) + 1;
  });

  const exercisesWithStatus = assignedExercises.map((ae) => {
    const setsDone = setsDoneMap[ae.id] || 0;
    const completed = setsDone >= ae.sets;
    // Get avg form score from today's logs for this exercise
    const logs = todayLogs.filter((l) => l.assigned_exercise_id === ae.id);
    const avgScore = logs.length > 0
      ? Math.round(logs.reduce((a, l) => a + (l.average_form_score || 0), 0) / logs.length)
      : null;
    return { ...ae, completed, setsDone, avgScore };
  });

  const completedCount = exercisesWithStatus.filter((e) => e.completed).length;
  const totalCount = exercisesWithStatus.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const totalCorrect = todayLogs.reduce((a, l) => a + l.correct_reps, 0);
  const totalReps = todayLogs.reduce((a, l) => a + l.total_reps, 0);
  const avgFormScore = todayLogs.length > 0
    ? Math.round(todayLogs.reduce((a, l) => a + (l.average_form_score || 0), 0) / todayLogs.length)
    : 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">
            Hey, <span className="text-gradient-teal">{user?.name?.split(" ")[0]}</span> 👋
          </h1>
          <p className="text-muted-foreground mt-1">Let&apos;s keep your recovery on track</p>
        </div>

        {/* Linked physio or link form */}
        {!physioLoading && !myPhysio ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-5 mb-6 border-primary/20"
          >
            <p className="text-sm font-medium mb-2">Link to your Physiotherapist</p>
            <div className="flex gap-2">
              <Input
                value={consultCode}
                onChange={(e) => setConsultCode(e.target.value.toUpperCase())}
                placeholder="Enter consultation code"
                className="bg-secondary/50 border-border/50 uppercase tracking-wider"
                maxLength={8}
              />
              <Button
                onClick={linkPhysio}
                disabled={linkMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {linkMutation.isPending ? "Linking..." : "Link"}
              </Button>
            </div>
          </motion.div>
        ) : myPhysio ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-4 mb-6 flex items-center gap-3 border-success/20"
          >
            <UserCheck className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium">Your Physiotherapist</p>
              <p className="text-xs text-muted-foreground">{myPhysio.name}</p>
            </div>
          </motion.div>
        ) : null}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Today's Sessions", value: String(todayLogs.length), icon: Flame, color: "text-warning" },
            { label: "Today's Progress", value: `${progress}%`, icon: Target, color: "text-primary" },
            { label: "Avg Form Score", value: avgFormScore ? String(avgFormScore) : "—", icon: TrendingUp, color: "text-success" },
            { label: "Rep Accuracy", value: totalReps > 0 ? `${Math.round((totalCorrect / totalReps) * 100)}%` : "—", icon: Activity, color: "text-primary" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="font-display text-2xl font-bold">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Today's exercises */}
        <div className="glass rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">Today&apos;s Exercises</h2>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalCount} completed
            </span>
          </div>

          {exercisesWithStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {myPhysio ? "No exercises assigned yet. Your physio will assign exercises for you." : "Link to your physiotherapist to see your exercises."}
            </p>
          ) : (
            <div className="space-y-3">
              {exercisesWithStatus.map((ex, i) => (
                <motion.div
                  key={ex.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`flex items-center justify-between p-4 rounded-xl transition-colors ${ex.completed
                      ? "bg-success/5 border border-success/20"
                      : "bg-secondary/30 hover:bg-secondary/50 cursor-pointer"
                    }`}
                  onClick={() => !ex.completed && navigate(`/session?assignmentId=${ex.id}`)}
                >
                  <div className="flex items-center gap-3">
                    {ex.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{ex.exercises.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ex.sets} sets × {ex.reps} reps
                        {ex.setsDone > 0 && !ex.completed && ` · ${ex.setsDone}/${ex.sets} sets done`}
                      </p>
                    </div>
                  </div>
                  {ex.completed && ex.avgScore ? (
                    <span className="text-sm font-semibold text-success">{ex.avgScore}%</span>
                  ) : (
                    <Play className="h-4 w-4 text-primary" />
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Quick start */}
        {exercisesWithStatus.length > 0 && (
          <Button
            size="lg"
            className="w-full glow-teal-strong bg-primary text-primary-foreground hover:bg-primary/90 font-display"
            onClick={() => {
              const next = exercisesWithStatus.find((e) => !e.completed);
              if (next) navigate(`/session?assignmentId=${next.id}`);
              else toast.info("All exercises completed for today!");
            }}
          >
            <Play className="h-5 w-5 mr-2" />
            Start Next Exercise
          </Button>
        )}
      </div>
    </DashboardLayout>
  );
}
