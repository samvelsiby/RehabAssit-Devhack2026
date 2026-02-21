import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

export type UserRole = "physio" | "client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  linkedCode?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

async function fetchUserProfile(supabaseUser: SupabaseUser): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", supabaseUser.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    name: [data.first_name, data.last_name].filter(Boolean).join(" ") || data.email,
    role: data.role as UserRole,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid potential deadlocks with Supabase client
          setTimeout(async () => {
            const profile = await fetchUserProfile(session.user);
            setUser(profile);
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const register = async (name: string, email: string, password: string, role: UserRole) => {
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || null;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Registration failed");

    // Upsert into users table (handles case where a DB trigger already created the row)
    const { error: profileError } = await supabase.from("users").upsert({
      id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
    }, { onConflict: "id" });

    if (profileError) throw new Error(profileError.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
