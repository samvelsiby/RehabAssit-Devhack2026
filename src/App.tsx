import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PhysioDashboard from "./pages/PhysioDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import ExerciseSession from "./pages/ExerciseSession";
import Progress from "./pages/Progress";
import PatientDetail from "./pages/PatientDetail";
import ExerciseDesignerPage from "./pages/ExerciseDesignerPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return user.role === "physio" ? <PhysioDashboard /> : <ClientDashboard />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
            <Route path="/session" element={<ProtectedRoute><ExerciseSession /></ProtectedRoute>} />
            <Route path="/exercises" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
            <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute><PhysioDashboard /></ProtectedRoute>} />
            <Route path="/patients/:clientId" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
            <Route path="/exercise-designer" element={<ProtectedRoute><ExerciseDesignerPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
