import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientAdherence {
  clientId: string;
  totalAssigned: number;
  daysActive: number;
  daysInWeek: number;
  weeklyCompletionRate: number; // 0-100
  missedDays: number;
  isAtRisk: boolean; // true if < 50% or missed 2+ days
  lastActiveDate: string | null;
  daysSinceLastActive: number;
}

export function useClientAdherence(clientIds: string[]) {
  return useQuery({
    queryKey: ["client_adherence", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];

      const now = new Date();
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);

      const results: ClientAdherence[] = [];

      for (const clientId of clientIds) {
        // Get assigned exercises count
        const { data: assignments } = await supabase
          .from("assigned_exercises")
          .select("id")
          .eq("client_id", clientId)
          .eq("active", true);

        const totalAssigned = assignments?.length || 0;

        // Get session logs for the past 7 days
        const { data: logs } = await supabase
          .from("session_logs")
          .select("completed_at")
          .eq("client_id", clientId)
          .gte("completed_at", weekAgo.toISOString())
          .order("completed_at", { ascending: false });

        // Count unique active days
        const activeDays = new Set(
          (logs || []).map((l) => new Date(l.completed_at).toDateString())
        );
        const daysActive = activeDays.size;
        const daysInWeek = 7;
        const missedDays = daysInWeek - daysActive;
        const weeklyCompletionRate = totalAssigned > 0
          ? Math.round((daysActive / daysInWeek) * 100)
          : 0;

        // Last active
        const lastLog = logs && logs.length > 0 ? logs[0].completed_at : null;
        const daysSinceLastActive = lastLog
          ? Math.floor((now.getTime() - new Date(lastLog).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const isAtRisk = weeklyCompletionRate < 50 || missedDays >= 5 || daysSinceLastActive >= 3;
        const isNewClient = false; // will be determined by caller using linkedAt

        results.push({
          clientId,
          totalAssigned,
          daysActive,
          daysInWeek,
          weeklyCompletionRate,
          missedDays,
          isAtRisk,
          lastActiveDate: lastLog,
          daysSinceLastActive,
        });
      }

      return results;
    },
    enabled: clientIds.length > 0,
  });
}
