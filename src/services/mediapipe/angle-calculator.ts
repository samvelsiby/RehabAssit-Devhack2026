import type { PoseLandmark } from './types';

export class AngleCalculator {
  static calculateAngle(
    point1: PoseLandmark,
    vertex: PoseLandmark,
    point2: PoseLandmark
  ): number {
    // Calculate vectors
    const v1 = {
      x: point1.x - vertex.x,
      y: point1.y - vertex.y,
    };
    
    const v2 = {
      x: point2.x - vertex.x,
      y: point2.y - vertex.y,
    };

    // Calculate dot product
    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    
    // Calculate magnitudes
    const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    // Calculate angle in radians
    const cosAngle = dotProduct / (magnitude1 * magnitude2);
    const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    
    // Convert to degrees
    return (angleRad * 180) / Math.PI;
  }

  static calculateDistance(point1: PoseLandmark, point2: PoseLandmark): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  static calculateVerticalPosition(landmark: PoseLandmark): number {
    // Returns normalized vertical position (0 = top, 1 = bottom)
    return landmark.y;
  }

  static calculateHorizontalAlignment(leftLandmark: PoseLandmark, rightLandmark: PoseLandmark): number {
    // Calculate horizontal alignment deviation from center
    const midpoint = (leftLandmark.x + rightLandmark.x) / 2;
    const deviation = Math.abs(midpoint - 0.5); // 0.5 is center of frame
    return Math.max(0, 100 - (deviation * 200)); // Convert to percentage score
  }
}