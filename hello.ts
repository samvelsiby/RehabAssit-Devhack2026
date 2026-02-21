import type { Point } from "../types/common";

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

/**
 * Smooth in/out easing. (No overshoot)
 */
function smoothstep(t: number): number {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}

/**
 * Creates a squat cycle with "holds" at top and bottom.
 * Returns phase in [0..1] where 0=top, 1=bottom.
 */
function squatPhase(timeSec: number): number {
    // cycle seconds
    const cycle = 2.8;

    const u = (timeSec % cycle) / cycle; // 0..1
    // Split:
    // 0.00 - 0.15 top hold
    // 0.15 - 0.55 descend
    // 0.55 - 0.70 bottom hold
    // 0.70 - 1.00 ascend
    if (u < 0.15) return 0; // top hold

    if (u < 0.55) {
        const t = (u - 0.15) / (0.55 - 0.15); // 0..1
        return smoothstep(t); // 0 -> 1
    }

    if (u < 0.7) return 1; // bottom hold

    const t = (u - 0.7) / (1.0 - 0.7); // 0..1
    return 1 - smoothstep(t); // 1 -> 0
}

function drawJoint(ctx: CanvasRenderingContext2D, p: Point, r = 4): void {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
}

function drawSegment(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
}

function drawTextPill(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    bg: string,
    fg: string
) {
    ctx.font = "13px ui-monospace, Menlo, Consolas, monospace";
    const padX = 10;
    const padY = 6;
    const w = ctx.measureText(text).width + padX * 2;
    const h = 20 + padY; // approx

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y - 16, w, h, 10);
    ctx.fill();

    ctx.fillStyle = fg;
    ctx.fillText(text, x + padX, y);
}

type DemoMode = "good" | "compare";

/**
 * Squat demo animator (side view).
 * - mode="good": only correct form
 * - mode="compare": shows correct + faint "bad" overlay for contrast
 */
export class SquatDemoAnimator {
    private ctx: CanvasRenderingContext2D;
    private rafId: number | null = null;
    private startTime = 0;

    private mode: DemoMode = "good";

    constructor(private canvas: HTMLCanvasElement) {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas context unavailable.");
        this.ctx = context;
    }

    setMode(mode: DemoMode): void {
        this.mode = mode;
    }

    start(): void {
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);

        this.startTime = performance.now();
        const loop = (timestamp: number) => {
            const t = (timestamp - this.startTime) / 1000;
            this.render(t);
            this.rafId = requestAnimationFrame(loop);
        };

        this.rafId = requestAnimationFrame(loop);
    }

    stop(): void {
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    private render(t: number): void {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Background
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.fillStyle = "#0b1324";
        this.ctx.fillRect(0, 0, w, h);

        // Ground line
        this.ctx.strokeStyle = "#334155";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(18, h - 26);
        this.ctx.lineTo(w - 18, h - 26);
        this.ctx.stroke();

        // Title
        this.ctx.fillStyle = "#9ca3af";
        this.ctx.font = "14px ui-monospace, Menlo, Consolas, monospace";
        this.ctx.fillText("Squat Demo (Side View)", 16, 20);

        // Motion phase: 0=top, 1=bottom
        const p = squatPhase(t);

        // Optional compare: draw "bad" as faint overlay behind
        if (this.mode === "compare") {
            this.drawStickSquat({
                w,
                h,
                phase: p,
                style: "bad",
                alpha: 0.25,
            });
        }

        // Draw good rep foreground
        this.drawStickSquat({
            w,
            h,
            phase: p,
            style: "good",
            alpha: 1,
        });

        // Cues
        this.drawCues(w, h, p);
    }

    private drawCues(w: number, h: number, phase: number) {
        // cue intensity based on phase
        const bottom = phase > 0.7;
        const mid = phase > 0.25 && phase <= 0.7;

        // left column cues
        drawTextPill(
            this.ctx,
            "Heels down",
            16,
            50,
            bottom || mid ? "#0f172a" : "#0b1324",
            "#e5e7eb"
        );
        drawTextPill(
            this.ctx,
            "Knees track over toes",
            16,
            80,
            bottom || mid ? "#0f172a" : "#0b1324",
            "#e5e7eb"
        );
        drawTextPill(
            this.ctx,
            "Neutral spine",
            16,
            110,
            mid || bottom ? "#0f172a" : "#0b1324",
            "#e5e7eb"
        );

        // depth cue at bottom
        if (bottom) {
            drawTextPill(this.ctx, "Pause at depth", 16, 140, "#0f172a", "#e5e7eb");
        }
    }

    private drawBodyStyle(style: "good" | "bad", alpha: number) {
        // base palette
        const good = "#e5e7eb";
        const bad = "#fb7185"; // pink/red

        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.strokeStyle = style === "good" ? good : bad;
        this.ctx.fillStyle = style === "good" ? good : bad;
        this.ctx.lineWidth = 3;
    }

    private restoreBodyStyle() {
        this.ctx.restore();
    }

    private drawStickSquat(opts: {
        w: number;
        h: number;
        phase: number;
        style: "good" | "bad";
        alpha: number;
    }) {
        const { w, h, phase, style, alpha } = opts;
        this.drawBodyStyle(style, alpha);

        // ---- Layout anchors ----
        // Put the feet on the ground, side view (one leg shown)
        const groundY = h - 26;

        // Foot base
        const toe: Point = { x: w * 0.60, y: groundY };
        const heel: Point = {
            x: w * 0.54,
            // "bad" version lifts heels at bottom
            y:
                style === "bad"
                    ? lerp(groundY, groundY - 16, smoothstep(phase)) // heel rises as you go down
                    : groundY,
        };
        const ankle: Point = { x: w * 0.56, y: groundY - 2 };

        // Knee travels slightly forward on descent (good),
        // much more forward in bad (knee over toes).
        const kneeX = style === "bad"
            ? lerp(w * 0.55, w * 0.67, smoothstep(phase))
            : lerp(w * 0.55, w * 0.61, smoothstep(phase));

        // Knee also drops a little
        const knee: Point = { x: kneeX, y: lerp(groundY - 76, groundY - 66, smoothstep(phase)) };

        // Hip goes down and back for good form.
        // Bad form: hip stays too far forward and torso leans a lot.
        const hip: Point =
            style === "bad"
                ? {
                    x: lerp(w * 0.52, w * 0.56, smoothstep(phase)),
                    y: lerp(groundY - 132, groundY - 92, smoothstep(phase)),
                }
                : {
                    x: lerp(w * 0.52, w * 0.46, smoothstep(phase)),
                    y: lerp(groundY - 132, groundY - 88, smoothstep(phase)),
                };

        // Torso: shoulder position relative to hip
        // Good: slight forward lean, stays stacked
        // Bad: excessive forward lean
        const shoulder: Point =
            style === "bad"
                ? {
                    x: lerp(hip.x - 10, hip.x + 36, smoothstep(phase)), // shoulders drift forward
                    y: hip.y - lerp(64, 56, smoothstep(phase)),
                }
                : {
                    x: lerp(hip.x - 6, hip.x + 10, smoothstep(phase)), // small forward lean
                    y: hip.y - 62,
                };

        const head: Point = { x: shoulder.x, y: shoulder.y - 22 };

        // Optional arm for clarity: hands in front
        const elbow: Point =
            style === "bad"
                ? { x: shoulder.x + 36, y: shoulder.y + 18 }
                : { x: shoulder.x + 24, y: shoulder.y + 18 };
        const hand: Point =
            style === "bad"
                ? { x: elbow.x + 30, y: elbow.y + 18 }
                : { x: elbow.x + 22, y: elbow.y + 16 };

        // ---- Draw segments ----
        // foot
        drawSegment(this.ctx, heel, toe);
        // lower leg
        drawSegment(this.ctx, ankle, knee);
        // upper leg
        drawSegment(this.ctx, knee, hip);
        // torso + neck
        drawSegment(this.ctx, hip, shoulder);
        drawSegment(this.ctx, shoulder, head);
        // arm
        drawSegment(this.ctx, shoulder, elbow);
        drawSegment(this.ctx, elbow, hand);

        // ---- Joints ----
        drawJoint(this.ctx, head, 4);
        drawJoint(this.ctx, shoulder, 4);
        drawJoint(this.ctx, hip, 4);
        drawJoint(this.ctx, knee, 4);
        drawJoint(this.ctx, ankle, 4);

        // ---- Guides (good only) ----
        if (style === "good") {
            // faint vertical guide for "stacked torso"
            this.ctx.globalAlpha = alpha * 0.25;
            this.ctx.strokeStyle = "#93c5fd";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(hip.x, hip.y - 110);
            this.ctx.lineTo(hip.x, groundY);
            this.ctx.stroke();

            // toe line to show "knee over toe" max
            this.ctx.strokeStyle = "#a7f3d0";
            this.ctx.beginPath();
            this.ctx.moveTo(toe.x, groundY);
            this.ctx.lineTo(toe.x, groundY - 120);
            this.ctx.stroke();
        }

        this.restoreBodyStyle();
    }
}