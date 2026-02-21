import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Copy,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Plus,
  Dumbbell,
  Bell,
  CalendarX,
  TrendingDown,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useConsultationCode, useLinkedClients } from "@/hooks/usePhysioLink";
import { useExerciseLibrary, useAssignExercise, useAssignedExercises } from "@/hooks/useExercises";
import { useCustomExerciseConfigs } from "@/hooks/useCustomExerciseConfigs";
import { useClientAdherence, type ClientAdherence } from "@/hooks/useClientAdherence";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PhysioDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: consultCode } = useConsultationCode();
  const { data: clients = [], isLoading: clientsLoading } = useLinkedClients();
  const { data: exerciseLibrary = [] } = useExerciseLibrary();
  const { data: customConfigs = [] } = useCustomExerciseConfigs();

  const clientIds = clients.map((c) => c.id);
  const { data: adherenceData = [] } = useClientAdherence(clientIds);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ exercise_id: "", sets: "3", reps: "12" });

  const assignExercise = useAssignExercise();

  // Filter out new clients (< 7 days) from at-risk count
  const atRiskData = useMemo(() => {
    return adherenceData.filter((a) => {
      const client = clients.find((c) => c.id === a.clientId);
      if (!client?.linkedAt) return false;
      const daysSinceLinked = differenceInDays(new Date(), new Date(client.linkedAt));
      return daysSinceLinked >= 7 && a.isAtRisk;
    });
  }, [adherenceData, clients]);

  const atRiskCount = atRiskData.length;

  const copyCode = () => {
    if (!consultCode) return;
    navigator.clipboard.writeText(consultCode);
    toast.success("Consultation code copied!");
  };

  const handleAssign = async () => {
    if (!selectedClientId || !assignForm.exercise_id) {
      toast.error("Please select an exercise");
      return;
    }
    try {
      await assignExercise.mutateAsync({
        client_id: selectedClientId,
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

  const getAdherence = (clientId: string) =>
    adherenceData.find((a) => a.clientId === clientId);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">
              Welcome, <span className="text-gradient-teal">{user?.name?.split(" ")[0]}</span>
            </h1>
            <p className="text-muted-foreground mt-1">Monitor your patients' recovery progress</p>
          </div>
          <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Consultation Code</span>
            <span className="font-display font-bold text-primary tracking-wider">
              {consultCode || "..."}
            </span>
            <Button variant="ghost" size="sm" onClick={copyCode}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Active Patients", value: String(clients.length), icon: Users, color: "text-primary" },
            { label: "At Risk", value: String(atRiskCount), icon: AlertTriangle, color: atRiskCount > 0 ? "text-destructive" : "text-success" },
            { label: "Exercises", value: String(exerciseLibrary.length), icon: Dumbbell, color: "text-success" },
            { label: "Library Phases", value: "4", icon: BarChart3, color: "text-primary" },
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

        {/* Alerts banner */}
        {atRiskCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-5 mb-6 border border-destructive/30 bg-destructive/5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Bell className="h-5 w-5 text-destructive" />
              <h3 className="font-display font-semibold text-sm">
                {atRiskCount} Patient{atRiskCount > 1 ? "s" : ""} Need{atRiskCount === 1 ? "s" : ""} Attention
              </h3>
            </div>
            <div className="space-y-2">
              {atRiskData
                .map((a) => {
                  const client = clients.find((c) => c.id === a.clientId);
                  if (!client) return null;
                  return (
                    <div key={a.clientId} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.weeklyCompletionRate < 50 && (
                              <span>Weekly activity: {a.weeklyCompletionRate}% · </span>
                            )}
                            {a.daysSinceLastActive >= 3 && (
                              <span>Inactive for {a.daysSinceLastActive} days · </span>
                            )}
                            {a.missedDays >= 5 && (
                              <span>{a.missedDays} days missed this week</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-destructive">
                        {a.daysActive}/{a.daysInWeek} days
                      </span>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* Patients list */}
        <div className="glass rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">Patients</h2>
          </div>

          {clientsLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : clients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No patients linked yet. Share your consultation code with your clients.
            </p>
          ) : (
            <div className="space-y-3">
              {clients.map((client, i) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  adherence={getAdherence(client.id)}
                  index={i}
                  isSelected={selectedClientId === client.id}
                  onSelect={() => navigate(`/patients/${client.id}`)}
                  onAssign={() => {
                    setSelectedClientId(client.id);
                    setAssignDialogOpen(true);
                  }}
                  isNewClient={!client.linkedAt || differenceInDays(new Date(), new Date(client.linkedAt)) < 7}
                />
              ))}
            </div>
          )}
        </div>

        {/* Selected client's assigned exercises */}
        {selectedClientId && (
          <ClientAssignments
            clientId={selectedClientId}
            clientName={clients.find((c) => c.id === selectedClientId)?.name || ""}
            onAssign={() => setAssignDialogOpen(true)}
          />
        )}

        {/* Exercise Library */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">Exercise Library</h2>
            <Button
              variant="outline"
              onClick={() => navigate('/exercise-designer')}
              className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
            >
              <Plus className="h-4 w-4 mr-1" />
              Design Exercise
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {exerciseLibrary.map((ex) => (
              <div key={ex.id} className="p-4 rounded-xl bg-secondary/30">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{ex.name}</p>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Phase {ex.phase}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{ex.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Exercise Configurations */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">Custom Exercise Configurations</h2>
            <Button
              variant="outline"
              onClick={() => navigate('/exercise-designer')}
              className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Configuration
            </Button>
          </div>
          
          {customConfigs.length > 0 ? (
            <div className="grid gap-3">
              {customConfigs.map((config) => (
                <div key={config.id} className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{config.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {config.exercise_type} • {config.difficulty}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/exercise-designer?type=${config.exercise_type}`)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                  {config.description && (
                    <p className="text-xs text-muted-foreground mt-2">{config.description}</p>
                  )}
                  {config.adaptations && config.adaptations.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Adaptations:</p>
                      <div className="flex flex-wrap gap-1">
                        {config.adaptations.map((adaptation, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {adaptation}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No custom configurations yet. Create your first one using the Exercise Designer.
              </p>
            </div>
          )}
        </div>

        {/* Assign exercise dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="glass-strong border-border/50">
            <DialogHeader>
              <DialogTitle className="font-display">
                Assign Exercise to {clients.find((c) => c.id === selectedClientId)?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Exercise</label>
                <Select
                  value={assignForm.exercise_id}
                  onValueChange={(v) => setAssignForm((f) => ({ ...f, exercise_id: v }))}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select exercise" />
                  </SelectTrigger>
                  <SelectContent>
                    {exerciseLibrary.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name} (Phase {ex.phase})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Sets</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={assignForm.sets}
                    onChange={(e) => setAssignForm((f) => ({ ...f, sets: e.target.value }))}
                    className="bg-secondary/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Reps per set</label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={assignForm.reps}
                    onChange={(e) => setAssignForm((f) => ({ ...f, reps: e.target.value }))}
                    className="bg-secondary/50"
                  />
                </div>
              </div>
              <Button
                onClick={handleAssign}
                disabled={assignExercise.isPending}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {assignExercise.isPending ? "Assigning..." : "Assign Exercise"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Sub-components

function ClientRow({
  client,
  adherence,
  index,
  isSelected,
  onSelect,
  onAssign,
  isNewClient = false,
}: {
  client: { id: string; name: string; email: string };
  adherence?: ClientAdherence;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onAssign: () => void;
  isNewClient?: boolean;
}) {
  const showAtRisk = !isNewClient && adherence?.isAtRisk;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`flex items-center justify-between p-4 rounded-xl transition-colors cursor-pointer ${
        showAtRisk
          ? "bg-destructive/5 border border-destructive/20 hover:bg-destructive/10"
          : isSelected
          ? "bg-primary/10 border border-primary/20"
          : "bg-secondary/30 hover:bg-secondary/50"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-4">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
          showAtRisk ? "bg-destructive/10" : "bg-primary/10"
        }`}>
          <span className={`font-display font-semibold text-sm ${
            showAtRisk ? "text-destructive" : "text-primary"
          }`}>
            {client.name.split(" ").map((n) => n[0]).join("")}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{client.name}</p>
            {isNewClient && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
            )}
            {showAtRisk && (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {adherence ? (
              <>
                <span className={adherence.weeklyCompletionRate < 50 ? "text-destructive" : "text-success"}>
                  {adherence.weeklyCompletionRate}% weekly
                </span>
                {" · "}
                {adherence.daysActive}/{adherence.daysInWeek} days active
                {adherence.daysSinceLastActive > 0 && adherence.daysSinceLastActive < 999 && (
                  <span className={adherence.daysSinceLastActive >= 3 ? "text-destructive" : ""}>
                    {" · "}Last active {adherence.daysSinceLastActive}d ago
                  </span>
                )}
                {adherence.daysSinceLastActive >= 999 && " · Never exercised"}
              </>
            ) : (
              client.email
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {adherence && (
          <div className="hidden sm:flex items-center gap-1 mr-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 w-1.5 rounded-sm ${
                    i < adherence.daysActive ? "bg-success" : "bg-secondary"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onAssign(); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Assign
        </Button>
      </div>
    </motion.div>
  );
}

function ClientAssignments({
  clientId,
  clientName,
  onAssign,
}: {
  clientId: string;
  clientName: string;
  onAssign: () => void;
}) {
  const { data: assignments = [], isLoading } = useAssignedExercises(clientId);

  return (
    <div className="glass rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold">
          {clientName}'s Assigned Exercises
        </h2>
        <Button variant="outline" size="sm" onClick={onAssign}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No exercises assigned yet.
        </p>
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
    </div>
  );
}
