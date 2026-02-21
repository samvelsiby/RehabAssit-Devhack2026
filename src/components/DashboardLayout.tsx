import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Activity,
  Users,
  BarChart3,
  Dumbbell,
  LogOut,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const physioLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const clientLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/exercises", label: "Exercises", icon: Dumbbell },
  { to: "/session", label: "Start Session", icon: Activity },
  { to: "/progress", label: "Progress", icon: BarChart3 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = user?.role === "physio" ? physioLinks : clientLinks;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col glass-strong border-r border-border/30 p-4">
        <div className="mb-8 px-2">
          <h1 className="font-display text-xl font-bold text-gradient-teal">RehabAssist</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {user?.role === "physio" ? "Physiotherapist" : "Client"} Portal
          </p>
        </div>

        <nav className="flex-1 space-y-1">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <button
                key={link.to}
                onClick={() => navigate(link.to)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary glow-teal"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border/30 pt-4 mt-4">
          <div className="px-3 mb-3">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border/30 px-4 py-3 flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-gradient-teal">RehabAssist</h1>
        <Button variant="ghost" size="sm" onClick={() => { logout(); navigate("/"); }}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-border/30 px-2 py-2 flex justify-around">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <button
              key={link.to}
              onClick={() => navigate(link.to)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs transition-all ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <main className="flex-1 md:p-8 p-4 pt-16 md:pt-8 pb-20 md:pb-8 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
