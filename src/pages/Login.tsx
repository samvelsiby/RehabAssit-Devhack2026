import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, ArrowLeft } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute top-[-200px] left-[30%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 text-muted-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div className="glass rounded-2xl p-8 glow-teal">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold text-gradient-teal">RehabAssist</span>
          </div>

          <h2 className="font-display text-2xl font-bold mb-1">Welcome back</h2>
          <p className="text-sm text-muted-foreground mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 bg-secondary/50 border-border/50"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 bg-secondary/50 border-border/50"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-teal"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
