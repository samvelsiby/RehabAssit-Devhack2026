import { STATE_THRESH, FEEDBACK_THRESH, OFFSET_THRESH, INACTIVE_THRESH_SEC } from '@/config/exercise-thresholds';
import { angleBetweenPoints, angleWithVertical, pixelPoint, type AnalyzerResult, type Point } from '@/utils/exercise-geometry';
import type { PoseLandmark } from '@/services/mediapipe/types';

export type Side = "left" | "right";
export type SquatState = "s1" | "s2" | "s3";

const LANDMARK = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28
} as const;

function nowSec(): number {
  return performance.now() / 1000;
}

function isValidRepSequence(seq: SquatState[]): boolean {
  const validShallow = seq.length === 1 && seq[0] === "s2";
  const validShort = seq.length === 2 && seq[0] === "s2" && seq[1] === "s3";
  const validLong = seq.length === 3 && seq[0] === "s2" && seq[1] === "s3" && seq[2] === "s2";
  return validShallow || validShort || validLong;
}

export class MiniSquatAnalyzer {
  private correct = 0;
  private incorrect = 0;
  private prevState: SquatState | null = null;
  private stateSequence: SquatState[] = [];
  private severeFlag = false;
  private inactiveSince: number | null = null;

  private getState(hipKneeAngle: number): SquatState | null {
    if (hipKneeAngle <= STATE_THRESH.s1Max) {
      return "s1";
    }
    if (hipKneeAngle >= STATE_THRESH.s2Min && hipKneeAngle <= STATE_THRESH.s2Max) {
      return "s2";
    }
    if (hipKneeAngle >= STATE_THRESH.s3Min && hipKneeAngle <= STATE_THRESH.s3Max) {
      return "s3";
    }
    return null;
  }

  private updateSequence(currentState: SquatState | null): void {
    if (!currentState || !["s2", "s3"].includes(currentState) || currentState === this.prevState) {
      return;
    }

    if (currentState === "s2") {
      if (
        this.stateSequence.length === 0 ||
        this.stateSequence[this.stateSequence.length - 1] !== "s2"
      ) {
        this.stateSequence.push("s2");
      }
      return;
    }

    if (currentState === "s3") {
      if (this.stateSequence.includes("s2") && this.stateSequence.length === 1) {
        this.stateSequence.push("s3");
      }
    }
  }

  private maybeResetForInactivity(): void {
    const now = nowSec();
    if (this.inactiveSince === null) {
      this.inactiveSince = now;
      return;
    }

    if (now - this.inactiveSince >= INACTIVE_THRESH_SEC) {
      this.correct = 0;
      this.incorrect = 0;
      this.prevState = null;
      this.stateSequence = [];
      this.severeFlag = false;
      this.inactiveSince = now;
    }
  }

  processNoPose(): AnalyzerResult {
    this.maybeResetForInactivity();
    return {
      state: null,
      angles: { torso: 0, hipKnee: 0, kneeAnkle: 0 },
      metricsText: "Torso: 0.0 | Hip-Knee: 0.0 | Knee-Ankle: 0.0",
      feedback: ["No pose detected"],
      correct: this.correct,
      incorrect: this.incorrect
    };
  }

  process(
    landmarks: PoseLandmark[],
    frameWidth: number,
    frameHeight: number,
    side: Side = "left"
  ): AnalyzerResult {
    this.inactiveSince = null;

    const sideIsRight = side === "right";
    const shoulderIdx = sideIsRight ? LANDMARK.RIGHT_SHOULDER : LANDMARK.LEFT_SHOULDER;
    const hipIdx = sideIsRight ? LANDMARK.RIGHT_HIP : LANDMARK.LEFT_HIP;
    const kneeIdx = sideIsRight ? LANDMARK.RIGHT_KNEE : LANDMARK.LEFT_KNEE;
    const ankleIdx = sideIsRight ? LANDMARK.RIGHT_ANKLE : LANDMARK.LEFT_ANKLE;

    const nose = pixelPoint(landmarks, LANDMARK.NOSE, frameWidth, frameHeight);
    const leftShoulder = pixelPoint(landmarks, LANDMARK.LEFT_SHOULDER, frameWidth, frameHeight);
    const rightShoulder = pixelPoint(landmarks, LANDMARK.RIGHT_SHOULDER, frameWidth, frameHeight);

    const offsetAngle = angleBetweenPoints(leftShoulder, rightShoulder, nose);
    if (offsetAngle > OFFSET_THRESH) {
      this.maybeResetForInactivity();
      return {
        state: null,
        angles: { torso: 0, hipKnee: 0, kneeAnkle: 0 },
        metricsText: "Torso: 0.0 | Hip-Knee: 0.0 | Knee-Ankle: 0.0",
        feedback: ["Turn side-on to camera"],
        correct: this.correct,
        incorrect: this.incorrect
      };
    }

    const shoulder = pixelPoint(landmarks, shoulderIdx, frameWidth, frameHeight);
    const hip = pixelPoint(landmarks, hipIdx, frameWidth, frameHeight);
    const knee = pixelPoint(landmarks, kneeIdx, frameWidth, frameHeight);
    const ankle = pixelPoint(landmarks, ankleIdx, frameWidth, frameHeight);

    const torsoAngle = angleWithVertical(shoulder, hip, frameHeight);
    const hipKneeAngle = angleWithVertical(hip, knee, frameHeight);
    const kneeAnkleAngle = angleWithVertical(knee, ankle, frameHeight);

    const currentState = this.getState(hipKneeAngle);
    this.updateSequence(currentState);

    const feedback: string[] = [];

    if (this.prevState === "s1" && currentState === "s2") {
      if (
        hipKneeAngle >= FEEDBACK_THRESH.lowerHipMin &&
        hipKneeAngle <= FEEDBACK_THRESH.lowerHipMax
      ) {
        feedback.push("Lower your hips");
      }
    }

    if (torsoAngle < FEEDBACK_THRESH.torsoForwardMin) {
      feedback.push("Bend forward slightly");
    } else if (torsoAngle > FEEDBACK_THRESH.torsoBackwardMax) {
      feedback.push("Bend backwards less");
    }

    if (kneeAnkleAngle > FEEDBACK_THRESH.kneeOverToeMax) {
      feedback.push("Knee over toes");
      this.severeFlag = true;
    }

    if (hipKneeAngle > FEEDBACK_THRESH.tooDeepMin) {
      feedback.push("Too deep");
      this.severeFlag = true;
    }

    if (currentState === "s1" && this.prevState && ["s2", "s3"].includes(this.prevState)) {
      if (isValidRepSequence(this.stateSequence) && !this.severeFlag) {
        this.correct += 1;
      } else {
        this.incorrect += 1;
      }
      this.stateSequence = [];
      this.severeFlag = false;
    }

    this.prevState = currentState;

    return {
      state: currentState,
      angles: {
        torso: torsoAngle,
        hipKnee: hipKneeAngle,
        kneeAnkle: kneeAnkleAngle
      },
      metricsText: `Torso: ${torsoAngle.toFixed(1)} | Hip-Knee: ${hipKneeAngle.toFixed(1)} | Knee-Ankle: ${kneeAnkleAngle.toFixed(1)}`,
      feedback,
      correct: this.correct,
      incorrect: this.incorrect
    };
  }

  reset(): void {
    this.correct = 0;
    this.incorrect = 0;
    this.prevState = null;
    this.stateSequence = [];
    this.severeFlag = false;
    this.inactiveSince = null;
  }
}