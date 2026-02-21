export interface ExerciseThresholds {
  // Squat thresholds
  squat?: {
    minDepthAngle: number;      // Minimum knee angle for valid squat (degrees)
    maxDepthAngle: number;      // Maximum knee angle for valid squat (degrees)
    torsoLeanMax: number;       // Maximum forward torso lean (degrees)
    kneeTrackingMax: number;    // Maximum knee valgus/varus (degrees)
    speedMin: number;           // Minimum descent speed
    speedMax: number;           // Maximum descent speed
  };
  
  // Heel raise thresholds
  heel_raise?: {
    minHeelLift: number;        // Minimum heel lift height (cm)
    maxHeelLift: number;        // Maximum heel lift height (cm)
    balanceThreshold: number;   // Maximum side-to-side sway (degrees)
    holdTimeMin: number;        // Minimum hold time at peak (seconds)
    speedControl: number;       // Movement speed control factor
  };
  
  // Hamstring curl thresholds
  hamstring_curl?: {
    minFlexionAngle: number;    // Minimum knee flexion (degrees)
    maxFlexionAngle: number;    // Maximum knee flexion (degrees)
    hipStabilityMax: number;    // Maximum hip movement (degrees)
    controlledSpeed: number;    // Speed control for eccentric phase
    rangeOfMotion: number;      // Required ROM percentage
  };
}

export interface CustomExerciseConfig {
  id: string;
  exerciseType: 'squat' | 'heel_raise' | 'hamstring_curl';
  name: string;
  description: string;
  thresholds: ExerciseThresholds;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  adaptations?: string[];     // Special adaptations/modifications
  createdBy: string;          // Physio ID
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseVisualizationData {
  exerciseType: 'squat' | 'heel_raise' | 'hamstring_curl';
  currentAngle: number;
  targetRange: { min: number; max: number };
  formScore: number;
  joints: {
    hip: { x: number; y: number; angle: number };
    knee: { x: number; y: number; angle: number };
    ankle: { x: number; y: number; angle: number };
  };
  feedback: string[];
}

export interface ThresholdAdjustment {
  parameter: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
}