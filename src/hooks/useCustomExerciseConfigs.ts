import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CustomExerciseConfig } from "@/types/exercise-customization";

export function useCustomExerciseConfigs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["custom_exercise_configs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("custom_exercise_configs")
        .select("*")
        .eq("created_by", user.id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });
}

export function useCreateCustomExerciseConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Omit<CustomExerciseConfig, 'id' | 'created_by' | 'is_active' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error("Not authenticated");
      if (user.role !== "physio") throw new Error("Only physiotherapists can create custom configurations");

      const { data, error } = await supabase
        .from("custom_exercise_configs")
        .insert({
          exercise_type: config.exercise_type,
          name: config.name,
          description: config.description,
          thresholds: config.thresholds,
          difficulty: config.difficulty,
          adaptations: config.adaptations,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_exercise_configs"] });
    },
  });
}

export function useUpdateCustomExerciseConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<CustomExerciseConfig> }) => {
      const { data, error } = await supabase
        .from("custom_exercise_configs")
        .update({
          ...params.updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_exercise_configs"] });
    },
  });
}

export function useDeleteCustomExerciseConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from("custom_exercise_configs")
        .update({ is_active: false })
        .eq("id", configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_exercise_configs"] });
    },
  });
}

export function useAssignCustomExercise() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      client_id: string;
      custom_config_id: string;
      sets?: number;
      reps?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      if (user.role !== "physio") throw new Error("Only physiotherapists can assign exercises");

      const { error } = await supabase
        .from("assigned_exercises")
        .insert({
          physio_id: user.id,
          client_id: params.client_id,
          custom_config_id: params.custom_config_id,
          sets: params.sets ?? 3,
          reps: params.reps ?? 10,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned_exercises"] });
    },
  });
}

export function useCustomExerciseConfig(configId?: string) {
  return useQuery({
    queryKey: ["custom_exercise_config", configId],
    queryFn: async () => {
      if (!configId) return null;
      
      const { data, error } = await supabase
        .from("custom_exercise_configs")
        .select("*")
        .eq("id", configId)
        .eq("is_active", true)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!configId,
  });
}