/**
 * useExerciseSession
 * Generic hook that runs the real-time MediaPipe pose analysis loop.
 * Supports swapping analyzers based on exerciseMode and side props.
 *
 * API consumed by ExerciseSession.tsx:
 *   { initialize, startAnalysis, stopAnalysis, resetAnalysis,
 *     isInitialized, isAnalyzing, error }
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { poseDetector } from '@/services/mediapipe/pose-detector';
import { MiniSquatAnalyzer } from '@/services/exercises/mini-squat-analyzer';
import { HamstringCurlAnalyzer } from '@/services/exercises/hamstring-curl-analyzer';
import { HeelRaiseAnalyzer } from '@/services/exercises/heel-raise-analyzer';
import type { Side } from '@/services/exercises/mini-squat-analyzer';
import type { PoseLandmark } from '@/services/mediapipe/types';
import type { ExerciseMode } from '@/hooks/useExercises';

// ── Analyzer interface ────────────────────────────────────────────────────────
export interface AnalyzerResult {
  state: string | null;
  angles: { torso: number; hipKnee: number; kneeAnkle: number };
  metricsText: string;
  feedback: string[];
  correct: number;
  incorrect: number;
}

interface IAnalyzer {
  process(landmarks: PoseLandmark[], w: number, h: number, side: Side): AnalyzerResult;
  processNoPose(): AnalyzerResult;
  reset(): void;
}

function makeAnalyzer(mode: ExerciseMode): IAnalyzer {
  if (mode === 'hamstring_curl') return new HamstringCurlAnalyzer();
  if (mode === 'heel_raise') return new HeelRaiseAnalyzer();
  return new MiniSquatAnalyzer();
}

// ── Hook props ────────────────────────────────────────────────────────────────
interface Props {
  exerciseMode: ExerciseMode;
  side: Side;
  onResultUpdate: (result: AnalyzerResult) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useExerciseSession({ exerciseMode, side, onResultUpdate }: Props) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs that never become stale inside the animation loop
  const isInitializedRef = useRef(false);
  const isAnalyzingRef = useRef(false);
  const isPausedRef = useRef(false);
  const analyzerRef = useRef<IAnalyzer>(makeAnalyzer(exerciseMode));
  const sideRef = useRef<Side>(side);
  const onResultRef = useRef(onResultUpdate);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Keep refs in sync with latest props (no stale closures in the loop)
  useEffect(() => { sideRef.current = side; }, [side]);
  useEffect(() => { onResultRef.current = onResultUpdate; }, [onResultUpdate]);

  // Swap analyzer when mode changes
  useEffect(() => {
    analyzerRef.current = makeAnalyzer(exerciseMode);
    analyzerRef.current.reset();
  }, [exerciseMode]);

  // ── Skeleton overlay ─────────────────────────────────────────────────────
  const drawOverlay = useCallback((landmarks: PoseLandmark[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size canvas to match its CSS display size (preserves aspect ratio)
    const rect = canvas.getBoundingClientRect();
    const W = rect.width || canvas.offsetWidth || 640;
    const H = rect.height || canvas.offsetHeight || 360;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const CONNECTIONS = [
      [11, 12], [11, 23], [12, 24], [23, 24],
      [11, 13], [13, 15], [12, 14], [14, 16],
      [23, 25], [25, 27], [27, 29], [27, 31],
      [24, 26], [26, 28], [28, 30], [28, 32],
    ];

    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    CONNECTIONS.forEach(([a, b]) => {
      const la = landmarks[a], lb = landmarks[b];
      if (!la || !lb) return;
      if ((la.visibility ?? 1) < 0.4 || (lb.visibility ?? 1) < 0.4) return;
      ctx.beginPath();
      ctx.moveTo(la.x * W, la.y * H);
      ctx.lineTo(lb.x * W, lb.y * H);
      ctx.stroke();
    });

    const KEY_POINTS = new Set([23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
    landmarks.forEach((lm, i) => {
      if (!lm || (lm.visibility ?? 1) < 0.4) return;
      const x = lm.x * W, y = lm.y * H;
      const isKey = KEY_POINTS.has(i);
      ctx.beginPath();
      ctx.arc(x, y, isKey ? 7 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isKey ? '#fbbf24' : '#f3f4f6';
      ctx.fill();
      if (isKey) {
        ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#34d399'; ctx.lineWidth = 3;
      }
    });
  }, []);

  // ── Initialize MediaPipe ─────────────────────────────────────────────────
  const initialize = useCallback(async () => {
    if (isInitializedRef.current) return; // already done
    try {
      setError(null);
      await poseDetector.initialize();
      isInitializedRef.current = true;
      setIsInitialized(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize pose detection';
      setError(msg);
    }
  }, []);

  // ── Analysis loop ────────────────────────────────────────────────────────
  const loop = useCallback(async () => {
    if (!isAnalyzingRef.current || !videoRef.current || !canvasRef.current || isPausedRef.current) {
      if (isAnalyzingRef.current && !isPausedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
      return;
    }

    const now = performance.now();
    // Throttle to ~10 fps
    if (now - lastTimeRef.current < 95) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    lastTimeRef.current = now;

    let ar: AnalyzerResult;
    try {
      // Video must be playing and have loaded enough data
      const video = videoRef.current;
      if (video.readyState < 2 || video.paused) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const result = await poseDetector.detectPose(video, now);

      if (!result || !result.landmarks || result.landmarks.length === 0) {
        ar = analyzerRef.current.processNoPose();
      } else {
        drawOverlay(result.landmarks, canvasRef.current);
        ar = analyzerRef.current.process(
          result.landmarks,
          video.videoWidth || 640,
          video.videoHeight || 360,
          sideRef.current,
        );
      }
      onResultRef.current(ar);
    } catch (e) {
      console.warn('[useExerciseSession] frame error:', e);
    }

    if (isAnalyzingRef.current) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [drawOverlay]);

  // ── Public controls ──────────────────────────────────────────────────────
  const startAnalysis = useCallback((video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    // Use the ref (not state) so this never has a stale closure issue
    if (!isInitializedRef.current) {
      console.warn('[useExerciseSession] startAnalysis called before initialized');
      return;
    }
    videoRef.current = video;
    canvasRef.current = canvas;
    analyzerRef.current.reset();

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    lastTimeRef.current = 0; // allow first frame immediately

    requestAnimationFrame(loop);
  }, [loop]);

  const stopAnalysis = useCallback(() => {
    isAnalyzingRef.current = false;
    isPausedRef.current = false;
    setIsAnalyzing(false);
    setIsPaused(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const pauseAnalysis = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resumeAnalysis = useCallback(() => {
    if (isAnalyzingRef.current) {
      isPausedRef.current = false;
      setIsPaused(false);
      requestAnimationFrame(loop);
    }
  }, [loop]);

  const resetAnalysis = useCallback(() => {
    analyzerRef.current.reset();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isAnalyzingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Don't destroy the singleton here — other components may need it.
      // poseDetector.destroy() should only be called when the entire session is done.
    };
  }, []);

  return {
    initialize,
    startAnalysis,
    stopAnalysis,
    pauseAnalysis,
    resumeAnalysis,
    resetAnalysis,
    isInitialized,
    isAnalyzing,
    isPaused,
    error,
  };
}
