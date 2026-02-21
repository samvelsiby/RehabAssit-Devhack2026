import { DrawingUtils } from '@mediapipe/drawing_utils';
import type { PoseLandmark } from './types';

export class PoseVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drawingUtils: DrawingUtils;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    this.ctx = ctx;
    this.drawingUtils = new DrawingUtils(ctx);
  }

  drawPose(landmarks: PoseLandmark[], width: number, height: number) {
    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);
    
    // Set canvas size
    this.canvas.width = width;
    this.canvas.height = height;

    // Draw pose landmarks
    this.drawingUtils.drawLandmarks(landmarks, {
      radius: 4,
      color: '#00D4AA',
      fillColor: '#00D4AA'
    });

    // Draw pose connections
    this.drawingUtils.drawConnectors(landmarks, [
      // Torso
      [11, 12], [11, 23], [12, 24], [23, 24],
      // Left arm
      [11, 13], [13, 15],
      // Right arm  
      [12, 14], [14, 16],
      // Left leg
      [23, 25], [25, 27],
      // Right leg
      [24, 26], [26, 28]
    ], {
      color: '#00D4AA',
      lineWidth: 2
    });

    // Highlight key joints for exercise analysis
    this.highlightKeyJoints(landmarks, width, height);
  }

  private highlightKeyJoints(landmarks: PoseLandmark[], width: number, height: number) {
    // Highlight knees (important for squat analysis)
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    
    if (leftKnee && rightKnee) {
      this.ctx.beginPath();
      this.ctx.arc(leftKnee.x * width, leftKnee.y * height, 8, 0, 2 * Math.PI);
      this.ctx.fillStyle = '#FFD700';
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.arc(rightKnee.x * width, rightKnee.y * height, 8, 0, 2 * Math.PI);
      this.ctx.fillStyle = '#FFD700';
      this.ctx.fill();
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}