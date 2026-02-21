import { SquatAnalyzer } from './squat-analyzer';
import type { BaseExerciseAnalyzer } from './base-exercise-analyzer';

export type ExerciseType = 'squat' | 'lunge' | 'pushup' | 'plank';

export class ExerciseFactory {
  private static analyzers = new Map<string, () => BaseExerciseAnalyzer>([
    ['squat', () => new SquatAnalyzer()],
  ]);

  static createAnalyzer(exerciseType: ExerciseType | string): BaseExerciseAnalyzer {
    const type = exerciseType.toLowerCase();
    
    for (const [supportedType, createFn] of this.analyzers) {
      if (type.includes(supportedType)) {
        return createFn();
      }
    }
    
    throw new Error(`Unsupported exercise type: ${exerciseType}`);
  }

  static getSupportedExercises(): string[] {
    return Array.from(this.analyzers.keys());
  }

  static isSupported(exerciseType: string): boolean {
    const type = exerciseType.toLowerCase();
    return Array.from(this.analyzers.keys()).some(supportedType => type.includes(supportedType));
  }
}