import type { PoseLandmark } from '@/services/mediapipe/types';

export interface Point {
  x: number;
  y: number;
}

export interface AnalyzerResult {
  state: string | null;
  angles: {
    torso: number;
    hipKnee: number;
    kneeAnkle: number;
  };
  metricsText: string;
  feedback: string[];
  correct: number;
  incorrect: number;
}

export function angleBetweenPoints(p1: Point, p2: Point, pref: Point): number {
  const v1x = p1.x - pref.x;
  const v1y = p1.y - pref.y;
  const v2x = p2.x - pref.x;
  const v2y = p2.y - pref.y;

  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  const denom = n1 * n2;
  if (denom < 1e-6) {
    return 0.0;
  }

  let cosine = (v1x * v2x + v1y * v2y) / denom;
  cosine = Math.min(1.0, Math.max(-1.0, cosine));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function angleWithVertical(top: Point, pivot: Point, frameHeight: number): number {
  const verticalPoint: Point = {
    x: pivot.x,
    y: pivot.y > frameHeight / 2 ? 0 : frameHeight
  };
  return angleBetweenPoints(top, verticalPoint, pivot);
}

export function pixelPoint(
  landmarks: PoseLandmark[],
  index: number,
  width: number,
  height: number
): Point {
  return {
    x: landmarks[index].x * width,
    y: landmarks[index].y * height
  };
}