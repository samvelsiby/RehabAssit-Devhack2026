import { OFFSET_THRESH, INACTIVE_THRESH_SEC } from '@/config/exercise-thresholds';
import { angleBetweenPoints, pixelPoint, type AnalyzerResult } from '@/utils/exercise-geometry';
import type { PoseLandmark } from '@/services/mediapipe/types';

export type Side = 'left' | 'right';
export type CurlState = 's1' | 's2' | 's3';

const LANDMARK = {
    NOSE: 0,
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
} as const;

// Shin angle from vertical thresholds (degrees)
const STATE = { s1Max: 22, s2Min: 18, s2Max: 68, s3Min: 63, s3Max: 135 } as const;
const FEEDBACK = { torsoForwardMax: 20, tooDeepMin: 120 } as const;

function shinAngleDeg(knee: { x: number; y: number }, ankle: { x: number; y: number }): number {
    const dx = Math.abs(ankle.x - knee.x);
    const dy = Math.max(ankle.y - knee.y, 0.001); // ankle should be below knee
    return Math.atan2(dx, dy) * 180 / Math.PI;
}

function nowSec() { return performance.now() / 1000; }

export class HamstringCurlAnalyzer {
    private correct = 0;
    private incorrect = 0;
    private prevState: CurlState | null = null;
    private stateSeq: CurlState[] = [];
    private severeFlag = false;
    private inactiveSince: number | null = null;

    private getState(angle: number): CurlState | null {
        if (angle <= STATE.s1Max) return 's1';
        if (angle >= STATE.s2Min && angle <= STATE.s2Max) return 's2';
        if (angle >= STATE.s3Min && angle <= STATE.s3Max) return 's3';
        return null;
    }

    private updateSeq(state: CurlState | null): void {
        if (!state || state === this.prevState || !['s2', 's3'].includes(state)) return;
        if (state === 's2' && (this.stateSeq.length === 0 || this.stateSeq[this.stateSeq.length - 1] !== 's2')) {
            this.stateSeq.push('s2');
        } else if (state === 's3' && this.stateSeq.includes('s2') && this.stateSeq.length === 1) {
            this.stateSeq.push('s3');
        }
    }

    private maybeResetInactivity(): void {
        const now = nowSec();
        if (!this.inactiveSince) { this.inactiveSince = now; return; }
        if (now - this.inactiveSince >= INACTIVE_THRESH_SEC) {
            this.correct = 0; this.incorrect = 0;
            this.prevState = null; this.stateSeq = [];
            this.severeFlag = false; this.inactiveSince = now;
        }
    }

    processNoPose(): AnalyzerResult {
        this.maybeResetInactivity();
        return {
            state: null,
            angles: { torso: 0, hipKnee: 0, kneeAnkle: 0 },
            metricsText: 'Torso: 0.0 | Thigh: 0.0 | Shin: 0.0',
            feedback: ['No pose detected'],
            correct: this.correct, incorrect: this.incorrect,
        };
    }

    process(landmarks: PoseLandmark[], frameWidth: number, frameHeight: number, side: Side = 'left'): AnalyzerResult {
        this.inactiveSince = null;
        const isRight = side === 'right';

        const nose = pixelPoint(landmarks, LANDMARK.NOSE, frameWidth, frameHeight);
        const lShoulder = pixelPoint(landmarks, LANDMARK.LEFT_SHOULDER, frameWidth, frameHeight);
        const rShoulder = pixelPoint(landmarks, LANDMARK.RIGHT_SHOULDER, frameWidth, frameHeight);

        // Side-on check
        const offsetAngle = angleBetweenPoints(lShoulder, rShoulder, nose);
        if (offsetAngle > OFFSET_THRESH) {
            this.maybeResetInactivity();
            return {
                state: null, angles: { torso: 0, hipKnee: 0, kneeAnkle: 0 },
                metricsText: 'Torso: 0.0 | Thigh: 0.0 | Shin: 0.0',
                feedback: ['Turn side-on to camera'],
                correct: this.correct, incorrect: this.incorrect,
            };
        }

        const shoulder = pixelPoint(landmarks, isRight ? LANDMARK.RIGHT_SHOULDER : LANDMARK.LEFT_SHOULDER, frameWidth, frameHeight);
        const hip = pixelPoint(landmarks, isRight ? LANDMARK.RIGHT_HIP : LANDMARK.LEFT_HIP, frameWidth, frameHeight);
        const knee = pixelPoint(landmarks, isRight ? LANDMARK.RIGHT_KNEE : LANDMARK.LEFT_KNEE, frameWidth, frameHeight);
        const ankle = pixelPoint(landmarks, isRight ? LANDMARK.RIGHT_ANKLE : LANDMARK.LEFT_ANKLE, frameWidth, frameHeight);

        const shinAngle = shinAngleDeg(knee, ankle);
        const thighAngle = shinAngleDeg(hip, knee);
        const torsoAngle = Math.abs(Math.atan2(hip.x - shoulder.x, shoulder.y - hip.y) * 180 / Math.PI);

        const currentState = this.getState(shinAngle);
        this.updateSeq(currentState);

        const feedback: string[] = [];
        if (torsoAngle > FEEDBACK.torsoForwardMax) feedback.push('Keep torso upright');
        if (shinAngle > FEEDBACK.tooDeepMin) { feedback.push('Don\'t over-curl'); this.severeFlag = true; }
        if (!feedback.length && currentState === 's2') feedback.push('Curl higher');

        if (currentState === 's1' && this.prevState && ['s2', 's3'].includes(this.prevState)) {
            const valid = this.stateSeq.length >= 1 && this.stateSeq[0] === 's2';
            if (valid && !this.severeFlag) this.correct++; else this.incorrect++;
            this.stateSeq = []; this.severeFlag = false;
        }

        this.prevState = currentState;
        return {
            state: currentState,
            angles: { torso: torsoAngle, hipKnee: thighAngle, kneeAnkle: shinAngle },
            metricsText: `Torso: ${torsoAngle.toFixed(1)} | Thigh: ${thighAngle.toFixed(1)} | Shin: ${shinAngle.toFixed(1)}`,
            feedback: feedback.length ? feedback : ['Good form!'],
            correct: this.correct, incorrect: this.incorrect,
        };
    }

    reset(): void {
        this.correct = 0; this.incorrect = 0;
        this.prevState = null; this.stateSeq = [];
        this.severeFlag = false; this.inactiveSince = null;
    }
}
