import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Camera, CameraOff, Activity, Volume2, VolumeX,
  CheckCircle2, Timer, Dumbbell, Sparkles,
} from 'lucide-react';
import { useAssignedExercises, getExerciseRules, type ExerciseMode } from '@/hooks/useExercises';
import { useLogSession, useTodaySessionLogs } from '@/hooks/useSessionLogs';
import { useExerciseSession } from '@/hooks/useExerciseSession';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { useGeminiCoach } from '@/hooks/useGeminiCoach';
import type { Side } from '@/services/exercises/mini-squat-analyzer';
import { toast } from '@/components/ui/sonner';
import type { AnalyzerResult, Point } from '@/utils/exercise-geometry';

// ─── Demo canvas animation (stick figure) ────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function squatPhase(timeSec: number): number {
  const cycle = 2.8;
  const u = (timeSec % cycle) / cycle;
  if (u < 0.15) return 0;
  if (u < 0.55) {
    const t = (u - 0.15) / (0.55 - 0.15);
    return smoothstep(t);
  }
  if (u < 0.7) return 1;
  const t = (u - 0.7) / (1.0 - 0.7);
  return 1 - smoothstep(t);
}

function drawSegment(ctx: CanvasRenderingContext2D, p1: Point, p2: Point): void {
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function drawJoint(ctx: CanvasRenderingContext2D, point: Point, r = 4): void {
  ctx.beginPath();
  ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTextPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg: string,
  fg: string
) {
  ctx.font = "13px ui-monospace, Menlo, Consolas, monospace";
  const padX = 10;
  const padY = 6;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 20 + padY;

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y - 16, w, h, 10);
  ctx.fill();

  ctx.fillStyle = fg;
  ctx.fillText(text, x + padX, y);
}

function buildJoints(mode: ExerciseMode, t: number) {
  const ease = (x: number) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const e = ease(t);
  const cx = 160; // canvas center-x

  const j: Record<string, { x: number; y: number }> = {
    head: { x: cx, y: 20 }, lSh: { x: cx - 20, y: 48 }, rSh: { x: cx + 20, y: 48 },
    lElb: { x: cx - 27, y: 82 }, rElb: { x: cx + 27, y: 82 },
    lWri: { x: cx - 22, y: 115 }, rWri: { x: cx + 22, y: 115 },
    lHip: { x: cx - 12, y: 100 }, rHip: { x: cx + 12, y: 100 },
    lKnee: { x: cx - 14, y: 142 }, rKnee: { x: cx + 14, y: 142 },
    lAnkle: { x: cx - 12, y: 180 }, rAnkle: { x: cx + 12, y: 180 },
    lToe: { x: cx - 28, y: 183 }, rToe: { x: cx + 28, y: 183 },
    lHeel: { x: cx - 2, y: 183 }, rHeel: { x: cx + 2, y: 183 },
  };
  if (mode === 'squat') {
    const w = 320, h = 200;
    j.lAnkle = { x: w * 0.56, y: h - 26 };
    j.rAnkle = { x: w * 0.56, y: h - 26 };
    j.lKnee = { x: lerp(w * 0.53, w * 0.5, e), y: h - 74 };
    j.rKnee = { x: lerp(w * 0.53, w * 0.5, e), y: h - 74 };
    j.lHip = { x: lerp(w * 0.5, w * 0.44, e), y: lerp(h - 122, h - 88, e) };
    j.rHip = { x: lerp(w * 0.5, w * 0.44, e), y: lerp(h - 122, h - 88, e) };
    j.lSh = { x: lerp(w * 0.49, w * 0.41, e), y: j.lHip.y - 58 };
    j.rSh = { x: lerp(w * 0.49, w * 0.41, e), y: j.rHip.y - 58 };
    j.head = { x: j.lSh.x, y: j.lSh.y - 22 };
  } else if (mode === 'hamstring_curl') {
    const ang = e * 85 * Math.PI / 180; const sl = 42;
    j.rAnkle = { x: cx + 14 + Math.sin(ang) * sl * 0.8, y: 142 + Math.cos(ang) * sl };
    j.rToe = { x: j.rAnkle.x + 16, y: j.rAnkle.y + 3 };
    j.rHeel = { x: j.rAnkle.x - 2, y: j.rAnkle.y + 3 };
  } else if (mode === 'heel_raise') {
    const lift = e * 20;
    j.lAnkle = { x: cx - 12, y: 180 - lift }; j.rAnkle = { x: cx + 12, y: 180 - lift };
    j.lKnee = { x: cx - 14, y: 142 - lift * 0.4 }; j.rKnee = { x: cx + 14, y: 142 - lift * 0.4 };
    j.lHip = { x: cx - 12, y: 100 - lift * 0.2 }; j.rHip = { x: cx + 12, y: 100 - lift * 0.2 };
    j.lHeel = { x: cx - 2, y: 180 - lift }; j.rHeel = { x: cx + 2, y: 180 - lift };
  }
  return j;
}

function drawDemo(ctx: CanvasRenderingContext2D, mode: ExerciseMode, progress: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  
  if (mode === 'squat') {
    drawSquatDemo(ctx, W, H, progress);
  } else {
    const PING = progress < 0.5 ? progress * 2 : 2 - progress * 2;
    const j = buildJoints(mode, PING);
    
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0d1f'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1e1e3f'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(10, H - 12); ctx.lineTo(W - 10, H - 12); ctx.stroke();
    
    const CONNS: [string, string][] = [
      ['lSh', 'rSh'], ['lSh', 'lHip'], ['rSh', 'rHip'], ['lHip', 'rHip'],
      ['lSh', 'lElb'], ['lElb', 'lWri'], ['rSh', 'rElb'], ['rElb', 'rWri'],
      ['head', 'lSh'], ['head', 'rSh'],
      ['lHip', 'lKnee'], ['lKnee', 'lAnkle'], ['lAnkle', 'lToe'], ['lAnkle', 'lHeel'],
      ['rHip', 'rKnee'], ['rKnee', 'rAnkle'], ['rAnkle', 'rToe'], ['rAnkle', 'rHeel'],
    ];
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.2;
    CONNS.forEach(([a, b]) => { if (!j[a] || !j[b]) return; ctx.beginPath(); ctx.moveTo(j[a].x, j[a].y); ctx.lineTo(j[b].x, j[b].y); ctx.stroke(); });
    ctx.beginPath(); ctx.arc(j.head.x, j.head.y, 10, 0, Math.PI * 2); ctx.fillStyle = '#22c55e'; ctx.fill();
    ['lHip', 'rHip', 'lKnee', 'rKnee', 'lAnkle', 'rAnkle'].forEach(k => {
      if (!j[k]) return; ctx.beginPath(); ctx.arc(j[k].x, j[k].y, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#fbbf24'; ctx.fill();
    });
    
    const labels: Record<ExerciseMode, string> = { squat: 'Good Squat', hamstring_curl: 'Good Curl', heel_raise: 'Good Raise' };
    ctx.fillStyle = '#4ade80'; ctx.font = '600 11px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(labels[mode], W / 2, 13); ctx.textAlign = 'left';
  }
}

function drawSquatDemo(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
  // Background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1324";
  ctx.fillRect(0, 0, w, h);

  // Ground line
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, h - 26);
  ctx.lineTo(w - 18, h - 26);
  ctx.stroke();


  const timeSec = progress * 2.8; // Convert progress to time for squatPhase
  const phase = squatPhase(timeSec);

  // Draw good rep
  drawStickSquat(ctx, { w, h, phase, style: "good", alpha: 1 });
  
  // Draw cues
  drawSquatCues(ctx, w, h, phase);
}

function drawStickSquat(ctx: CanvasRenderingContext2D, opts: {
  w: number;
  h: number;
  phase: number;
  style: "good" | "bad";
  alpha: number;
}) {
  const { w, h, phase, style, alpha } = opts;
  
  // Style setup
  ctx.save();
  ctx.globalAlpha = alpha;
  const color = style === "good" ? "#e5e7eb" : "#fb7185";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;

  const groundY = h - 26;

  // Foot
  const toe: Point = { x: w * 0.60, y: groundY };
  const heel: Point = {
    x: w * 0.54,
    y: style === "bad" ? lerp(groundY, groundY - 16, smoothstep(phase)) : groundY,
  };
  const ankle: Point = { x: w * 0.56, y: groundY - 2 };

  // Knee
  const kneeX = style === "bad"
    ? lerp(w * 0.55, w * 0.67, smoothstep(phase))
    : lerp(w * 0.55, w * 0.61, smoothstep(phase));
  const knee: Point = { x: kneeX, y: lerp(groundY - 76, groundY - 66, smoothstep(phase)) };

  // Hip
  const hip: Point = style === "bad"
    ? {
        x: lerp(w * 0.52, w * 0.56, smoothstep(phase)),
        y: lerp(groundY - 132, groundY - 92, smoothstep(phase)),
      }
    : {
        x: lerp(w * 0.52, w * 0.46, smoothstep(phase)),
        y: lerp(groundY - 132, groundY - 88, smoothstep(phase)),
      };

  // Shoulder
  const shoulder: Point = style === "bad"
    ? {
        x: lerp(hip.x - 10, hip.x + 36, smoothstep(phase)),
        y: hip.y - lerp(64, 56, smoothstep(phase)),
      }
    : {
        x: lerp(hip.x - 6, hip.x + 10, smoothstep(phase)),
        y: hip.y - 62,
      };

  const head: Point = { x: shoulder.x, y: shoulder.y - 22 };

  // Arm
  const elbow: Point = style === "bad"
    ? { x: shoulder.x + 36, y: shoulder.y + 18 }
    : { x: shoulder.x + 24, y: shoulder.y + 18 };
  const hand: Point = style === "bad"
    ? { x: elbow.x + 30, y: elbow.y + 18 }
    : { x: elbow.x + 22, y: elbow.y + 16 };

  // Draw segments
  drawSegment(ctx, heel, toe);
  drawSegment(ctx, ankle, knee);
  drawSegment(ctx, knee, hip);
  drawSegment(ctx, hip, shoulder);
  drawSegment(ctx, shoulder, head);
  drawSegment(ctx, shoulder, elbow);
  drawSegment(ctx, elbow, hand);

  // Joints
  drawJoint(ctx, head, 4);
  drawJoint(ctx, shoulder, 4);
  drawJoint(ctx, hip, 4);
  drawJoint(ctx, knee, 4);
  drawJoint(ctx, ankle, 4);

  // Guides (good only)
  if (style === "good") {
    ctx.globalAlpha = alpha * 0.25;
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y - 110);
    ctx.lineTo(hip.x, groundY);
    ctx.stroke();

    ctx.strokeStyle = "#a7f3d0";
    ctx.beginPath();
    ctx.moveTo(toe.x, groundY);
    ctx.lineTo(toe.x, groundY - 120);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSquatCues(ctx: CanvasRenderingContext2D, w: number, h: number, phase: number) {
  const bottom = phase > 0.7;
  const mid = phase > 0.25 && phase <= 0.7;

  drawTextPill(
    ctx,
    "Heels down",
    16,
    50,
    bottom || mid ? "#0f172a" : "#0b1324",
    "#e5e7eb"
  );
  drawTextPill(
    ctx,
    "Knees track over toes",
    16,
    80,
    bottom || mid ? "#0f172a" : "#0b1324",
    "#e5e7eb"
  );
  drawTextPill(
    ctx,
    "Neutral spine",
    16,
    110,
    mid || bottom ? "#0f172a" : "#0b1324",
    "#e5e7eb"
  );

  if (bottom) {
    drawTextPill(ctx, "Pause at depth", 16, 140, "#0f172a", "#e5e7eb");
  }
}

// ─── Exercise pick screen (no assignment) ────────────────────────────────────
const EXERCISE_CARDS: { id: ExerciseMode; label: string; emoji: string; desc: string }[] = [
  { id: 'squat', label: 'Squat Analyzer', emoji: '🦵', desc: '3 sets · 8–15 reps · 60 s rest' },
  { id: 'hamstring_curl', label: 'Standing Hamstring Curl', emoji: '🔁', desc: '3 sets · 10–20 reps · 45 s rest' },
  { id: 'heel_raise', label: 'Heel Raise', emoji: '⬆️', desc: '3 sets · 12–25 reps · 30 s rest' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ExerciseSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');

  const { data: assignments = [] } = useAssignedExercises();
  const { data: todayLogs = [] } = useTodaySessionLogs();
  const logSession = useLogSession();

  const assignment = assignments.find(a => a.id === assignmentId);
  // Derive exercise mode from the assignment; fallback allows direct navigation
  const [chosenMode, setChosenMode] = useState<ExerciseMode | null>(null);
  const exerciseMode = (assignment?.exercise_id ?? chosenMode) as ExerciseMode | null;
  const rules = exerciseMode ? getExerciseRules(exerciseMode) : null;
  const exerciseName = assignment?.exercises?.name ?? (chosenMode ? EXERCISE_CARDS.find(c => c.id === chosenMode)?.label : null);

  // Set tracking (from DB)
  const setsDoneToday = todayLogs.filter(l => l.assigned_exercise_id === assignmentId).length;
  const currentSetNumber = setsDoneToday + 1;

  // ── State ────────────────────────────────────────────────────────────────
  const [side, setSide] = useState<Side>('left');
  const [cameraOn, setCameraOn] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [currentResult, setCurrentResult] = useState<AnalyzerResult | null>(null);
  const [statusText, setStatusText] = useState('Ready');

  // Per-set rep tracking
  const [currentSet, setCurrentSet] = useState(currentSetNumber);
  const [setBaseCorrect, setSetBaseCorrect] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-set popup (shown during rest)
  const [setPopup, setSetPopup] = useState<{
    setNumber: number; totalSets: number;
    correct: number; incorrect: number; formScore: number;
    issues: string[]; summary: string | null; loading: boolean;
  } | null>(null);

  // Full session summary state (shown after all sets)
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);


  // Accumulated session data for the summary
  const setLogsRef = useRef<Array<{
    setNumber: number; correctReps: number; incorrectReps: number;
    formScore: number; issues: string[];
  }>>([]);
  const sessionIssueCountRef = useRef<Map<string, number>>(new Map());
  const currentSetIssuesRef = useRef<Set<string>>(new Set());

  const repsInSet = Math.max(0, (currentResult?.correct ?? 0) - setBaseCorrect);
  const targetReps = rules?.minRepsPerSet ?? 10;
  const targetSets = assignment?.sets ?? rules?.targetSets ?? 3;
  const allSetsDone = currentSet > targetSets;

  // ── Refs ─────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const demoRef = useRef<HTMLCanvasElement>(null);
  const demoRafRef = useRef<number | null>(null);

  // ── Voice + Gemini coach ──────────────────────────────────────────────────
  const { announce, announceFeedback, announceRep, cancel: cancelVoice } = useVoiceAssistant(voiceOn);
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  const { coachSetComplete, coachSessionComplete, coachFormIssue, generateSetSummary, generateSessionSummary } =
    useGeminiCoach({
      onCoach: (text) => { if (voiceOn) announce(text); },
      enabled: voiceOn,
    });

  // Track feedback changes for Gemini live coaching
  const lastFeedbackRef = useRef<string>('');
  const formIssueCountRef = useRef(0);

  // ── Exercise hook ──────────────────────────────────────────────────────────
  const { initialize, startAnalysis, stopAnalysis, pauseAnalysis, resumeAnalysis, resetAnalysis, isInitialized, isAnalyzing, isPaused, error: analysisError } =
    useExerciseSession({
      exerciseMode: exerciseMode ?? 'squat',
      side,
      onResultUpdate: setCurrentResult,
    });

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setStatusText('Starting camera…');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>(res => {
          videoRef.current!.onloadedmetadata = () => { videoRef.current!.play().then(res).catch(res); };
        });
        setCameraOn(true);
        setStatusText('Initializing pose engine…');
        await initialize(); // always await — the hook guards against double-init
        setStatusText('Ready — click Start Analysis');
      }
    } catch (err) {
      console.error('[startCamera]', err);
      toast.error('Could not access camera');
      setStatusText('Camera error');
    }
  }, [initialize]);

  const stopCamera = useCallback(() => {
    stopAnalysis();
    if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    setCameraOn(false);
    setStatusText('Camera off');
  }, [stopAnalysis]);

  const handleStart = useCallback(async () => {
    if (!cameraOn) {
      await startCamera(); // startCamera awaits initialize internally
    }
    if (analysisError) { toast.error(analysisError); return; }
    if (!videoRef.current || !canvasRef.current) return;
    resetAnalysis();
    setSetBaseCorrect(currentResult?.correct ?? 0);
    startAnalysis(videoRef.current, canvasRef.current);
    announce(`Starting set ${currentSet}. ${targetReps} reps. Go!`);
  }, [cameraOn, analysisError, startCamera, resetAnalysis, startAnalysis, announce, currentSet, targetReps, currentResult?.correct]);

  // ── Rest timer ─────────────────────────────────────────────────────────────
  const startRest = useCallback((restSecs: number) => {
    stopAnalysis();
    setIsResting(true);
    setRestSecondsLeft(restSecs);
    announce(`Set ${currentSet} complete! Rest for ${restSecs} seconds.`);

    restIntervalRef.current = setInterval(() => {
      setRestSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(restIntervalRef.current!);
          setIsResting(false);
          setSetPopup(null); // ← dismiss popup when rest ends
          setCurrentSet(s => s + 1);
          announce(`Rest over. Get ready for set ${currentSet + 1}.`);
          return 0;
        }
        if (prev === 6) announce(`${prev - 1} seconds remaining.`);
        return prev - 1;
      });
    }, 1000);
  }, [stopAnalysis, announce, currentSet]);

  // ── Set completion detection ────────────────────────────────────────────────
  const setLoggedRef = useRef(false); // guard against double-fire

  useEffect(() => {
    if (!isAnalyzing || isResting || !rules) return;
    if (repsInSet < targetReps) { setLoggedRef.current = false; return; }
    if (setLoggedRef.current) return; // already logged this set
    setLoggedRef.current = true;

    stopAnalysis(); // stop immediately to freeze rep counts

    // Accurate rep counts for this set only
    const correctInSet = Math.min(repsInSet, currentResult?.correct ?? repsInSet);
    const incorrectInSet = Math.max(0, (currentResult?.incorrect ?? 0));
    const totalInSet = correctInSet + incorrectInSet;
    const formScore = totalInSet > 0 ? Math.round((correctInSet / totalInSet) * 100) : 100;

    if (assignmentId) {
      logSession.mutate({
        assigned_exercise_id: assignmentId,
        set_number: currentSet,
        total_reps: totalInSet,
        correct_reps: correctInSet,
        incorrect_reps: incorrectInSet,
        average_form_score: formScore,
      }, {
        onSuccess: () => toast.success(`Set ${currentSet} saved — ${correctInSet} correct, ${incorrectInSet} incorrect`),
        onError: e => toast.error('Save failed: ' + e.message),
      });
    }

    // Collect form issues for summary
    const issuesThisSet = Array.from(currentSetIssuesRef.current);
    currentSetIssuesRef.current.clear();

    // Record this set in session log
    setLogsRef.current.push({
      setNumber: currentSet,
      correctReps: correctInSet,
      incorrectReps: incorrectInSet,
      formScore,
      issues: issuesThisSet,
    });

    if (currentSet >= targetSets) {
      // ── Session done: voice announcement + generate written summary ──────
      if (voiceOn) {
        coachSessionComplete({
          totalSets: targetSets,
          totalCorrect: setLogsRef.current.reduce((s, e) => s + e.correctReps, 0),
          totalReps: setLogsRef.current.reduce((s, e) => s + e.correctReps + e.incorrectReps, 0),
          exerciseName: exerciseName ?? 'exercise',
        });
      } else {
        announce('All sets complete! Excellent work!');
      }

      // Generate detailed written summary with Gemini
      if (API_KEY) {
        setSummaryLoading(true);
        const allIssues = Array.from(sessionIssueCountRef.current.entries())
          .map(([issue, count]) => ({ issue, count }))
          .sort((a, b) => b.count - a.count);
        generateSessionSummary({
          exerciseName: exerciseName ?? 'Exercise',
          sets: setLogsRef.current,
          allIssues,
        }).then(text => {
          setSessionSummary(text || null);
          setSummaryLoading(false);
        });
      }
    } else {
      // ── Set done: voice + per-set popup with AI summary ──────────────────
      if (voiceOn) {
        coachSetComplete({
          setNumber: currentSet, totalSets: targetSets,
          correctReps: correctInSet, incorrectReps: incorrectInSet,
          exerciseName: exerciseName ?? 'exercise',
          formIssues: issuesThisSet,
        });
      } else {
        announce(`Set ${currentSet} complete!`);
      }

      // Show popup immediately in loading state
      setSetPopup({
        setNumber: currentSet, totalSets: targetSets,
        correct: correctInSet, incorrect: incorrectInSet, formScore,
        issues: issuesThisSet, summary: null, loading: true,
      });

      // Generate per-set summary in parallel with rest timer
      console.log('[Gemini] API_KEY exists:', !!API_KEY);
      if (API_KEY) {
        generateSetSummary({
          setNumber: currentSet, totalSets: targetSets,
          correctReps: correctInSet, incorrectReps: incorrectInSet, formScore,
          exerciseName: exerciseName ?? 'Exercise', issues: issuesThisSet,
        }).then(text => {
          setSetPopup(prev => prev ? { ...prev, summary: text || null, loading: false } : null);
        });
      } else {
        setSetPopup(prev => prev ? { ...prev, loading: false } : null);
      }

      setSetBaseCorrect(currentResult?.correct ?? 0);
      startRest(rules.restBetweenSets);
    }
  }, [repsInSet, targetReps]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice: rep counting + persistent form issue detection ────────────────
  useEffect(() => {
    if (!currentResult || !voiceOn) return;
    announceFeedback(currentResult.feedback);
    announceRep(currentResult.correct - setBaseCorrect, targetReps);

    // Accumulate form issues for session summary
    const issue = currentResult.feedback?.[0] ?? '';
    if (issue && issue !== 'Good form!' && issue !== 'Waiting for pose…' && issue !== 'No pose detected') {
      // Track per-set issues
      currentSetIssuesRef.current.add(issue);
      // Track session-wide issue frequency
      sessionIssueCountRef.current.set(issue, (sessionIssueCountRef.current.get(issue) ?? 0) + 1);

      // Ask Gemini for a coaching tip after 4 consecutive same-issue frames
      if (issue === lastFeedbackRef.current) {
        formIssueCountRef.current += 1;
        if (formIssueCountRef.current === 4 && isAnalyzing) {
          coachFormIssue(issue, exerciseName ?? 'exercise');
        }
      } else {
        lastFeedbackRef.current = issue;
        formIssueCountRef.current = 1;
      }
    } else {
      formIssueCountRef.current = 0;
      lastFeedbackRef.current = '';
    }
  }, [currentResult?.feedback?.[0], currentResult?.correct]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Demo canvas loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = demoRef.current; if (!canvas || !exerciseMode) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const CYCLE = 2200; let start: number | null = null;
    const frame = (ts: number) => {
      if (!start) start = ts;
      drawDemo(ctx, exerciseMode, ((ts - start) % CYCLE) / CYCLE);
      demoRafRef.current = requestAnimationFrame(frame);
    };
    demoRafRef.current = requestAnimationFrame(frame);
    return () => { if (demoRafRef.current) cancelAnimationFrame(demoRafRef.current); };
  }, [exerciseMode]);

  // ── Auto start camera ───────────────────────────────────────────────────────
  useEffect(() => { if (exerciseMode) startCamera(); }, [exerciseMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopCamera(); cancelVoice(); if (restIntervalRef.current) clearInterval(restIntervalRef.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pick screen (no exercise chosen) ───────────────────────────────────────
  if (!exerciseMode) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="font-display text-2xl font-bold mb-2 flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" /> Choose Exercise
          </h1>
          <p className="text-muted-foreground text-sm mb-8">Select the exercise you want to perform</p>
          <div className="grid gap-4">
            {EXERCISE_CARDS.map(c => (
              <button
                key={c.id}
                onClick={() => setChosenMode(c.id)}
                className="glass rounded-xl p-5 text-left hover:border-primary/50 border border-border/40 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{c.emoji}</span>
                  <div>
                    <p className="font-display font-semibold group-hover:text-primary transition-colors">{c.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const feedback = currentResult?.feedback ?? ['Waiting for pose…'];

  // ── Session UI ──────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              {exerciseName ?? 'Exercise Analyzer'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              MediaPipe real-time pose feedback · Set <span className="text-primary font-semibold">{Math.min(currentSet, targetSets)}</span> of <span className="font-semibold">{targetSets}</span>
              {rules && <> · {targetReps} reps per set · {rules.restBetweenSets}s rest</>}
            </p>
          </div>
          {/* Voice controls */}
          <div className="flex items-center gap-2">
            {/* Direct TTS test — bypasses all hook logic */}
            <Button
              variant="outline" size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                const ss = window.speechSynthesis;
                console.log('[VoiceTest] ss exists:', !!ss, '| voices:', ss?.getVoices()?.length, '| speaking:', ss?.speaking);
                // DO NOT call cancel() here — it causes onerror:canceled on the next speak()
                const u = new SpeechSynthesisUtterance('Voice test one two three');
                u.onstart = () => console.log('[VoiceTest] ✅ onstart fired — audio is starting');
                u.onend = () => console.log('[VoiceTest] ✅ onend fired — audio completed');
                u.onerror = (e) => console.error('[VoiceTest] ❌ onerror:', e.error);
                ss?.speak(u);
                console.log('[VoiceTest] speak() called. pending:', ss?.pending);
              }}
            >
              🔊 Test
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => { setVoiceOn(v => !v); if (voiceOn) cancelVoice(); }}
              className={voiceOn ? 'border-primary text-primary' : 'text-muted-foreground'}
            >
              {voiceOn ? <Volume2 className="h-4 w-4 mr-1" /> : <VolumeX className="h-4 w-4 mr-1" />}
              {voiceOn ? 'Voice On' : 'Voice Off'}
            </Button>
          </div>
        </div> {/* ← closes mb-5 header div */}

        {/* All sets done — AI Summary */}
        {allSetsDone ? (
          <div className="glass rounded-xl p-8 max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto mb-3" />
              <h2 className="font-display text-2xl font-bold text-green-400">All {targetSets} Sets Complete! 🎉</h2>
              <p className="text-muted-foreground text-sm mt-1">Your session has been saved to your profile</p>
            </div>

            {/* Per-set quick stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {setLogsRef.current.map(s => {
                const total = s.correctReps + s.incorrectReps;
                const acc = total > 0 ? Math.round((s.correctReps / total) * 100) : 100;
                return (
                  <div key={s.setNumber} className="text-center p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground">Set {s.setNumber}</p>
                    <p className={`font-display text-xl font-bold ${acc >= 80 ? 'text-success' : 'text-warning'}`}>{acc}%</p>
                    <p className="text-xs text-muted-foreground">{s.correctReps}/{total} correct</p>
                  </div>
                );
              })}
            </div>

            {/* Gemini AI Summary */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">AI Session Summary</span>
              </div>

              {summaryLoading ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">Gemini is analysing your session…</span>
                </div>
              ) : sessionSummary ? (
                /* Render markdown sections as styled text */
                <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed space-y-3">
                  {sessionSummary.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return (
                      <h3 key={i} className="font-semibold text-foreground mt-4 mb-1 text-base">{line.replace('## ', '')}</h3>
                    );
                    if (line.startsWith('- ')) return (
                      <p key={i} className="text-muted-foreground pl-3 border-l-2 border-primary/30">{line.replace('- ', '')}</p>
                    );
                    if (line.startsWith('**') && line.endsWith('**')) return (
                      <p key={i} className="font-medium text-foreground">{line.replace(/\*\*/g, '')}</p>
                    );
                    return line.trim() ? (
                      <p key={i} className="text-muted-foreground">{line}</p>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {API_KEY
                    ? 'Summary generation failed — check your Gemini API key.'
                    : 'Add VITE_GEMINI_API_KEY to .env.local to enable AI summaries.'}
                </p>
              )}
            </div>

            <Button onClick={() => navigate('/dashboard')} className="w-full bg-primary text-primary-foreground">
              Back to Dashboard
            </Button>
          </div>

        ) : (
          <>
            {/* ── Per-set AI Summary Popup ─────────────────────────────────── */}
            {setPopup && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="glass rounded-2xl p-7 w-full max-w-md shadow-2xl border border-primary/20 animate-in fade-in zoom-in-95 duration-200">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-display text-lg font-bold flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                        Set {setPopup.setNumber} Complete
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {setPopup.setNumber < setPopup.totalSets
                          ? `${setPopup.totalSets - setPopup.setNumber} set${setPopup.totalSets - setPopup.setNumber > 1 ? 's' : ''} remaining`
                          : 'Final set done!'}
                      </p>
                    </div>
                    {/* Rest countdown */}
                    {isResting && (
                      <div className="text-center">
                        <p className="font-display text-3xl font-bold text-primary tabular-nums">{restSecondsLeft}</p>
                        <p className="text-xs text-muted-foreground">rest</p>
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="text-center p-2.5 rounded-lg bg-secondary/30">
                      <p className="text-xs text-muted-foreground">Correct</p>
                      <p className="font-display text-xl font-bold text-success">{setPopup.correct}</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-secondary/30">
                      <p className="text-xs text-muted-foreground">Incorrect</p>
                      <p className={`font-display text-xl font-bold ${setPopup.incorrect > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                        {setPopup.incorrect}
                      </p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-secondary/30">
                      <p className="text-xs text-muted-foreground">Form Score</p>
                      <p className={`font-display text-xl font-bold ${setPopup.formScore >= 80 ? 'text-success' : 'text-warning'}`}>
                        {setPopup.formScore}%
                      </p>
                    </div>
                  </div>

                  {/* Form issues */}
                  {setPopup.issues.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {setPopup.issues.map(issue => (
                        <span key={issue} className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                          ⚠ {issue}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* AI Summary */}
                  <div className="rounded-lg bg-primary/5 border border-primary/15 p-4 mb-5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">AI Coach</span>
                    </div>
                    {setPopup.loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-muted-foreground">Analysing your set…</span>
                      </div>
                    ) : setPopup.summary ? (
                      <p className="text-sm text-muted-foreground leading-relaxed">{setPopup.summary}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Add VITE_GEMINI_API_KEY for AI coaching.</p>
                    )}
                  </div>

                  {/* Skip rest button */}
                  <button
                    onClick={() => {
                      clearInterval(restIntervalRef.current!);
                      setIsResting(false);
                      setSetPopup(null);
                      setCurrentSet(s => s + 1);
                    }}
                    className="w-full py-2 rounded-lg border border-border/50 text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
                  >
                    Skip Rest — Start Next Set
                  </button>
                </div>
              </div>
            )}

            <section className="grid lg:grid-cols-[1.9fr_1fr] gap-4">

              {/* ── Video ───────────────────────────────── */}
              <article className="glass rounded-xl overflow-hidden">
                {/* Set progress bar */}
                <div className="flex">
                  {Array.from({ length: targetSets }).map((_, i) => (
                    <div key={i} className={`h-1 flex-1 transition-all ${i < currentSet - 1 ? 'bg-green-400' : i === currentSet - 1 ? 'bg-primary' : 'bg-secondary'}`} />
                  ))}
                </div>
                <div className="relative aspect-video bg-secondary/30">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ display: cameraOn ? 'block' : 'none' }} />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: cameraOn ? 'block' : 'none', zIndex: 10 }} />
                  {!cameraOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Camera className="h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Camera off</p>
                      <Button size="sm" className="bg-primary text-primary-foreground" onClick={startCamera}>Enable Camera</Button>
                    </div>
                  )}
                  {/* Rest overlay */}
                  {isResting && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-4 z-20">
                      <Timer className="h-12 w-12 text-primary animate-pulse" />
                      <p className="font-display text-5xl font-bold text-primary">{restSecondsLeft}</p>
                      <p className="text-white text-lg font-medium">Rest — next set starting soon</p>
                      <Button variant="outline" onClick={() => { clearInterval(restIntervalRef.current!); setIsResting(false); setCurrentSet(s => s + 1); }} className="mt-2 text-white border-white/30">
                        Skip Rest
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Rep counter right below video */}
                <div className="p-4 border-t border-border/50 bg-secondary/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Reps this set</span>
                    <span className="font-display text-3xl font-bold text-primary">{repsInSet} <span className="text-lg text-muted-foreground">/ {targetReps}</span></span>
                  </div>
                  <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (repsInSet / targetReps) * 100)}%` }} />
                  </div>
                  {repsInSet >= targetReps && (
                    <p className="text-center text-xs text-green-400 font-medium mt-2">Set Complete! 🎉</p>
                  )}
                </div>
              </article>

              {/* ── Panel ───────────────────────────────── */}
              <aside className="glass rounded-xl p-4 space-y-4 overflow-y-auto max-h-[80vh]">

                {/* Side selector */}
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Facing Side
                  <select value={side} onChange={e => setSide(e.target.value as Side)}
                    className="bg-secondary border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </label>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isInitialized ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
                  <span className="text-xs text-primary font-medium">{statusText}</span>
                </div>


                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'State', value: currentResult?.state ?? '–', color: 'text-foreground' },
                    { label: 'Correct', value: currentResult?.correct ?? 0, color: 'text-green-400' },
                    { label: 'Incorrect', value: currentResult?.incorrect ?? 0, color: 'text-red-400' },
                  ].map(s => (
                    <div key={s.label} className="p-2 border border-border/50 rounded-lg bg-secondary/20 text-center">
                      <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
                      <div className={`font-display text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Metrics */}
                <div className="p-3 border border-border/50 rounded-lg bg-secondary/20">
                  <div className="text-xs text-muted-foreground mb-1">Metrics</div>
                  <div className="text-xs font-mono">{currentResult?.metricsText ?? 'Torso: 0.0 | Hip-Knee: 0.0 | Knee-Ankle: 0.0'}</div>
                </div>

                {/* Demo animation */}
                <div className="p-2 border border-border/50 rounded-lg bg-secondary/20">
                  <div className="text-xs text-muted-foreground mb-1">Good Rep Animation</div>
                  <canvas ref={demoRef} width={500} height={300} className="w-full rounded" />
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                  {!isAnalyzing ? (
                    <Button size="lg" className="w-full bg-primary text-primary-foreground" onClick={handleStart} disabled={!cameraOn || !isInitialized || isResting}>
                      {isResting ? `Resting… ${restSecondsLeft}s` : 'Start Analysis'}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="lg" className="flex-1" variant="outline" onClick={isPaused ? resumeAnalysis : pauseAnalysis}>
                        {isPaused ? 'Resume' : 'Pause'}
                      </Button>
                      <Button size="lg" className="flex-1" variant="destructive" onClick={stopAnalysis}>
                        Stop
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => { resetAnalysis(); setSetBaseCorrect(currentResult?.correct ?? 0); }}>Reset Set</Button>
                    <Button size="sm" variant="ghost" className="flex-1" onClick={cameraOn ? stopCamera : startCamera}>
                      {cameraOn ? <><CameraOff className="h-3 w-3 mr-1" />Stop Cam</> : <><Camera className="h-3 w-3 mr-1" />Start Cam</>}
                    </Button>
                  </div>
                </div>

                {/* Live feedback */}
                <div className="p-3 border border-border/50 rounded-lg bg-secondary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs text-muted-foreground">Live Feedback</div>
                    {voiceOn && <Volume2 className="h-3 w-3 text-primary" />}
                  </div>
                  <ul className="space-y-1">
                    {feedback.slice(0, 4).map((msg, i) => (
                      <li key={i} className={`flex items-start gap-2 text-sm ${msg === 'Good form!' ? 'text-green-400' : 'text-yellow-400'}`}>
                        <span className="mt-0.5">•</span><span>{msg}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </aside>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}