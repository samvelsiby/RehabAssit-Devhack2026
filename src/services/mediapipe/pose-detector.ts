import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseDetectionResult } from './types';

export class PoseDetector {
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
      );

      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MediaPipe PoseLandmarker:', error);
      throw new Error('Failed to initialize pose detection');
    }
  }

  async detectPose(
    video: HTMLVideoElement,
    timestamp: number
  ): Promise<PoseDetectionResult | null> {
    if (!this.poseLandmarker || !this.isInitialized) {
      throw new Error('PoseDetector not initialized');
    }

    if (video.readyState !== 4) {
      return null; // Video not ready
    }

    try {
      const results = this.poseLandmarker.detectForVideo(video, timestamp);
      
      if (results.landmarks && results.landmarks.length > 0) {
        return {
          landmarks: results.landmarks[0],
          worldLandmarks: results.worldLandmarks ? results.worldLandmarks[0] : [],
          timestamp
        };
      }

      return null;
    } catch (error) {
      console.error('Pose detection failed:', error);
      return null;
    }
  }

  destroy(): void {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.isInitialized = false;
  }

  isReady(): boolean {
    return this.isInitialized && this.poseLandmarker !== null;
  }
}

export const poseDetector = new PoseDetector();