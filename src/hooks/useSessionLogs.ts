import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SessionLog {
  id: string;
  client_id: string;
  assigned_exercise_id: string;
  set_number: number;
  total_reps: number;
  correct_reps: number;
  incorrect_reps: number;
  average_form_score: number | null;
  completed_at: string;
}

export function useLogSession() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      assigned_exercise_id: string;
      set_number: number;
      total_reps: number;
      correct_reps: number;
      incorrect_reps: number;
      average_form_score: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("session_logs").insert({
        client_id: user.id,
        ...params,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session_logs"] });
      queryClient.invalidateQueries({ queryKey: ["today_session_logs"] });
      queryClient.invalidateQueries({ queryKey: ["client_adherence"] });
      queryClient.invalidateQueries({ queryKey: ["assigned_exercises"] });
    },
  });
}

// Get today's session logs for a client
export function useTodaySessionLogs(clientId?: string) {
  const { user } = useAuth();
  const id = clientId || user?.id;

  return useQuery({
    queryKey: ["today_session_logs", id],
    queryFn: async () => {
      if (!id) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("session_logs")
        .select("*")
        .eq("client_id", id)
        .gte("completed_at", today.toISOString())
        .order("completed_at", { ascending: true });

      if (error) throw error;
      return data as SessionLog[];
    },
    enabled: !!id,
  });
}

// Get all session logs for a client (for progress page)
export function useAllSessionLogs(clientId?: string) {
  const { user } = useAuth();
  const id = clientId || user?.id;

  return useQuery({
    queryKey: ["session_logs", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("session_logs")
        .select("*, assigned_exercises(*, exercises(*))")
        .eq("client_id", id)
        .order("completed_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
