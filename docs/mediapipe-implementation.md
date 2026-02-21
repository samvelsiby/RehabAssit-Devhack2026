# MediaPipe Implementation in RehabAssist

## Overview

RehabAssist uses **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision@0.10.32`) along with **MediaPipe Drawing Utils** (`@mediapipe/drawing_utils`) to perform real-time, in-browser human pose detection and rehabilitation exercise analysis. The system processes live webcam video to detect body landmarks, compute joint angles, classify exercise states, and provide immediate form feedback to the patient — **entirely client-side, with no server-side ML inference**.

---

## Package Dependencies

```json
"@mediapipe/tasks-vision": "^0.10.32",
"@mediapipe/drawing_utils": "^0.3.1675466124"
```

These are installed as runtime dependencies in `package.json`. The MediaPipe WASM binary and model files are fetched from CDN at runtime (no local bundling required).

---

## Architecture & File Map

```
src/
├── config/
│   └── exercise-thresholds.ts        ← Angle thresholds & feedback trigger values
├── utils/
│   └── exercise-geometry.ts          ← Geometry math helpers (angles, pixel conversions)
├── services/
│   ├── mediapipe/
│   │   ├── types.ts                  ← Shared TypeScript types & PoseLandmarkIndex enum
│   │   ├── pose-detector.ts          ← PoseDetector class (wraps MediaPipe PoseLandmarker)
│   │   ├── angle-calculator.ts       ← AngleCalculator utility (vector math)
│   │   ├── pose-visualizer.ts        ← PoseVisualizer (canvas drawing with DrawingUtils)
│   │   └── index.ts                  ← Re-exports public API
│   └── exercises/
│       ├── base-exercise-analyzer.ts ← Abstract base class for all analyzers
│       ├── squat-analyzer.ts         ← Full squat form analyzer
│       ├── mini-squat-analyzer.ts    ← Mini-squat rep counter + feedback engine
│       ├── exercise-factory.ts       ← Factory to instantiate the correct analyzer
│       └── index.ts                  ← Re-exports
├── hooks/
│   ├── usePoseAnalysis.ts            ← React hook for general pose analysis (squats)
│   └── useMiniSquatAnalysis.ts       ← React hook for mini-squat session management
└── pages/
    └── ExerciseSession.tsx           ← UI page that wires camera + canvas + hooks together
```

---

## Layer-by-Layer Explanation

### 1. Types (`src/services/mediapipe/types.ts`)

Defines the core data structures shared across every component:

| Type | Purpose |
|------|---------|
| `PoseLandmark` | A single detected body point: `{ x, y, z, visibility? }` (normalized 0–1) |
| `PoseDetectionResult` | Result of one detection frame: `{ landmarks[], worldLandmarks[], timestamp }` |
| `ExerciseMetrics` | Computed output: `formScore`, `kneeAngle`, `hipAngle`, `depth`, `alignment`, `errors[]`, `recommendations[]` |
| `RepData` | Per-rep recording: scores and errors stamped with a timestamp |
| `PoseLandmarkIndex` (enum) | Named constants 0–32 mapping index numbers to body parts (e.g., `LEFT_KNEE = 25`) |

---

### 2. Pose Detector (`src/services/mediapipe/pose-detector.ts`)

This is the **MediaPipe integration point** — the single class that owns the `PoseLandmarker` instance.

#### Initialization

```ts
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
);

this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    delegate: 'GPU'
  },
  runningMode: 'VIDEO',
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
});
```

**Key decisions:**
- **`FilesetResolver`** downloads the WASM binary from jsDelivr CDN on first call — no build-time bundling needed.
- **`pose_landmarker_lite`** model is used (vs. `full` or `heavy`) for real-time performance in a browser.
- **`delegate: 'GPU'`** routes inference to WebGL for speed; falls back to CPU if unavailable.
- **`runningMode: 'VIDEO'`** enables temporal tracking between frames, which is more accurate than treating each frame independently.
- **Confidence thresholds** are set to `0.5` for detection, presence, and tracking — balancing accuracy vs. responsiveness.

#### Per-Frame Detection

```ts
async detectPose(video: HTMLVideoElement, timestamp: number): Promise<PoseDetectionResult | null>
```

- Guards against calling before `video.readyState === 4` (HAVE_ENOUGH_DATA).
- Calls `poseLandmarker.detectForVideo(video, timestamp)` — the MediaPipe API that processes one frame.
- Returns normalized `landmarks` (relative to video frame, 0–1) and `worldLandmarks` (metric coordinates in 3D space).
- A singleton instance `poseDetector` is exported so all React hooks share one initialized detector.

#### Cleanup

```ts
destroy(): void  // closes the PoseLandmarker and resets initialization state
```

---

### 3. Angle Calculator (`src/services/mediapipe/angle-calculator.ts`)

A **static utility class** that provides pure geometry functions on `PoseLandmark` data:

| Method | Description |
|--------|-------------|
| `calculateAngle(point1, vertex, point2)` | Returns the angle (degrees) at `vertex` formed by the two vectors to `point1` and `point2`. Uses dot-product formula with `Math.acos`. |
| `calculateDistance(p1, p2)` | Euclidean 3D distance between two landmarks. Used for leg length normalization in squat depth. |
| `calculateVerticalPosition(landmark)` | Returns `landmark.y` (normalized vertical, 0 = top of frame). |
| `calculateHorizontalAlignment(left, right)` | Percentage score (0–100) measuring how centered the midpoint of two landmarks is in the frame. Used for stability scoring. |

---

### 4. Pose Visualizer (`src/services/mediapipe/pose-visualizer.ts`)

Wraps **`DrawingUtils`** from `@mediapipe/drawing_utils` to render the skeleton overlay on a `<canvas>` element.

```ts
const drawingUtils = new DrawingUtils(ctx);

// Dots on each landmark
drawingUtils.drawLandmarks(landmarks, { radius: 4, color: '#00D4AA', fillColor: '#00D4AA' });

// Lines connecting joints
drawingUtils.drawConnectors(landmarks, [
  [11, 12], [11, 23], [12, 24], [23, 24],  // Torso
  [11, 13], [13, 15], [12, 14], [14, 16],  // Arms
  [23, 25], [25, 27], [24, 26], [26, 28]   // Legs
], { color: '#00D4AA', lineWidth: 2 });
```

Key joints (knees, indices 25 & 26) are additionally highlighted in **gold** (`#FFD700`) using custom `arc()` calls, since they are the most clinically relevant for squat exercises.

> **Note:** `PoseVisualizer` is used by the general `usePoseAnalysis` hook. The `useMiniSquatAnalysis` hook draws its own canvas overlay manually (no `DrawingUtils`) for full control over styling.

---

### 5. Exercise Analyzers

#### Base Class (`base-exercise-analyzer.ts`)

An abstract class all analyzers extend from. Provides:

- **`isLandmarkVisible(landmark)`** — checks `visibility >= 0.5` before using a landmark in math.
- **`calculateFormScore({ angles, alignment, depth, stability })`** — weighted average:
  - `angles × 0.4` + `alignment × 0.3` + `depth × 0.2` + `stability × 0.1`
- **`generateRecommendations(errors[])`** — maps error codes to plain-English strings.
- **`abstract analyzePose(landmarks[]): ExerciseMetrics`** — must be implemented by each subclass.

---

#### Squat Analyzer (`squat-analyzer.ts`)

Used for **full squat** tracking. Analyzes bilateral (both legs) form in each frame.

**Metrics computed per frame:**

| Metric | Landmarks Used | What It Detects |
|--------|---------------|----------------|
| `kneeAngle` | Hip → Knee → Ankle | Degree of knee flexion; checks against ideal range 80°–110° |
| `hipAngle` | Shoulder midpoint, hip midpoint, vertical | Torso lean angle; flags `forward_lean` if < 60° |
| `depth` | Hip vs knee height, normalized by leg length | How far down the squat goes (min 15% threshold) |
| `alignment` | X-difference between knee and ankle on each side | Whether knees track over toes; flags `knee_misalignment` if < 70% |
| `stability` | Horizontal alignment of shoulders and hips | Flags `unstable` if averaged score < 80 |

**Error codes generated:** `pose_not_visible`, `insufficient_depth`, `excessive_depth`, `knee_misalignment`, `forward_lean`, `unstable`

---

#### Mini Squat Analyzer (`mini-squat-analyzer.ts`)

Purpose-built for the **clinical mini-squat** exercise (partial squat, typically 0°–30° knee flexion used in early-stage rehabilitation). It operates as a **state machine** and supports **side-specific analysis** (left or right leg facing the camera).

##### State Machine

The hip-knee angle with the vertical is used to classify the patient's position into three states:

| State | Hip-Knee Angle (with vertical) | Meaning |
|-------|-------------------------------|---------|
| `s1` | ≤ 40° | Standing upright |
| `s2` | 30° – 78° | Lowering / partial squat |
| `s3` | 79° – 125° | Deep squat position |

A **valid rep sequence** requires the state to pass through: `s2 → s3 → s2` (going down and coming back up). Partial sequences like just `s2` (shallow) or `s2 → s3` (went down but didn't return) are also recognized.

##### Rep Counting Logic

```
s1 (standing) → s2 (lowering) → s3 (deep) → s2 (returning) → s1 (standing)
                                                               ↑
                                              Rep counted here (return to s1)
```

- If the state sequence was valid AND no `severeFlag` was raised → `correct++`
- Otherwise → `incorrect++`
- `severeFlag` is raised by: kneeAnkleAngle > 42° ("knee over toes") OR hipKneeAngle > 130° ("too deep")

##### Offset / Camera Alignment Check

Before computing any angles, the analyzer checks if the patient is standing **side-on** to the camera:

```ts
const offsetAngle = angleBetweenPoints(leftShoulder, rightShoulder, nose);
if (offsetAngle > OFFSET_THRESH /* 45° */) {
  return feedback: ["Turn side-on to camera"];
}
```

If the shoulders span a wide angle with respect to the nose, the patient is facing forward (not sideways), and the 2D side-view geometry used for angle computation would be invalid.

##### Inactivity Reset

If no pose is detected for `INACTIVE_THRESH_SEC = 15` seconds, all counters, state, and sequences are reset automatically.

##### Geometry Helpers Used

From `src/utils/exercise-geometry.ts`:
- **`pixelPoint(landmarks, index, width, height)`** — converts normalized landmark to pixel coordinates for the current canvas size.
- **`angleWithVertical(top, pivot, frameHeight)`** — computes the angle a limb segment makes with the vertical axis. This is the key measurement since mini-squat depth is best measured laterally.
- **`angleBetweenPoints(p1, p2, pRef)`** — general angle at `pRef` between vectors to `p1` and `p2`.

##### Thresholds (`src/config/exercise-thresholds.ts`)

```ts
STATE_THRESH = {
  s1Max: 40.0,   // Standing
  s2Min: 30.0, s2Max: 78.0,   // Lowering
  s3Min: 79.0, s3Max: 125.0   // Deep
}

FEEDBACK_THRESH = {
  torsoForwardMin: 15.0,   // Flags "Bend forward slightly"
  torsoBackwardMax: 55.0,  // Flags "Bend backwards less"
  lowerHipMin: 55.0,       // Range to say "Lower your hips"
  lowerHipMax: 90.0,
  kneeOverToeMax: 42.0,    // Flags "Knee over toes" (severe)
  tooDeepMin: 130.0        // Flags "Too deep" (severe)
}

OFFSET_THRESH = 45.0       // Camera side-on check
INACTIVE_THRESH_SEC = 15   // Auto-reset after 15 seconds of no pose
```

---

#### Exercise Factory (`exercise-factory.ts`)

A factory pattern that decouples the hook from knowing which analyzer to instantiate:

```ts
ExerciseFactory.createAnalyzer("squat")           // → SquatAnalyzer
ExerciseFactory.createAnalyzer("mini squat")      // → SquatAnalyzer (name contains "squat")
ExerciseFactory.isSupported("squat")              // → true
ExerciseFactory.getSupportedExercises()           // → ['squat']
```

`lunge`, `pushup`, and `plank` will throw `Error: X analyzer not yet implemented` — they're scaffolded but not built.

---

### 6. React Hooks

#### `usePoseAnalysis` (General Squat Hook)

Manages the full analysis lifecycle for exercises that use `SquatAnalyzer`:

| Returned Value | Type | Description |
|---------------|------|-------------|
| `initialize()` | `async fn` | Initializes MediaPipe and creates analyzer via factory |
| `startAnalysis(video)` | `fn` | Starts the `requestAnimationFrame` loop |
| `stopAnalysis()` | `fn` | Cancels loop |
| `resetAnalysis()` | `fn` | Resets rep counters and metrics |
| `isInitialized` | `boolean` | True after MediaPipe is ready |
| `isAnalyzing` | `boolean` | True while analysis loop is running |
| `currentMetrics` | `ExerciseMetrics \| null` | Latest frame's computed metrics |
| `currentRep` | `number` | Reps counted so far |
| `reps` | `RepData[]` | Full history of all reps |
| `error` | `string \| null` | Error message if init fails |

**Rep detection logic:**
- Maintains a rolling buffer of the last 10 `depth` readings.
- A **state machine** (`up` → `down` → `transitioning` → `up`) detects the depth crossing thresholds:
  - Depth > 15% → transitions to `down`
  - Depth < 8% while `down` → rep is completed, state returns to `up`
- Throttled to **10 FPS** (`now - lastTime < 100ms`) to avoid overloading the browser.

#### `useMiniSquatAnalysis` (Mini Squat Hook)

Manages the mini-squat-specific session:

| What It Does | How |
|---|---|
| Initializes MediaPipe | Calls `poseDetector.initialize()` |
| Runs `requestAnimationFrame` loop | Every ~100ms, calls `poseDetector.detectPose()` |
| Draws skeleton overlay | Calls `drawPoseOverlay()` — a custom canvas draw function (no `DrawingUtils`) |
| Passes landmarks to analyzer | Calls `MiniSquatAnalyzer.process(landmarks, width, height, side)` |
| Surfaces result to caller | Calls `onResultUpdate(analyzerResult)` callback |
| Cleanup | Calls `poseDetector.destroy()` and cancels animation frame on unmount |

**Canvas overlay drawn by the hook:**
- Connections: torso, arms, legs (same landmark pairs as `PoseVisualizer`)
- All landmarks drawn as small white dots with green stroke
- **Hips (23, 24) and Knees (25, 26)** drawn larger in gold with orange stroke (key diagnostic joints)
- Text overlay: "POSE DETECTED" + landmark count (helpful for debugging)

---

### 7. UI: `ExerciseSession.tsx` (Page)

This is the page at the `/exercise-session?assignmentId=...` route that ties everything together.

**Data flow:**

```
Webcam (getUserMedia)
    ↓
<video> element (autoPlay, muted)
    ↓
useMiniSquatAnalysis hook
    ├── poseDetector.detectPose(video, timestamp)   ← MediaPipe
    ├── drawPoseOverlay(landmarks, canvas, video)    ← Canvas rendering
    └── MiniSquatAnalyzer.process(landmarks, ...)   ← Rep counting + feedback
         ↓
setCurrentResult(analyzerResult)
    ↓
UI displays: State / Correct Reps / Incorrect Reps / Metrics / Live Feedback
```

**Camera setup:**
```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: "user", width: 960, height: 540 }
});
videoRef.current.srcObject = stream;
```

**Canvas overlay:** A `<canvas>` element is absolutely positioned over the `<video>`, matching its size. When a pose is detected, the skeleton is drawn on the canvas each frame.

**Session logging:** Every 5 correct reps triggers a Supabase DB write via `logSession.mutate(...)`, recording the set to the `session_logs` table.

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────┐
│                    ExerciseSession.tsx                   │
│  Camera → <video> + <canvas>                            │
│  useMiniSquatAnalysis hook wires it all together        │
└────────────────┬────────────────────────────────────────┘
                 │ calls
                 ▼
┌─────────────────────────────────────────────────────────┐
│           useMiniSquatAnalysis (React Hook)              │
│  - requestAnimationFrame loop (throttled to 10 FPS)     │
│  - Calls poseDetector.detectPose every ~100ms           │
│  - Draws skeleton on canvas                             │
│  - Passes landmarks to MiniSquatAnalyzer                │
└──────┬──────────────────────────┬────────────────────────┘
       │                          │
       ▼                          ▼
┌──────────────┐        ┌─────────────────────────┐
│ PoseDetector │        │   MiniSquatAnalyzer      │
│              │        │                          │
│ MediaPipe    │        │ • State machine (s1/s2/s3)│
│ PoseLandmarker        │ • Torso/hip/knee angles  │
│ detectForVideo│       │ • Offset (side-on) check │
│              │        │ • Rep counting           │
│ Returns 33   │        │ • Live feedback strings  │
│ landmarks    │        │                          │
└──────────────┘        └─────────────────────────┘
       │                          │
       │ PoseLandmark[]           │ AnalyzerResult
       └──────────────────────────┘
                    ↓
          setCurrentResult() → UI updates
```

---

## Adding a New Exercise

1. **Create `src/services/exercises/lunge-analyzer.ts`** extending `BaseExerciseAnalyzer`, implementing `analyzePose(landmarks[]): ExerciseMetrics`.
2. **Register it in `exercise-factory.ts`** — add a `case 'lunge': return new LungeAnalyzer();`.
3. **Use in a hook** — either extend `usePoseAnalysis` (which already uses the factory) or create a dedicated hook like `useMiniSquatAnalysis`.
4. **Add thresholds** to `exercise-thresholds.ts` for any angle-based rules.

---

## Known Limitations & Notes

- **GPU delegate on Safari/iOS** may fall back to CPU — the initialization error is caught and rethrown with a human-readable message.
- **`runningMode: 'VIDEO'`** requires timestamps to be monotonically increasing; passing `performance.now()` satisfies this.
- **`pose_landmarker_lite` model** provides 33 landmarks but with lower accuracy on occluded joints compared to `pose_landmarker_full`. Suitable for real-time rehab use cases.
- `PoseVisualizer` (`pose-visualizer.ts`) exists for the general squat flow but is not currently wired into the UI — the mini-squat hook draws the canvas manually. This is intentional to give fine-grained control over which joints are highlighted.
- The `MiniSquatAnalyzer` is **side-aware**: it selects left or right shoulder/hip/knee/ankle based on the `side` prop, since the side-view geometry assumes the patient is perpendicular to the camera.
