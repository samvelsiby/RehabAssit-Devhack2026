import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PatientSessionLog {
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

export function usePatientSessionLogs(clientId?: string) {
  return useQuery({
    queryKey: ["patient_session_logs", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("session_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("completed_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as PatientSessionLog[];
    },
    enabled: !!clientId,
  });
}
