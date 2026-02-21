import { BaseExerciseAnalyzer } from './base-exercise-analyzer';
import { AngleCalculator } from '../mediapipe/angle-calculator';
import type { PoseLandmark, ExerciseMetrics, PoseLandmarkIndex } from '../mediapipe/types';

export class SquatAnalyzer extends BaseExerciseAnalyzer {
  private readonly IDEAL_KNEE_ANGLE_MIN = 80;
  private readonly IDEAL_KNEE_ANGLE_MAX = 110;
  private readonly DEPTH_THRESHOLD = 0.15; // Hip should drop at least 15% of leg length
  
  analyzePose(landmarks: PoseLandmark[]): ExerciseMetrics {
    const errors: string[] = [];
    const metrics = this.calculateSquatMetrics(landmarks, errors);
    
    return {
      formScore: this.calculateFormScore(metrics),
      kneeAngle: metrics.kneeAngle,
      hipAngle: metrics.hipAngle,
      depth: metrics.depth,
      alignment: metrics.alignment,
      errors,
      recommendations: this.generateRecommendations(errors),
    };
  }

  private calculateSquatMetrics(landmarks: PoseLandmark[], errors: string[]) {
    const leftHip = landmarks[23]; // PoseLandmarkIndex.LEFT_HIP
    const rightHip = landmarks[24]; // PoseLandmarkIndex.RIGHT_HIP
    const leftKnee = landmarks[25]; // PoseLandmarkIndex.LEFT_KNEE
    const rightKnee = landmarks[26]; // PoseLandmarkIndex.RIGHT_KNEE
    const leftAnkle = landmarks[27]; // PoseLandmarkIndex.LEFT_ANKLE
    const rightAnkle = landmarks[28]; // PoseLandmarkIndex.RIGHT_ANKLE
    const leftShoulder = landmarks[11]; // PoseLandmarkIndex.LEFT_SHOULDER
    const rightShoulder = landmarks[12]; // PoseLandmarkIndex.RIGHT_SHOULDER

    // Check landmark visibility
    const requiredLandmarks = [leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle];
    if (!requiredLandmarks.every(landmark => this.isLandmarkVisible(landmark))) {
      errors.push('pose_not_visible');
      return this.getDefaultMetrics();
    }

    // Calculate knee angles (using average of both legs)
    const leftKneeAngle = AngleCalculator.calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = AngleCalculator.calculateAngle(rightHip, rightKnee, rightAnkle);
    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

    // Calculate hip angle (torso lean)
    const hipMidpoint = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: (leftHip.z + rightHip.z) / 2,
    };
    const shoulderMidpoint = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: (leftShoulder.z + rightShoulder.z) / 2,
    };
    
    // Hip angle relative to vertical
    const torsoAngle = Math.atan2(
      hipMidpoint.x - shoulderMidpoint.x,
      shoulderMidpoint.y - hipMidpoint.y
    ) * (180 / Math.PI);
    const hipAngle = 90 - Math.abs(torsoAngle);

    // Calculate depth (how low the hips go relative to knees)
    const hipHeight = hipMidpoint.y;
    const kneeHeight = (leftKnee.y + rightKnee.y) / 2;
    const legLength = AngleCalculator.calculateDistance(
      { x: (leftHip.x + rightHip.x) / 2, y: hipHeight, z: hipMidpoint.z },
      { x: (leftAnkle.x + rightAnkle.x) / 2, y: (leftAnkle.y + rightAnkle.y) / 2, z: (leftAnkle.z + rightAnkle.z) / 2 }
    );
    const currentDepth = Math.max(0, kneeHeight - hipHeight);
    const depthPercentage = (currentDepth / legLength) * 100;

    // Calculate knee alignment (knees should track over toes)
    const leftKneeX = leftKnee.x;
    const rightKneeX = rightKnee.x;
    const leftAnkleX = leftAnkle.x;
    const rightAnkleX = rightAnkle.x;
    
    const leftAlignment = Math.abs(leftKneeX - leftAnkleX);
    const rightAlignment = Math.abs(rightKneeX - rightAnkleX);
    const avgAlignment = ((1 - leftAlignment) + (1 - rightAlignment)) / 2 * 100;

    // Stability check (shoulder and hip alignment)
    const stability = AngleCalculator.calculateHorizontalAlignment(leftShoulder, rightShoulder) +
                     AngleCalculator.calculateHorizontalAlignment(leftHip, rightHip);
    const stabilityScore = stability / 2;

    // Error detection
    if (avgKneeAngle < this.IDEAL_KNEE_ANGLE_MIN) {
      errors.push('insufficient_depth');
    }
    if (avgKneeAngle > this.IDEAL_KNEE_ANGLE_MAX) {
      errors.push('excessive_depth');
    }
    if (avgAlignment < 70) {
      errors.push('knee_misalignment');
    }
    if (hipAngle < 60) {
      errors.push('forward_lean');
    }
    if (stabilityScore < 80) {
      errors.push('unstable');
    }

    return {
      kneeAngle: Math.round(avgKneeAngle),
      hipAngle: Math.round(hipAngle),
      depth: Math.round(depthPercentage),
      alignment: Math.round(avgAlignment),
      stability: Math.round(stabilityScore),
      angles: [avgKneeAngle, hipAngle]
    };
  }

  private getDefaultMetrics() {
    return {
      kneeAngle: 0,
      hipAngle: 0,
      depth: 0,
      alignment: 0,
      stability: 0,
      angles: [0, 0]
    };
  }
}