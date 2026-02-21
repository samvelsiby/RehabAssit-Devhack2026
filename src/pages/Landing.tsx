import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Brain,
  BarChart3,
  Mic,
  Shield,
  Zap,
  ChevronRight,
  Camera,
} from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Real-Time Pose Tracking",
    description: "MediaPipe-powered joint angle analysis with zero wearables required.",
  },
  {
    icon: Mic,
    title: "AI Voice Coaching",
    description: "ElevenLabs voice cues for real-time form correction during exercises.",
  },
  {
    icon: Brain,
    title: "Intelligent Feedback",
    description: "Gemini-powered session analysis with personalized improvement insights.",
  },
  {
    icon: BarChart3,
    title: "Recovery Analytics",
    description: "Track form scores, rep accuracy, and adherence trends over time.",
  },
  {
    icon: Shield,
    title: "Physio Dashboard",
    description: "Remote monitoring with struggle alerts and compliance tracking.",
  },
  {
    icon: Zap,
    title: "Struggle Detection",
    description: "Automated alerts when patient progress plateaus or regresses.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 grid-pattern opacity-30" />

      {/* Glow orbs */}
      <div className="absolute top-[-200px] left-[20%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-[-200px] right-[10%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <Activity className="h-6 w-6 text-primary" />
          <span className="font-display text-xl font-bold text-gradient-teal">
            RehabAssist
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-3"
        >
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/login")}
          >
            Sign In
          </Button>
          <Button
            className="glow-teal bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate("/register")}
          >
            Get Started
          </Button>
        </motion.div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 pt-16 md:pt-28 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border-primary/20 text-primary text-sm mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
            AI-Powered ACL Rehabilitation
          </div>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            Rehab Smarter.
            <br />
            <span className="text-gradient-teal">Recover Faster.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Real-time pose tracking, AI voice coaching, and intelligent recovery
            analytics — all from your webcam. No wearables needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="glow-teal-strong bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8"
              onClick={() => navigate("/register")}
            >
              Start Recovery
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border/60 text-foreground hover:bg-secondary/50 text-base px-8"
              onClick={() => navigate("/login")}
            >
              I&apos;m a Physiotherapist
            </Button>
          </div>
        </motion.div>

        {/* Mock device preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 max-w-4xl mx-auto"
        >
          <div className="glass rounded-2xl glow-teal p-1">
            <div className="bg-background/80 rounded-xl p-6 md:p-10 relative overflow-hidden">
              <div className="grid grid-cols-3 gap-4 md:gap-6">
                {/* Mock rep counter */}
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">REPS</p>
                  <p className="font-display text-3xl font-bold text-primary">8</p>
                  <p className="text-xs text-muted-foreground mt-1">/ 12</p>
                </div>
                {/* Mock form score */}
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">FORM SCORE</p>
                  <p className="font-display text-3xl font-bold text-success">87</p>
                  <p className="text-xs text-muted-foreground mt-1">/ 100</p>
                </div>
                {/* Mock knee angle */}
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">KNEE ANGLE</p>
                  <p className="font-display text-3xl font-bold text-foreground">82°</p>
                  <p className="text-xs text-muted-foreground mt-1">target: 90°</p>
                </div>
              </div>
              <div className="mt-6 h-40 md:h-56 rounded-xl bg-secondary/50 border border-border/30 flex items-center justify-center">
                <div className="text-center">
                  <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Live Camera Feed + Pose Overlay
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Clinical-Grade <span className="text-gradient-teal">Intelligence</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Everything physiotherapists and patients need for effective remote
            ACL rehabilitation.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="glass rounded-xl p-6 hover:glow-teal transition-shadow duration-500 group"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass rounded-2xl glow-teal p-10 md:p-14 text-center"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Recovery?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            Join the platform that brings AI precision to ACL rehabilitation.
            Whether you&apos;re a patient or physiotherapist.
          </p>
          <Button
            size="lg"
            className="glow-teal-strong bg-primary text-primary-foreground hover:bg-primary/90 text-base px-10"
            onClick={() => navigate("/register")}
          >
            Get Started Free
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 px-6 md:px-12 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-display text-sm font-semibold text-gradient-teal">
              RehabAssist
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 RehabAssist. AI-Powered Rehabilitation Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
