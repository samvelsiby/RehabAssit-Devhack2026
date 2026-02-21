import { useState, useCallback, useRef, useEffect } from 'react';
import { poseDetector } from '@/services/mediapipe/pose-detector';
import { MiniSquatAnalyzer } from '@/services/exercises/mini-squat-analyzer';
import type { Side } from '@/services/exercises/mini-squat-analyzer';
import type { AnalyzerResult } from '@/utils/exercise-geometry';

interface UseMiniSquatAnalysisProps {
  side: Side;
  onResultUpdate: (result: AnalyzerResult) => void;
}

export function useMiniSquatAnalysis({ side, onResultUpdate }: UseMiniSquatAnalysisProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const analyzerRef = useRef<MiniSquatAnalyzer>(new MiniSquatAnalyzer());
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastAnalysisTimeRef = useRef<number>(0);

  // Initialize MediaPipe
  const initialize = useCallback(async () => {
    try {
      setError(null);
      await poseDetector.initialize();
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize pose analysis');
      setIsInitialized(false);
    }
  }, []);

  // Draw skeleton overlay on canvas
  const drawPoseOverlay = useCallback((landmarks: any[], canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use the actual video dimensions for accuracy
    const videoWidth = video.videoWidth || 960;
    const videoHeight = video.videoHeight || 540;
    
    // Set canvas size to match container
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas and add visible background for debugging
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Debug: Add semi-transparent background to verify canvas is working
    ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (landmarks && landmarks.length > 0) {
      // Draw pose connections
      const connections = [
        [11, 12], [11, 23], [12, 24], [23, 24], // Torso
        [11, 13], [13, 15], [12, 14], [14, 16], // Arms
        [23, 25], [25, 27], [24, 26], [26, 28] // Legs
      ];

      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 3;
      
      connections.forEach(([start, end]) => {
        const startLandmark = landmarks[start];
        const endLandmark = landmarks[end];
        if (startLandmark && endLandmark && 
            (startLandmark.visibility || 1) > 0.5 && (endLandmark.visibility || 1) > 0.5) {
          ctx.beginPath();
          ctx.moveTo(startLandmark.x * canvas.width, startLandmark.y * canvas.height);
          ctx.lineTo(endLandmark.x * canvas.width, endLandmark.y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw landmarks
      ctx.fillStyle = "#f3f4f6";
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2;
      
      landmarks.forEach((landmark, index) => {
        if (landmark && (landmark.visibility || 1) > 0.5) {
          const x = landmark.x * canvas.width;
          const y = landmark.y * canvas.height;
          
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // Highlight key joints for mini squats
          if ([23, 24, 25, 26].includes(index)) { // Hips and knees
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = "#ffd700";
            ctx.fill();
            ctx.strokeStyle = "#ff6b35";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#f3f4f6";
            ctx.strokeStyle = "#34d399";
          }
        }
      });
      
      // Draw text overlay to show skeleton is active
      ctx.fillStyle = "#34d399";
      ctx.font = "16px monospace";
      ctx.fillText("POSE DETECTED", 10, 25);
      ctx.fillText(`Landmarks: ${landmarks.length}`, 10, 45);
    }
  }, []);

  // Start analysis
  const startAnalysis = useCallback((video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    if (!isInitialized) return;
    
    videoRef.current = video;
    canvasRef.current = canvas;
    setIsAnalyzing(true);
    analyzerRef.current.reset();
    
    const analyzeFrame = async () => {
      if (!videoRef.current || !canvasRef.current || !isAnalyzing) return;
      
      const now = performance.now();
      if (now - lastAnalysisTimeRef.current < 100) { // Throttle to 10 FPS
        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }
      
      lastAnalysisTimeRef.current = now;
      
      try {
        const result = await poseDetector.detectPose(videoRef.current, now);
        let analyzerResult: AnalyzerResult;
        
        if (!result || !result.landmarks || result.landmarks.length === 0) {
          analyzerResult = analyzerRef.current.processNoPose();
        } else {
          // Draw pose overlay
          drawPoseOverlay(result.landmarks, canvasRef.current, videoRef.current);
          
          // Debug: Log pose detection
          console.log('Pose detected:', result.landmarks.length, 'landmarks');
          
          // Process exercise analysis
          analyzerResult = analyzerRef.current.process(
            result.landmarks,
            videoRef.current.videoWidth,
            videoRef.current.videoHeight,
            side
          );
        }
        
        onResultUpdate(analyzerResult);
      } catch (err) {
        console.error('Pose analysis error:', err);
      }
      
      if (isAnalyzing) {
        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      }
    };
    
    analyzeFrame();
  }, [isInitialized, isAnalyzing, side, onResultUpdate, drawPoseOverlay]);

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
    analyzerRef.current.reset();
  }, []);

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
    error,
  };
}