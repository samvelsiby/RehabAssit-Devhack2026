import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ExerciseMode = 'squat' | 'hamstring_curl' | 'heel_raise';

export interface ExerciseRules {
  targetSets: number;
  minRepsPerSet: number;
  maxRepsPerSet: number;
  restBetweenSets: number; // seconds
  formThreshold: number;   // % accuracy required
}

export interface Exercise {
  id: ExerciseMode;         // the mediapipe key used in code
  dbId: string;             // the actual UUID in the exercises table
  name: string;
  description: string;
  phase: number;
  rules: ExerciseRules;
}

export interface AssignedExercise {
  id: string;
  exercise_id: string;      // UUID from DB
  client_id: string;
  physio_id: string;
  sets: number;
  reps: number;
  active: boolean;
  assigned_at: string;
  exercises: Exercise;      // joined + enriched with rules
}

// ─── Static library (source of truth for rules & mode keys) ──────────────────
// `dbId` starts empty and is filled from the DB lookup in `useExerciseLibrary`.
// At runtime we always rely on name matching to bridge UUID ↔ mode.
export const MEDIAPIPE_EXERCISES: Omit<Exercise, 'dbId'>[] = [
  {
    id: 'squat',
    name: 'Squat Analysis',
    description: 'Real-time squat form analysis with MediaPipe pose detection',
    phase: 1,
    rules: {
      targetSets: 3, minRepsPerSet: 8, maxRepsPerSet: 15,
      restBetweenSets: 60, formThreshold: 70,
    },
  },
  {
    id: 'hamstring_curl',
    name: 'Standing Hamstring Curl',
    description: 'Standing hamstring curl with form analysis via MediaPipe',
    phase: 2,
    rules: {
      targetSets: 3, minRepsPerSet: 10, maxRepsPerSet: 20,
      restBetweenSets: 45, formThreshold: 75,
    },
  },
  {
    id: 'heel_raise',
    name: 'Heel Raise',
    description: 'Calf raise exercise with height and balance analysis',
    phase: 1,
    rules: {
      targetSets: 3, minRepsPerSet: 12, maxRepsPerSet: 25,
      restBetweenSets: 30, formThreshold: 80,
    },
  },
];

/** Map a DB exercise name to our ExerciseMode key */
function nameToMode(name: string): ExerciseMode | undefined {
  const n = name.toLowerCase();
  if (n.includes('squat') && !n.includes('hamstring')) return 'squat';
  if (n.includes('hamstring') || n.includes('curl')) return 'hamstring_curl';
  if (n.includes('heel') || n.includes('raise')) return 'heel_raise';
  return undefined;
}

/** Build a full Exercise object by merging DB row + static rules */
function enrichExercise(dbRow: { id: string; name: string; description?: string | null; phase?: number | null }): Exercise | undefined {
  const mode = nameToMode(dbRow.name);
  if (!mode) return undefined;
  const base = MEDIAPIPE_EXERCISES.find(e => e.id === mode);
  if (!base) return undefined;
  return {
    ...base,
    dbId: dbRow.id,
    name: dbRow.name,
    description: dbRow.description ?? base.description,
    phase: dbRow.phase ?? base.phase,
  };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Returns the 3 MediaPipe exercises, joined with DB UUIDs */
export function useExerciseLibrary() {
  return useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("*");
      if (error) throw error;

      // Map DB rows → enriched exercises; filter to only MediaPipe ones
      const enriched = (data ?? [])
        .map(enrichExercise)
        .filter((e): e is Exercise => !!e);

      // If the DB is empty, fall back to display-only (no dbId) so the UI still renders
      if (enriched.length === 0) {
        return MEDIAPIPE_EXERCISES.map(e => ({ ...e, dbId: '' })) as Exercise[];
      }
      return enriched;
    },
  });
}

/** Physio assigns one of the 3 exercises to a client.
 *  Looks up the exercise UUID in the DB by name first. */
export function useAssignExercise() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      client_id: string;
      exercise_id: ExerciseMode;   // the mode key, e.g. 'squat'
      sets?: number;
      reps?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const base = MEDIAPIPE_EXERCISES.find(e => e.id === params.exercise_id);
      if (!base) throw new Error("Unknown exercise");

      // Resolve UUID from DB (or insert if missing)
      const { data: existing } = await supabase
        .from("exercises")
        .select("id")
        .eq("name", base.name)
        .maybeSingle();

      let dbExerciseId: string;
      if (existing?.id) {
        dbExerciseId = existing.id;
      } else {
        // Insert the exercise row so it exists
        const { data: inserted, error: ins } = await supabase
          .from("exercises")
          .insert({ name: base.name, description: base.description, phase: base.phase })
          .select("id")
          .single();
        if (ins) throw ins;
        dbExerciseId = inserted.id;
      }

      const { error } = await supabase.from("assigned_exercises").insert({
        physio_id: user.id,
        client_id: params.client_id,
        exercise_id: dbExerciseId,
        sets: params.sets ?? base.rules.targetSets,
        reps: params.reps ?? base.rules.minRepsPerSet,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned_exercises"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

/** Returns assignments for a client, each with the enriched Exercise object */
export function useAssignedExercises(clientId?: string) {
  const { user } = useAuth();
  const id = clientId || user?.id;

  return useQuery({
    queryKey: ["assigned_exercises", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("assigned_exercises")
        .select("*, exercises(*)")             // JOIN the exercises table
        .eq("client_id", id)
        .eq("active", true)
        .order("assigned_at", { ascending: false });
      if (error) throw error;

      const FALLBACK: Exercise = {
        id: 'squat', dbId: '', name: 'Unknown Exercise',
        description: '', phase: 1,
        rules: { targetSets: 3, minRepsPerSet: 10, maxRepsPerSet: 15, restBetweenSets: 60, formThreshold: 70 },
      };

      return (data ?? []).map(row => {
        const ex = row.exercises ? enrichExercise(row.exercises as any) : undefined;
        return {
          ...row,
          // Provide the ExerciseMode key as `exercise_id` so session page can use it
          exercise_id: (ex?.id ?? 'squat') as ExerciseMode,
          exercises: ex ?? FALLBACK,
        } as AssignedExercise;
      }).filter(a => a.exercises.name !== 'Unknown Exercise');
    },
    enabled: !!id,
  });
}

/** Deactivate an assignment */
export function useRemoveAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("assigned_exercises")
        .update({ active: false })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned_exercises"] });
    },
  });
}

/** Get static rules by ExerciseMode key */
export function getExerciseRules(id: ExerciseMode): ExerciseRules {
  return MEDIAPIPE_EXERCISES.find(e => e.id === id)?.rules ?? {
    targetSets: 3, minRepsPerSet: 10, maxRepsPerSet: 15, restBetweenSets: 60, formThreshold: 70,
  };
}

export function getExerciseById(id: ExerciseMode): Omit<Exercise, 'dbId'> | undefined {
  return MEDIAPIPE_EXERCISES.find(e => e.id === id);
}
