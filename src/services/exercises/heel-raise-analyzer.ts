import { OFFSET_THRESH, INACTIVE_THRESH_SEC } from '@/config/exercise-thresholds';
import { angleBetweenPoints, pixelPoint, type AnalyzerResult } from '@/utils/exercise-geometry';
import type { PoseLandmark } from '@/services/mediapipe/types';

export type Side = 'left' | 'right';
export type RaiseState = 's1' | 's2' | 's3';

const LANDMARK = {
    NOSE: 0,
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
    LEFT_HEEL: 29, RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
} as const;

// heelLift as % of len(knee→ankle), positive = heel raised
const STATE = { s1Max: 6, s2Min: 4, s2Max: 22, s3Min: 18, s3Max: 80 } as const;
const FEEDBACK = { tooHighMin: 70 } as const;

function nowSec() { return performance.now() / 1000; }

export class HeelRaiseAnalyzer {
    private correct = 0;
    private incorrect = 0;
    private prevState: RaiseState | null = null;
    private stateSeq: RaiseState[] = [];
    private severeFlag = false;
    private inactiveSince: number | null = null;

    private getHeelLiftPct(
        knee: { y: number }, ankle: { y: number },
        heel: { y: number }, toe: { y: number },
    ): number {
        const legLen = Math.max(knee.y - ankle.y, 1);  // ankle is above knee in image? No: ankle below knee → positive
        // In image coords y increases downward, so ankle.y > knee.y
        const heelLift = toe.y - heel.y; // positive when heel is above toe
        return (heelLift / legLen) * 100;
    }

    private getState(pct: number): RaiseState | null {
        if (pct <= STATE.s1Max) return 's1';
        if (pct >= STATE.s2Min && pct <= STATE.s2Max) return 's2';
        if (pct >= STATE.s3Min && pct <= STATE.s3Max) return 's3';
        return null;
    }

    private updateSeq(state: RaiseState | null): void {
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
            metricsText: 'Knee: 0.0 | Ankle: 0.0 | Heel Lift: 0.0%',
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

        const offsetAngle = angleBetweenPoints(lShoulder, rShoulder, nose);
        if (offsetAngle > OFFSET_THRESH) {
            this.maybeResetInactivity();
            return {
                state: null, angles: { torso: 0, hipKnee: 0, kneeAnkle: 0 },
                metricsText: 'Knee: 0.0 | Ankle: 0.0 | Heel Lift: 0.0%',
                feedback: ['Turn side-on to camera'],
                correct: this.correct, incorrect: this.incorrect,
            };
        }

        const knee = pixelPoint(landmarks, isRight ? LANDMARK.RIGHT_KNEE : LANDMARK.LEFT_KNEE, frameWidth, frameHeight);
        const ankle = pixelPoint(landmarks, isRight ? LANDMARK.RIGHT_ANKLE : LANDMARK.LEFT_ANKLE, frameWidth, frameHeight);
        const heel = pixelPoint(landmarks, isRight ? LANDMARK.RIGHT_HEEL : LANDMARK.LEFT_HEEL, frameWidth, frameHeight);
        const toe = pixelPoint(landmarks, isRight ? LANDMARK.RIGHT_FOOT_INDEX : LANDMARK.LEFT_FOOT_INDEX, frameWidth, frameHeight);

        const heelLiftPct = this.getHeelLiftPct(knee, ankle, heel, toe);
        const currentState = this.getState(heelLiftPct);
        this.updateSeq(currentState);

        const feedback: string[] = [];
        if (heelLiftPct > FEEDBACK.tooHighMin) { feedback.push('Too high – control the movement'); this.severeFlag = true; }
        if (currentState === 's2') feedback.push('Rise higher on your toes');
        if (!feedback.length && currentState === 's1') feedback.push('Lower your heel fully');

        if (currentState === 's1' && this.prevState && ['s2', 's3'].includes(this.prevState)) {
            const valid = this.stateSeq.length >= 1 && this.stateSeq[0] === 's2';
            if (valid && !this.severeFlag) this.correct++; else this.incorrect++;
            this.stateSeq = []; this.severeFlag = false;
        }

        this.prevState = currentState;
        return {
            state: currentState,
            angles: { torso: 0, hipKnee: knee.y, kneeAnkle: ankle.y },
            metricsText: `Knee: ${knee.y.toFixed(0)} | Ankle: ${ankle.y.toFixed(0)} | Heel Lift: ${heelLiftPct.toFixed(1)}%`,
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
