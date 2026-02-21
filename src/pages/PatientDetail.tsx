import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, subDays, startOfDay, eachDayOfInterval, differenceInDays } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  Dumbbell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Clock,
  Plus,
} from "lucide-react";
import { useLinkedClients } from "@/hooks/usePhysioLink";
import { useAssignedExercises, useExerciseLibrary, useAssignExercise } from "@/hooks/useExercises";
import { useClientAdherence } from "@/hooks/useClientAdherence";
import { usePatientSessionLogs } from "@/hooks/usePatientSessionLogs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

export default function PatientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { data: clients = [] } = useLinkedClients();
  const client = clients.find((c) => c.id === clientId);
  const { data: adherenceData = [] } = useClientAdherence(clientId ? [clientId] : []);
  const adherence = adherenceData[0];
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignedExercises(clientId);
  const { data: sessionLogs = [], isLoading: logsLoading } = usePatientSessionLogs(clientId);
  const { data: exerciseLibrary = [] } = useExerciseLibrary();
  const assignExercise = useAssignExercise();

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ exercise_id: "", sets: "3", reps: "12" });

  // Determine if client is in first week (grace period)
  const isNewClient = useMemo(() => {
    if (!client?.linkedAt) return true;
    return differenceInDays(new Date(), new Date(client.linkedAt)) < 7;
  }, [client?.linkedAt]);

  // Calendar data: last 28 days
  const calendarData = useMemo(() => {
    const today = startOfDay(new Date());
    const start = subDays(today, 27);
    const days = eachDayOfInterval({ start, end: today });

    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const daySessions = sessionLogs.filter(
        (l) => format(new Date(l.completed_at), "yyyy-MM-dd") === dayStr
      );
      return {
        date: day,
        dateStr: dayStr,
        sessionsCount: daySessions.length,
        totalReps: daySessions.reduce((s, l) => s + l.total_reps, 0),
        correctReps: daySessions.reduce((s, l) => s + l.correct_reps, 0),
        avgScore: daySessions.length > 0
          ? Math.round(daySessions.reduce((s, l) => s + (l.average_form_score || 0), 0) / daySessions.length)
          : null,
      };
    });
  }, [sessionLogs]);

  // Chart data: daily form score over time
  const formScoreChart = useMemo(() => {
    return calendarData
      .filter((d) => d.avgScore !== null)
      .map((d) => ({
        date: format(d.date, "MMM d"),
        score: d.avgScore,
        reps: d.totalReps,
      }));
  }, [calendarData]);

  // Chart data: reps per exercise
  const exerciseBreakdown = useMemo(() => {
    const map: Record<string, { name: string; totalReps: number; correctReps: number }> = {};
    sessionLogs.forEach((log) => {
      const ae = assignments.find((a) => a.id === log.assigned_exercise_id);
      const name = ae?.exercises?.name || "Unknown";
      if (!map[name]) map[name] = { name, totalReps: 0, correctReps: 0 };
      map[name].totalReps += log.total_reps;
      map[name].correctReps += log.correct_reps;
    });
    return Object.values(map);
  }, [sessionLogs, assignments]);

  const handleAssign = async () => {
    if (!clientId || !assignForm.exercise_id) {
      toast.error("Please select an exercise");
      return;
    }
    try {
      await assignExercise.mutateAsync({
        client_id: clientId,
        exercise_id: assignForm.exercise_id,
        sets: parseInt(assignForm.sets) || 3,
        reps: parseInt(assignForm.reps) || 12,
      });
      toast.success("Exercise assigned!");
      setAssignDialogOpen(false);
      setAssignForm({ exercise_id: "", sets: "3", reps: "12" });
    } catch (err: any) {
      toast.error(err.message || "Failed to assign");
    }
  };

  if (!client) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto text-center py-20">
          <p className="text-muted-foreground">Patient not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/patients")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Patients
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/patients")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted-foreground">{client.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {isNewClient && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                New Patient
              </span>
            )}
            {!isNewClient && adherence?.isAtRisk && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> At Risk
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: "Weekly Activity",
              value: adherence ? `${adherence.weeklyCompletionRate}%` : "—",
              icon: Activity,
              color: !adherence || isNewClient ? "text-muted-foreground" : adherence.weeklyCompletionRate < 50 ? "text-destructive" : "text-success",
            },
            {
              label: "Days Active",
              value: adherence ? `${adherence.daysActive}/7` : "—",
              icon: Calendar,
              color: "text-primary",
            },
            {
              label: "Exercises Assigned",
              value: String(assignments.length),
              icon: Dumbbell,
              color: "text-primary",
            },
            {
              label: "Last Active",
              value: adherence?.lastActiveDate
                ? `${adherence.daysSinceLastActive}d ago`
                : "Never",
              icon: Clock,
              color: !isNewClient && adherence && adherence.daysSinceLastActive >= 3 ? "text-destructive" : "text-muted-foreground",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className="font-display text-xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Adherence Calendar (28 days) */}
        <Card className="glass border-border/50 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Activity Calendar (Last 28 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="text-center text-[10px] text-muted-foreground font-medium pb-1">{d}</div>
              ))}
              {calendarData.map((day) => {
                const linkedDate = client.linkedAt ? startOfDay(new Date(client.linkedAt)) : null;
                const isBeforeLinked = linkedDate && day.date < linkedDate;
                return (
                  <div
                    key={day.dateStr}
                    className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-colors ${
                      isBeforeLinked
                        ? "bg-secondary/20 text-muted-foreground/30"
                        : day.sessionsCount > 0
                        ? day.avgScore && day.avgScore >= 70
                          ? "bg-success/20 text-success border border-success/20"
                          : "bg-primary/20 text-primary border border-primary/20"
                        : "bg-secondary/30 text-muted-foreground/50"
                    }`}
                    title={`${format(day.date, "MMM d")} — ${day.sessionsCount} sessions, ${day.totalReps} reps`}
                  >
                    {format(day.date, "d")}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-success/20 border border-success/20" /> Active (good form)</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-primary/20 border border-primary/20" /> Active</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-secondary/30" /> Inactive</span>
            </div>
          </CardContent>
        </Card>

        {/* Charts row */}
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          {/* Form score over time */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Form Score Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {formScoreChart.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={formScoreChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 16% 18%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 16% 18%)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "hsl(180 10% 92%)" }}
                    />
                    <Line type="monotone" dataKey="score" stroke="hsl(174 72% 50%)" strokeWidth={2} dot={{ r: 3 }} name="Form Score" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Not enough data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Exercise breakdown */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-primary" /> Reps by Exercise
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exerciseBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={exerciseBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 16% 18%)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} width={100} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 16% 18%)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="correctReps" fill="hsl(155 72% 45%)" name="Correct" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="totalReps" fill="hsl(174 72% 50% / 0.3)" name="Total" stackId="b" radius={[0, 4, 4, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No session data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Assigned Exercises */}
        <Card className="glass border-border/50 mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-primary" /> Assigned Exercises
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Assign
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No exercises assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">{a.exercises.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.sets} sets × {a.reps} reps · Phase {a.exercises.phase}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Session History */}
        <Card className="glass border-border/50 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : sessionLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No sessions recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sessionLogs.slice(0, 30).map((log) => {
                  const ae = assignments.find((a) => a.id === log.assigned_exercise_id);
                  return (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
                      <div>
                        <p className="text-sm font-medium">{ae?.exercises?.name || "Exercise"}</p>
                        <p className="text-xs text-muted-foreground">
                          Set {log.set_number} · {log.correct_reps}/{log.total_reps} correct
                          {log.average_form_score != null && ` · Form: ${Math.round(log.average_form_score)}%`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{format(new Date(log.completed_at), "MMM d, h:mm a")}</p>
                        {log.correct_reps === log.total_reps ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success ml-auto mt-0.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive/60 ml-auto mt-0.5" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assign dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="glass-strong border-border/50">
            <DialogHeader>
              <DialogTitle className="font-display">Assign Exercise to {client.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Exercise</label>
                <Select value={assignForm.exercise_id} onValueChange={(v) => setAssignForm((f) => ({ ...f, exercise_id: v }))}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select exercise" />
                  </SelectTrigger>
                  <SelectContent>
                    {exerciseLibrary.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>{ex.name} (Phase {ex.phase})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Sets</label>
                  <Input type="number" min="1" max="10" value={assignForm.sets} onChange={(e) => setAssignForm((f) => ({ ...f, sets: e.target.value }))} className="bg-secondary/50" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Reps per set</label>
                  <Input type="number" min="1" max="30" value={assignForm.reps} onChange={(e) => setAssignForm((f) => ({ ...f, reps: e.target.value }))} className="bg-secondary/50" />
                </div>
              </div>
              <Button onClick={handleAssign} disabled={assignExercise.isPending} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                {assignExercise.isPending ? "Assigning..." : "Assign Exercise"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
