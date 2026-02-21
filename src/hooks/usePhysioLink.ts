import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Generate or fetch physio's consultation code
export function useConsultationCode() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["consultation_code", user?.id],
    queryFn: async () => {
      if (!user) return null;
      // Check if code already exists
      const { data } = await supabase
        .from("users")
        .select("consultation_code")
        .eq("id", user.id)
        .single();

      if (data?.consultation_code) return data.consultation_code;

      // Generate and save new code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await supabase
        .from("users")
        .update({ consultation_code: code })
        .eq("id", user.id);

      return code;
    },
    enabled: !!user && user.role === "physio",
  });

  return query;
}

// Client links to physio via consultation code
export function useLinkToPhysio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error("Not authenticated");

      // Find physio by consultation code
      const { data: physio, error: findErr } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .eq("consultation_code", code.toUpperCase())
        .eq("role", "physio")
        .single();

      if (findErr || !physio) throw new Error("Invalid consultation code");

      // Create link
      const { error } = await supabase.from("physio_clients").insert({
        physio_id: physio.id,
        client_id: user.id,
      });

      if (error) {
        if (error.code === "23505") throw new Error("Already linked to this physiotherapist");
        throw new Error(error.message);
      }

      return physio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_physio"] });
      queryClient.invalidateQueries({ queryKey: ["linked_clients"] });
    },
  });
}

// Client: get my linked physio
export function useMyPhysio() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my_physio", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("physio_clients")
        .select("physio_id, users!physio_clients_physio_id_fkey(first_name, last_name)")
        .eq("client_id", user.id)
        .maybeSingle();

      if (error || !data) return null;
      const p = data.users as any;
      return {
        id: data.physio_id,
        name: [p?.first_name, p?.last_name].filter(Boolean).join(" "),
      };
    },
    enabled: !!user && user.role === "client",
  });
}

// Physio: get linked clients
export function useLinkedClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["linked_clients", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("physio_clients")
        .select("client_id, linked_at, users!physio_clients_client_id_fkey(id, first_name, last_name, email)")
        .eq("physio_id", user.id);

      if (error) throw new Error(error.message);
      return (data || []).map((row) => {
        const c = row.users as any;
        return {
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email,
          email: c.email,
          linkedAt: row.linked_at,
        };
      });
    },
    enabled: !!user && user.role === "physio",
  });
}
