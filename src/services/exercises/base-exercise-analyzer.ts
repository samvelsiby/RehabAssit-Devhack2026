import type { PoseLandmark, ExerciseMetrics } from '../mediapipe/types';

export abstract class BaseExerciseAnalyzer {
  protected minVisibility = 0.5;
  
  protected isLandmarkVisible(landmark: PoseLandmark): boolean {
    return (landmark.visibility ?? 1) >= this.minVisibility;
  }

  protected calculateFormScore(metrics: {
    angles: number[];
    alignment: number;
    depth: number;
    stability: number;
  }): number {
    const { angles, alignment, depth, stability } = metrics;
    
    // Weight different factors
    const angleScore = this.normalizeAngleScore(angles);
    const alignmentScore = alignment;
    const depthScore = depth;
    const stabilityScore = stability;
    
    // Weighted average
    return Math.round(
      angleScore * 0.4 +
      alignmentScore * 0.3 +
      depthScore * 0.2 +
      stabilityScore * 0.1
    );
  }

  protected normalizeAngleScore(angles: number[]): number {
    // Convert angle measurements to 0-100 score
    // This would be exercise-specific in real implementation
    return Math.max(0, Math.min(100, angles[0]));
  }

  protected generateRecommendations(errors: string[]): string[] {
    const recommendations: string[] = [];
    
    if (errors.includes('insufficient_depth')) {
      recommendations.push('Go deeper in your squat');
    }
    if (errors.includes('knee_misalignment')) {
      recommendations.push('Keep knees aligned with toes');
    }
    if (errors.includes('forward_lean')) {
      recommendations.push('Keep your torso more upright');
    }
    if (errors.includes('unstable')) {
      recommendations.push('Focus on maintaining balance');
    }
    
    return recommendations;
  }

  abstract analyzePose(landmarks: PoseLandmark[]): ExerciseMetrics;
}