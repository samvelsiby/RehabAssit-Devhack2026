import { useState, useCallback, useRef, useEffect } from 'react';
import { poseDetector } from '@/services/mediapipe/pose-detector';
import { ExerciseFactory } from '@/services/exercises/exercise-factory';
import type { BaseExerciseAnalyzer } from '@/services/exercises/base-exercise-analyzer';
import type { ExerciseType } from '@/services/exercises/exercise-factory';
import type { ExerciseMetrics, RepData } from '@/services/mediapipe/types';

interface UsePoseAnalysisProps {
  exerciseType: string;
  targetReps: number;
  onRepComplete: (repData: RepData) => void;
  onSetComplete: (reps: RepData[]) => void;
}

export function usePoseAnalysis({
  exerciseType,
  targetReps,
  onRepComplete,
  onSetComplete,
}: UsePoseAnalysisProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<ExerciseMetrics | null>(null);
  const [currentRep, setCurrentRep] = useState(0);
  const [reps, setReps] = useState<RepData[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const analyzerRef = useRef<BaseExerciseAnalyzer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastAnalysisTimeRef = useRef<number>(0);
  const repStateRef = useRef<'up' | 'down' | 'transitioning'>('up');
  const depthHistoryRef = useRef<number[]>([]);

  // Initialize MediaPipe
  const initialize = useCallback(async () => {
    try {
      setError(null);
      await poseDetector.initialize();
      
      if (ExerciseFactory.isSupported(exerciseType)) {
        analyzerRef.current = ExerciseFactory.createAnalyzer(exerciseType as ExerciseType);
        setIsInitialized(true);
      } else {
        throw new Error(`Exercise type "${exerciseType}" not supported`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize pose analysis');
      setIsInitialized(false);
    }
  }, [exerciseType]);

  // Detect when a rep is completed
  const detectRepCompletion = useCallback((metrics: ExerciseMetrics) => {
    depthHistoryRef.current.push(metrics.depth);
    
    // Keep only last 10 depth readings for smoothing
    if (depthHistoryRef.current.length > 10) {
      depthHistoryRef.current.shift();
    }
    
    const avgDepth = depthHistoryRef.current.reduce((a, b) => a + b, 0) / depthHistoryRef.current.length;
    const currentState = repStateRef.current;
    
    // State machine for rep detection
    if (currentState === 'up' && avgDepth > 15) {
      repStateRef.current = 'down';
    } else if (currentState === 'down' && avgDepth < 8) {
      repStateRef.current = 'transitioning';
      
      // Rep completed!
      const newRep = currentRep + 1;
      const repData: RepData = {
        rep: newRep,
        formScore: metrics.formScore,
        kneeAngle: metrics.kneeAngle,
        hipAngle: metrics.hipAngle,
        depth: avgDepth,
        errors: metrics.errors,
        timestamp: Date.now(),
      };
      
      setCurrentRep(newRep);
      setReps(prev => {
        const newReps = [...prev, repData];
        onRepComplete(repData);
        
        if (newRep >= targetReps) {
          onSetComplete(newReps);
        }
        
        return newReps;
      });
      
      repStateRef.current = 'up';
      depthHistoryRef.current = [];
    }
  }, [currentRep, targetReps, onRepComplete, onSetComplete]);

  // Start analysis
  const startAnalysis = useCallback((video: HTMLVideoElement) => {
    if (!isInitialized || !analyzerRef.current) return;
    
    videoRef.current = video;
    setIsAnalyzing(true);
    setCurrentRep(0);
    setReps([]);
    repStateRef.current = 'up';
    depthHistoryRef.current = [];
    
    const analyzeFrame = async () => {
      if (!videoRef.current || !isAnalyzing || !analyzerRef.current) return;
      
      const now = performance.now();
      if (now - lastAnalysisTimeRef.current < 100) { // Throttle to 10 FPS
        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }
      
      lastAnalysisTimeRef.current = now;
      
      try {
        const result = await poseDetector.detectPose(videoRef.current, now);
        if (result && result.landmarks.length > 0) {
          const metrics = analyzerRef.current.analyzePose(result.landmarks);
          setCurrentMetrics(metrics);
          
          // Detect rep completion based on depth changes
          detectRepCompletion(metrics);
        }
      } catch (err) {
        console.error('Pose analysis error:', err);
      }
      
      if (isAnalyzing && currentRep < targetReps) {
        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      }
    };
    
    analyzeFrame();
  }, [isInitialized, isAnalyzing, currentRep, targetReps, detectRepCompletion]);

  // Stop analysis
  const stopAnalysis = useCallback(() => {
    setIsAnalyzing(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Reset analysis
  const resetAnalysis = useCallback(() => {
    stopAnalysis();
    setCurrentRep(0);
    setReps([]);
    setCurrentMetrics(null);
    repStateRef.current = 'up';
    depthHistoryRef.current = [];
  }, [stopAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnalysis();
      poseDetector.destroy();
    };
  }, [stopAnalysis]);

  return {
    initialize,
    startAnalysis,
    stopAnalysis,
    resetAnalysis,
    isInitialized,
    isAnalyzing,
    currentMetrics,
    currentRep,
    reps,
    error,
  };
}