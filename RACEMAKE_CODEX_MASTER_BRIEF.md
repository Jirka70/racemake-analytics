# RACEMAKE Product Engineer Challenge — HARD
## Master implementation brief for Codex

> Purpose: give a Codex coding agent enough authoritative context, technical constraints, architecture, algorithms, acceptance criteria, and working rules to design and implement a strong submission without hard-coding the supplied stint.

---

## 1. Mission

Build a small, maintainable **Bun + Hono service in TypeScript** that accepts a raw motorsport telemetry stint and produces a defensible race-engineering analysis:

1. validate and normalize the wire data;
2. detect and report bad or suspicious telemetry;
3. identify complete, real racing laps and calculate their times;
4. align laps by normalized track position;
5. infer a track-level corner model from repeatable steering shape;
6. divide each corner into entry, estimated apex zone, and exit;
7. compare the worst real lap with the best real lap;
8. localize where time was lost;
9. explain the loss only with evidence supported by the available signals;
10. produce a short, numerical, traceable race-engineer radio call.

The implementation must be **deterministic, data-derived, testable, and explainable**. Do not hard-code lap numbers, corner positions, expected anomaly locations, final findings, or the supplied dataset's output.

A later phase may add a visualization. Do not build the UI in phase 1, but make the API and internal DTOs visualization-ready.

---

## 2. Authoritative sources

The only authoritative challenge materials are:

- Official Gist: `https://gist.github.com/743milan/bf57fa0020b19efacf4d845590291a17`
- `BRIEF-HARD.md` in that Gist
- `recorder.rs` in that Gist
- Telemetry file linked by the brief: `stint.telemetry.json`

Treat comments below the Gist as **non-authoritative candidate submissions**. Do not copy their claimed lap counts, anomalies, corner locations, or findings. Compute everything independently.

If local challenge files exist in the repository, read them before writing implementation code. If the telemetry JSON is missing, continue with architecture and synthetic tests, but do not invent actual stint results or a sample output.

### Faithful summary of the official brief

The official task asks for a small Bun + Hono TypeScript service that turns an untrusted, irregularly sampled telemetry stream into a race engineer's read on a stint. The minimum expected result is:

- read the Rust recorder and discover the misleading wire field;
- clean the stream and defend which laps are real and clean;
- discover corners without provided sectors or corner coordinates;
- detect flat/lift corners as well as braking corners;
- treat corners as track properties rather than driver-dependent events;
- avoid defining the apex from the driver's minimum speed;
- find the real lap that cost the most relative to the best lap;
- localize the loss and explain it using only supported telemetry evidence;
- justify every chosen threshold;
- generate a concise, numerical, grounded radio message;
- provide maintainable code and sample output;
- be ready to walk through and defend all code, including AI-generated code.

### Important scope correction

The current official brief does **not** mandate exact HTTP endpoint names or response schemas. The API contract below is our design choice:

- `POST /ingest`
- `GET /laps`
- `GET /analysis`

Do not describe these endpoint names as official RACEMAKE requirements. They are a clear interface selected for this implementation.

---

## 3. Facts established by `recorder.rs`

The raw frame contract is:

```ts
export interface RawTelemetryFrame {
  ts: number;
  lap: number;
  pos: number;
  spd: number;
  thr: number;
  brk: number;
  str: number;
  gear: number;
  rpm: number;
  tyres: {
    fl: number;
    fr: number;
    rl: number;
    rr: number;
  };
}
```

Field meanings:

| Field | Meaning | Unit / range |
|---|---|---|
| `ts` | time since recording began | milliseconds |
| `lap` | recorder/game lap number | signed integer; verify rather than blindly trust |
| `pos` | normalized lap position | nominally `0.0..1.0` |
| `spd` | vehicle speed | km/h |
| `thr` | throttle pedal | nominally `0.0..1.0` |
| `brk` | brake pedal | nominally `0.0..1.0` |
| `str` | steering angle | degrees; negative means left |
| `gear` | selected gear | `-1` reverse, `0` neutral, `1..8` forward |
| `rpm` | engine speed | revolutions per minute |
| `tyres.*` | tyre core temperatures on the wire | fixed-point tenths of °C |

The misleading field is tyre temperature. Normalize it before analysis:

```ts
const tyreTemperatureC = rawTyreTemperature / 10;
```

Keep raw and normalized representations separate. Never overwrite the raw input silently.

---

## 4. Proposed technology stack

### Required core

- **Runtime and package manager:** Bun
- **Language:** TypeScript with `strict: true`
- **HTTP framework:** Hono
- **Validation:** Zod
- **Tests:** `bun:test`
- **Type checking:** TypeScript compiler with `noEmit`
- **Formatting/linting:** Biome
- **Storage:** in-memory only for phase 1
- **Hashing:** SHA-256 from a runtime-provided crypto API

### Deliberately excluded from phase 1

- database;
- authentication;
- queue or background workers;
- Rust implementation;
- external Python analytics process;
- LLM dependency for core analysis;
- frontend;
- fake 2D circuit map;
- manually annotated corner positions.

### Suggested package scripts

```json
{
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write .",
    "analyze:data": "bun scripts/analyze-data.ts"
  }
}
```

Pin installed package versions in `bun.lock`; do not depend on floating versions.

---

## 5. Suggested repository structure

Keep the analytics core independent of Hono so it can be tested directly and later reused by a UI or worker.

```text
.
├── AGENTS.md
├── CODEX_TASK.md
├── README.md
├── DESIGN.md
├── DATA_AUDIT.md
├── ASSUMPTIONS.md
├── package.json
├── tsconfig.json
├── biome.json
├── data/
│   └── stint.telemetry.json        # local challenge input; consider gitignore
├── artifacts/
│   ├── sample-output.json
│   └── diagnostics.json
├── scripts/
│   └── analyze-data.ts
├── src/
│   ├── index.ts
│   ├── app.ts
│   ├── config.ts
│   ├── contracts/
│   │   ├── raw-telemetry.ts
│   │   ├── normalized-telemetry.ts
│   │   └── api.ts
│   ├── schemas/
│   │   └── telemetry.ts
│   ├── store/
│   │   └── dataset-store.ts
│   ├── processing/
│   │   ├── normalize.ts
│   │   ├── audit.ts
│   │   ├── clean.ts
│   │   ├── laps.ts
│   │   ├── interpolate.ts
│   │   ├── resample.ts
│   │   ├── aggregate-track.ts
│   │   ├── smoothing.ts
│   │   ├── adaptive-threshold.ts
│   │   ├── corners.ts
│   │   ├── phases.ts
│   │   ├── time-delta.ts
│   │   ├── corner-metrics.ts
│   │   ├── findings.ts
│   │   ├── confidence.ts
│   │   └── coaching.ts
│   └── routes/
│       ├── health.ts
│       ├── ingest.ts
│       ├── laps.ts
│       ├── analysis.ts
│       └── diagnostics.ts          # optional but useful
└── tests/
    ├── fixtures/
    ├── unit/
    └── integration/
```

Do not split tiny functions into files merely to match this tree. Prefer cohesive modules and maintainable boundaries over file-count ceremony.

---

## 6. Proposed API contract

### 6.1 `POST /ingest`

Purpose:

- receive raw telemetry;
- validate and normalize it;
- compute a content-derived dataset ID;
- use an in-memory cache when the same canonical dataset was already processed;
- execute the full processing pipeline on a cache miss;
- atomically activate the successfully processed dataset;
- return a compact ingest summary.

Accept the actual JSON root shape used by `stint.telemetry.json`. If low cost, accept both:

```json
[/* frames */]
```

and:

```json
{ "frames": [/* frames */] }
```

Internally normalize both forms to one array.

Suggested response:

```json
{
  "datasetId": "sha256:...",
  "cacheHit": false,
  "receivedFrames": 0,
  "acceptedFrames": 0,
  "rejectedFrames": 0,
  "suspectFrames": 0,
  "completeLaps": 0,
  "detectedCorners": 0,
  "warnings": []
}
```

Suggested status behavior:

- `200` successful ingest, including cache hits;
- `400` malformed JSON;
- `422` structurally invalid or unprocessable telemetry;
- `500` unexpected internal failure.

A failed ingest must not replace the previously active valid dataset.

### 6.2 Idempotence and cache semantics

Processing must be deterministic even without cache. The cache is an optimization and a stable dataset identity, not the source of idempotence.

Canonicalize validated raw frames in a fixed property order while preserving array order, because frame order is semantically meaningful. A practical canonical representation is an array of tuples:

```ts
[
  ts,
  lap,
  pos,
  spd,
  thr,
  brk,
  str,
  gear,
  rpm,
  tyres.fl,
  tyres.fr,
  tyres.rl,
  tyres.rr,
]
```

Hash the canonical sequence with SHA-256. Do not depend on arbitrary JSON object key ordering.

Use:

```ts
Map<DatasetId, ProcessedDataset>
```

plus:

```ts
activeDatasetId: DatasetId | null
```

Expected sequence:

```text
POST A -> process A, cache miss, activate A
POST A -> cache hit, activate existing A, identical derived output
POST B -> process B, activate B
POST A -> cache hit, reactivate A
```

For a production multi-user system, dataset-scoped routes would be safer. For the challenge, support an optional `datasetId` query parameter while defaulting to the active dataset:

```text
GET /laps?datasetId=...
GET /analysis?datasetId=...
```

### 6.3 `GET /laps`

Return only defensible complete racing laps plus cleaning metadata. Do not include partial opening/closing laps as normal laps.

Suggested shape:

```json
{
  "datasetId": "sha256:...",
  "laps": [
    {
      "lapNumber": 0,
      "startTsMs": 0,
      "endTsMs": 0,
      "lapTimeMs": 0,
      "frameCount": 0,
      "coverage": 0,
      "averageSpeedKmh": 0,
      "maximumSpeedKmh": 0,
      "quality": {
        "complete": true,
        "confidence": 0,
        "issues": []
      }
    }
  ],
  "excludedLaps": []
}
```

Before any successful ingest, return `409 Conflict` with a stable error code.

### 6.4 `GET /analysis`

Return:

- best and worst complete lap;
- detected track corners and phases;
- threshold derivation diagnostics;
- cumulative time-delta series;
- loss by corner and phase;
- grounded findings;
- confidence and limitations;
- engineer radio call;
- optional visualization-ready series.

Suggested high-level shape:

```json
{
  "datasetId": "sha256:...",
  "bestLap": {},
  "worstLap": {},
  "lapTimeDifferenceMs": 0,
  "trackModel": {
    "cornerCount": 0,
    "corners": [],
    "thresholds": {},
    "limitations": []
  },
  "timeLoss": {
    "primaryRegion": {},
    "byCorner": [],
    "deltaCurve": []
  },
  "findings": [],
  "radioCall": {
    "text": "",
    "claimIds": [],
    "confidence": 0
  }
}
```

### 6.5 Optional endpoints

- `GET /health` — no dataset required.
- `GET /diagnostics` — cleaning report, threshold derivation, sampling statistics, and algorithm diagnostics.

Diagnostics are useful in this challenge because they make threshold choices and rejected data auditable.

---

## 7. Core processing pipeline

Implement the pipeline as pure functions where practical:

```text
raw request
  -> parse and schema validation
  -> wire-unit normalization
  -> stream audit
  -> cleaning / rejection report
  -> lap boundary and completeness detection
  -> complete-lap summaries
  -> position-domain resampling
  -> representative track steering profile
  -> smoothing and adaptive threshold derivation
  -> corner segmentation
  -> entry / apex-zone / exit phases
  -> best-vs-worst elapsed-time delta
  -> corner and phase metrics
  -> grounded finding classification
  -> confidence calculation
  -> deterministic engineer radio call
  -> immutable ProcessedDataset
```

Do not bury analytics logic inside HTTP route handlers.

---

## 8. Validation and normalization

### 8.1 Structural validation

At minimum require:

- all expected keys;
- finite numeric values;
- `ts` non-negative and representable as an integer millisecond timestamp;
- `lap` integer;
- `pos`, `thr`, and `brk` close to their documented ranges;
- `gear` integer;
- all four tyre values present.

Do not silently clamp large invalid values into valid ranges. Flag or reject them with a reason.

### 8.2 Normalized frame

Use a distinct type:

```ts
export interface NormalizedTelemetryFrame {
  sourceIndex: number;
  tsMs: number;
  lapNumber: number;
  position: number;
  speedKmh: number;
  throttle: number;
  brake: number;
  steeringDeg: number;
  gear: number;
  rpm: number;
  tyreTempC: {
    frontLeft: number;
    frontRight: number;
    rearLeft: number;
    rearRight: number;
  };
}
```

Record every normalization step in documentation. Tyre scaling is mandatory and should have a dedicated unit test.

---

## 9. Treat the telemetry as untrusted

Build an audit report before deriving laps or corners.

### 9.1 Detect and report

- non-finite values;
- documented range violations;
- exact duplicate frames;
- repeated timestamps;
- timestamp regressions;
- non-positive local time deltas;
- impossible or extreme speed/RPM outliers;
- sudden position jumps not explained by a lap wrap;
- large sampling gaps;
- long stationary tails;
- contradictory lap-number and position-wrap behavior;
- large isolated sensor spikes;
- incomplete opening and closing fragments.

### 9.2 Rejected versus suspect

Use at least two classifications:

- `rejected`: unsafe to compute through;
- `suspect`: retained but reduces confidence or is excluded from selected calculations.

Every issue should have a stable code and evidence:

```ts
interface ProcessingIssue {
  severity: "warning" | "rejected";
  code: string;
  sourceIndex?: number;
  tsMs?: number;
  lapNumber?: number;
  message: string;
  observed?: Record<string, number | string | boolean>;
}
```

Do not silently delete data.

### 9.3 Outlier strategy

Use a combination of:

1. broad domain guardrails;
2. robust distribution checks such as median/MAD;
3. local continuity checks against neighboring frames;
4. cross-signal plausibility where useful.

Avoid a single dataset-specific magic cutoff. Keep all policy parameters in typed configuration and emit their values in diagnostics.

An isolated rejected frame may be bridged later only when the resulting interpolation gap is small enough. Never interpolate across an arbitrarily large missing region.

---

## 10. Lap detection and lap timing

Do not trust only the `lap` field. Use it as evidence alongside position and time continuity.

### 10.1 Detect start/finish wraps

A normal lap transition contains a large negative position change near:

```text
position near 1.0 -> position near 0.0
```

Validate a wrap against:

- increasing timestamp;
- plausible neighboring speeds;
- lap-number behavior;
- absence of a large data corruption jump.

Treat the track as circular.

### 10.2 Define a real complete racing lap

A complete lap should have, at minimum:

- both a defensible start and finish crossing;
- near-complete position coverage;
- sufficient sample support;
- acceptable timestamp and position continuity;
- actual vehicle movement;
- no dominant pit/stationary tail;
- no unrecoverable gap or anomaly that invalidates lap time.

Do not hard-code expected lap numbers. Opening and closing partial fragments should be reported separately.

### 10.3 Lap time

Prefer crossing-to-crossing time. Where a crossing lies between samples, estimate the crossing timestamp using local linear interpolation in unwrapped position space.

Do not compute lap time from frame count or an assumed sampling rate.

### 10.4 Quality and confidence

For each lap report:

- coverage;
- frame count;
- sampling interval statistics;
- missing-gap statistics;
- rejected/suspect frame counts;
- completion confidence;
- inclusion/exclusion reason.

---

## 11. Resampling laps onto a shared position grid

Different laps are sampled at different times and positions. Compare the same track position, not the same array index.

### 11.1 Grid

Create a normalized grid over `[0, 1]`. Choose its size from the data or use a documented default that does not claim to create information beyond the source sampling.

A reasonable strategy is:

- estimate the median clean samples per complete lap;
- choose a grid size within documented lower/upper bounds;
- report the chosen size and effective position step.

### 11.2 Linear interpolation

Use linear interpolation for continuous signals:

- elapsed time / timestamp;
- speed;
- throttle;
- brake;
- steering;
- RPM;
- tyre temperatures.

Use step or nearest-neighbor interpolation for `gear`.

For two points `(x0, y0)` and `(x1, y1)`:

```ts
const ratio = (x - x0) / (x1 - x0);
const y = y0 + ratio * (y1 - y0);
```

### 11.3 Safety rules

- split laps before interpolation;
- never interpolate across the `1 -> 0` wrap as if it were a normal line segment;
- do not extrapolate outside observed coverage;
- handle duplicate positions explicitly;
- derive a maximum allowed interpolation gap from typical clean position spacing;
- mark unsupported grid points as missing rather than inventing data;
- keep interpolation deterministic.

### 11.4 Time at position

Store elapsed lap time at every supported grid position. This is the basis of cumulative time delta:

```ts
elapsedMsAtPosition(lap, position)
```

---

## 12. Build a driver-robust track profile

Corner detection must be based primarily on **track position plus repeatable steering shape**, not brake input or speed minima.

For every grid position:

- collect signed steering from every clean complete lap that supports that position;
- calculate the median signed steering;
- calculate steering MAD or another robust dispersion measure;
- store support count and support fraction.

Example:

```ts
interface TrackProfilePoint {
  position: number;
  medianSteeringDeg: number;
  steeringMadDeg: number;
  lapSupport: number;
  smoothedSteeringDeg: number;
  steeringStrength: number;
}
```

Why median:

- one abnormal correction affects it less than a mean;
- different driving styles can change magnitude while a repeated direction/shape remains visible;
- it helps turn multiple driver traces into one representative track-level profile.

This remains a **proxy** for track shape, not a true geometric reconstruction. Steering is still a driver input. State that limitation clearly.

---

## 13. Smoothing

Do not segment raw steering directly.

Use a transparent deterministic smoothing pipeline, for example:

1. small median filter to remove isolated spikes;
2. centered weighted or triangular moving average to reduce high-frequency corrections while preserving broad peaks.

Derive window size as a fraction of the position grid and constrain it by source sampling resolution. Keep it in configuration and output it in diagnostics.

The track is circular. Use circular padding for the representative track profile so smoothing near `0/1` is not biased by artificial boundaries.

Do not use a high-order spline that creates unsupported overshoot.

---

## 14. Derive steering thresholds from each dataset

Do not use a universal physical rule such as `abs(steering) > 3 degrees`.

The concrete threshold must be derived during ingest from the processed stint. The algorithm itself belongs in code.

### 14.1 Steering strength

Use:

```ts
strength = Math.abs(smoothedSteeringDeg - estimatedZeroOffsetDeg);
```

If a zero-offset correction is implemented, derive and report it; otherwise use the recorder-defined zero and document that assumption.

### 14.2 Recommended deterministic strategy

Use an adaptive two-regime threshold:

1. transform strength with `log1p` to reduce domination by large steering peaks;
2. compute a one-dimensional Otsu threshold separating low-steering and high-steering regions;
3. transform the threshold back to steering units;
4. validate that the split has useful separation;
5. if separation is poor, fall back to a robust straight-noise estimate from the lower part of the distribution.

Fallback example:

```text
lower band = lowest 35–40% of strength values
baseline = median(lower band)
noise = 1.4826 * MAD(lower band)
enter = baseline + K_enter * noise
exit = baseline + K_exit * noise
```

`K_enter` and `K_exit` remain algorithm parameters, but the resulting steering values are data-derived rather than fixed degrees. Keep them in config, test sensitivity, and report them.

Use hysteresis:

```text
enter corner at the higher threshold
exit corner at the lower threshold
```

Suggested output:

```ts
interface ThresholdDiagnostics {
  method: "otsu-log-strength" | "lower-band-mad-fallback";
  baselineDeg: number;
  enterDeg: number;
  exitDeg: number;
  distribution: {
    q10: number;
    q25: number;
    q50: number;
    q75: number;
    q90: number;
  };
  separationScore?: number;
}
```

### 14.3 Threshold alone is insufficient

A corner candidate also needs:

- persistence over a meaningful position span;
- consistent steering direction;
- support from multiple laps;
- no unrecoverable gap;
- a reasonable signal-to-noise ratio.

This prevents a brief steering correction from becoming a corner.

---

## 15. Corner segmentation

### 15.1 Hysteresis state machine

Walk the circular smoothed profile:

- outside a corner: open a segment after strength crosses the enter threshold and persists;
- inside a corner: keep it open until strength remains below the exit threshold long enough;
- support wrap-around segments crossing `1.0 -> 0.0`.

### 15.2 Minimum persistence

Derive minimum persistence from grid resolution and typical source spacing. Do not rely only on a fixed number of array elements.

### 15.3 Merge and split rules

Merge adjacent segments when:

- the gap is very short relative to sampling resolution;
- direction remains the same;
- the signal does not establish a genuine straight region.

Split a segment when:

- signed steering changes direction;
- the new direction is strong and persistent;
- the change is supported across laps.

This handles chicanes without splitting on one-sample sign noise.

### 15.4 Corner direction

Derive direction from robust signed steering within the segment:

- negative -> left;
- positive -> right.

### 15.5 Corner confidence

Build confidence from transparent components:

- lap support;
- steering signal-to-noise ratio;
- position stability across leave-one-lap-out track profiles;
- coverage / missing data;
- direction consistency;
- threshold margin.

Avoid false precision. Round confidence and expose its components.

---

## 16. Entry, estimated apex zone, and exit

The available stream does not contain track `x/y`, heading, curvature, or racing-line coordinates. Therefore, a true geometric apex cannot be proven.

Return an **estimated apex zone from the representative steering-shape proxy**, and name the method honestly.

Recommended method:

1. find the dominant robust steering-strength peak inside the corner;
2. identify the contiguous region around that peak above a percentage of peak strength, for example the top 80% band;
3. use a strength-weighted position centroid as apex center;
4. classify:
   - entry: corner start to apex-zone start;
   - apex: apex zone;
   - exit: apex-zone end to corner end.

Do not define apex using minimum speed, maximum brake, or the worst lap's behavior.

Suggested type:

```ts
interface Corner {
  id: string;
  direction: "left" | "right";
  startPosition: number;
  endPosition: number;
  wrapsStartFinish: boolean;
  entry: {
    startPosition: number;
    endPosition: number;
  };
  apex: {
    startPosition: number;
    centerPosition: number;
    endPosition: number;
    method: "representative-steering-peak-proxy";
  };
  exit: {
    startPosition: number;
    endPosition: number;
  };
  confidence: number;
  confidenceComponents: Record<string, number>;
}
```

For a complex same-direction multi-apex section, either split it using a documented valley rule or explicitly represent it as complex/low-confidence. Do not hide ambiguity.

---

## 17. Best lap, worst real lap, and cumulative time delta

Use only complete, sufficiently clean racing laps.

- best lap = minimum defensible lap time;
- worst real lap = maximum defensible lap time among included racing laps;
- do not select a partial start/end fragment or idle tail as the worst lap.

At each shared position:

```ts
const deltaMs = worst.elapsedMs - best.elapsedMs;
```

The final delta near the finish should approximately equal:

```ts
worstLapTimeMs - bestLapTimeMs
```

within interpolation tolerance. Add an invariant test.

### Localize loss

Calculate:

- cumulative delta curve;
- local delta increase between adjacent positions;
- net delta change over every corner;
- net delta change over entry/apex/exit phases;
- sustained positive-loss regions.

Do not report a point spike as a major loss unless it persists and survives smoothing/robust checks.

Rank loss regions by net time loss and confidence.

---

## 18. Compare telemetry within the loss region

For best and worst laps at the same positions, calculate evidence such as:

### Braking

- brake onset position and elapsed time;
- peak brake;
- average brake;
- brake duration / position span;
- brake release position;
- brake while steering overlap.

### Throttle

- lift onset;
- minimum throttle;
- throttle reapplication;
- full-throttle return position and time;
- throttle hesitation or second lift.

### Speed

- speed at corner entry;
- minimum speed and its position, as a driver-performance metric only;
- speed at estimated apex center;
- speed at exit;
- average speed through each phase.

### Steering

- steering trace difference;
- peak magnitude;
- total variation / correction proxy;
- direction consistency;
- timing relative to braking and throttle.

### Gear and RPM

- gear choice;
- shift locations;
- RPM differences.

### Tyres

- normalized tyre core temperatures;
- axle and side deltas;
- change across the stint;
- correlation with performance, stated cautiously.

### Required caution

The data does not directly prove:

- wheel lock;
- wheelspin;
- slip angle;
- understeer or oversteer;
- exact racing line;
- differential/setup fault;
- track distance in metres;
- tyre overheating relative to an unknown ideal operating window.

Do not make these claims unless additional supporting data is present. Prefer observable wording such as:

- “brake pressure was higher”;
- “the slower lap lifted earlier”;
- “minimum speed was lower”;
- “full throttle returned later”;
- “the steering trace had more reversals”;
- “the right-front core temperature was X °C higher.”

Do not say “ten metres earlier” because track length is not supplied. Use normalized position difference, percentage of lap, or elapsed-time difference.

---

## 19. Findings and evidence model

Separate facts from interpretation.

```ts
interface EvidenceValue {
  metric: string;
  best?: number;
  worst?: number;
  difference?: number;
  unit: string;
  positionRange?: [number, number];
}

interface Finding {
  id: string;
  cornerId: string;
  phase: "entry" | "apex" | "exit" | "whole-corner";
  type:
    | "earlier-braking"
    | "stronger-braking"
    | "longer-braking"
    | "unnecessary-braking-vs-best"
    | "earlier-lift"
    | "lower-entry-speed"
    | "lower-minimum-speed"
    | "later-throttle"
    | "lower-exit-speed"
    | "different-gear"
    | "higher-steering-variation"
    | "tyre-temperature-difference"
    | "insufficient-evidence";
  statement: string;
  timeLossMs: number;
  confidence: number;
  evidence: EvidenceValue[];
  limitations: string[];
}
```

A finding should be emitted only when:

- the metric is supported over a meaningful range;
- the effect exceeds estimated noise or uncertainty;
- time delta grows in the relevant region;
- the claim can be reconstructed from evidence.

Use standardized effect size or robust variability in addition to raw differences where useful. Do not use one arbitrary absolute threshold for every car and track.

---

## 20. Confidence

Confidence must not be an unexplained number.

Possible components:

- `dataCoverage`;
- `cornerLapSupport`;
- `thresholdMargin`;
- `crossLapPositionStability`;
- `effectSize`;
- `signalAgreement`;
- `interpolationQuality`;
- `missingDataPenalty`.

Example:

```ts
interface ConfidenceBreakdown {
  overall: number;
  dataCoverage: number;
  lapSupport: number;
  signalStrength: number;
  positionStability: number;
  evidenceAgreement: number;
  penalties: string[];
}
```

Use a transparent weighted formula, keep weights in configuration, and document them. Low confidence is an acceptable and sometimes preferable outcome.

---

## 21. Engineer radio call

Generate the radio call deterministically in phase 1. An LLM is optional later and must not be allowed to introduce new facts.

Requirements:

- one or two short sentences;
- identify the corner and phase;
- state approximate time loss;
- include the strongest one to three numerical differences;
- give an actionable recommendation only when supported;
- reference internal finding/claim IDs;
- avoid unsupported causal language.

Example output structure:

```json
{
  "text": "C4 entry, 0.31 seconds lost. You braked 180 ms earlier, carried 11.4 km/h less minimum speed, and returned to full throttle 240 ms later than the best lap.",
  "claimIds": ["finding-c4-brake", "finding-c4-speed", "finding-c4-throttle"],
  "confidence": 0.86
}
```

This is an illustrative format, not an answer to the supplied stint.

If an LLM layer is added later:

- give it only validated structured findings;
- require structured output;
- validate every number and claim ID against source evidence;
- reject or regenerate text containing unsupported claims;
- keep deterministic templates as fallback.

---

## 22. Visualization-ready output, without building the UI yet

Preserve or expose decimated series required by a later frontend:

### Track-profile chart

```ts
interface TrackProfileSeriesPoint {
  position: number;
  medianSteeringDeg: number;
  smoothedSteeringDeg: number;
  strength: number;
  lapSupport: number;
  enterThresholdDeg: number;
  exitThresholdDeg: number;
}
```

### Delta chart

```ts
interface DeltaSeriesPoint {
  position: number;
  deltaMs: number;
  localDeltaChangeMs: number;
  cornerId?: string;
  phase?: "entry" | "apex" | "exit";
}
```

### Corner comparison chart

For the primary-loss corner expose aligned best/worst series for:

- speed;
- brake;
- throttle;
- steering;
- gear;
- RPM;
- tyre temperatures;
- elapsed time.

Do not send enormous full-resolution arrays by default if avoidable. Support a documented visualization detail level or deterministic decimation.

### Future frontend stack

Recommended phase-2 stack:

- Next.js + React + TypeScript;
- a chart library such as ECharts or uPlot;
- TanStack Query for API state if useful;
- one focused analysis screen rather than a broad dashboard.

Most valuable views:

1. all clean lap steering traces plus representative/smoothed track profile;
2. adaptive thresholds and shaded corners with entry/apex/exit;
3. cumulative worst-vs-best delta with loss regions;
4. best-vs-worst speed/brake/throttle/steering in the primary corner;
5. evidence and confidence panel;
6. cleaning and threshold diagnostics.

Do not draw a realistic 2D track map without coordinates. A linear lap ribbon is honest and sufficient.

---

## 23. Configuration

Use a typed configuration object. Separate:

- domain-contract ranges;
- cleaning policy;
- resampling policy;
- smoothing policy;
- threshold strategy;
- corner persistence/merge/split policy;
- finding confidence weights;
- output/decimation settings.

Example:

```ts
interface AnalysisConfig {
  interpolation: {
    minGridSize: number;
    maxGridSize: number;
    maxGapMedianMultiplier: number;
  };
  smoothing: {
    medianWindowFraction: number;
    weightedWindowFraction: number;
  };
  threshold: {
    method: "otsu-with-mad-fallback";
    lowerBandQuantile: number;
    enterMadMultiplier: number;
    exitMadMultiplier: number;
  };
  corner: {
    minimumSpanMedianGapMultiplier: number;
    mergeGapMedianGapMultiplier: number;
    minimumLapSupportFraction: number;
    apexPeakFraction: number;
  };
  confidence: {
    weights: Record<string, number>;
  };
}
```

These parameters still require justification. Data-derived thresholds do not remove all model choices. Document sensitivity and failure modes.

---

## 24. Testing requirements

### 24.1 Unit tests

At minimum test:

1. tyre fixed-point conversion (`919 -> 91.9 °C`);
2. raw schema success and failure;
3. canonical serialization and stable SHA-256 identity;
4. same semantic object-key order -> same hash;
5. frame array order remains significant;
6. exact duplicate handling;
7. timestamp regression detection;
8. position-wrap detection;
9. partial-lap exclusion;
10. crossing-time interpolation;
11. linear interpolation of continuous signals;
12. step/nearest interpolation of gear;
13. no extrapolation;
14. maximum-gap guard;
15. median track profile robust to one steering outlier;
16. circular smoothing at start/finish;
17. adaptive threshold on synthetic straight/corner distributions;
18. fallback threshold when distributions are poorly separated;
19. hysteresis prevents segment flicker;
20. a flat/no-brake corner is still detected;
21. the same synthetic corner is detected when one lap brakes and another is nearly flat;
22. apex proxy does not move merely because one lap's minimum speed moves;
23. persistent sign reversal splits a chicane;
24. one-sample sign noise does not split a corner;
25. wrap-around corner handling;
26. cumulative delta final value matches lap-time difference;
27. primary loss region localization on a synthetic known case;
28. unsupported claims are not emitted;
29. radio-call numbers map to finding evidence.

### 24.2 Integration tests

Test:

- `GET /laps` before ingest -> `409`;
- `GET /analysis` before ingest -> `409`;
- successful `POST /ingest`;
- repeated identical ingest -> same dataset ID and output, cache hit;
- different dataset -> new dataset ID;
- cache reactivation;
- failed ingest leaves previous active dataset intact;
- `/laps` and `/analysis` return the selected dataset;
- deterministic repeated analysis.

### 24.3 Invariants

Assert:

- complete lap times are positive;
- corner phases are ordered and contained within their corner;
- corners are ordered around the lap and do not overlap unexpectedly;
- support values are in `[0, 1]`;
- confidence is in `[0, 1]`;
- normalized throttle/brake are in valid range for accepted frames;
- delta at lap finish approximately equals total lap-time difference;
- every radio claim references existing evidence.

### 24.4 Actual dataset runner

`bun run analyze:data` must:

1. load `data/stint.telemetry.json`;
2. run the exact production processing pipeline;
3. write `artifacts/sample-output.json`;
4. write `artifacts/diagnostics.json`;
5. print a concise terminal summary;
6. fail non-zero if invariants fail.

Never use a separate manually coded analysis path for the supplied file.

---

## 25. Documentation requirements

### `README.md`

Include:

- challenge goal and authoritative source;
- setup and run commands;
- API examples with `curl`;
- data contract and tyre scaling discovery;
- architecture diagram or pipeline description;
- cleaning policy;
- real-lap definition;
- resampling and interpolation method;
- track-profile method;
- adaptive threshold derivation;
- corner segmentation and apex-proxy limitation;
- time-loss calculation;
- evidence and confidence model;
- cache/idempotence behavior;
- tests;
- sample output location;
- known limitations;
- future visualization plan.

### `DESIGN.md`

Before substantial implementation, document:

- modules and responsibilities;
- data flow;
- chosen algorithms;
- rejected alternatives and reasons;
- complexity and performance expectations;
- failure behavior;
- API design choice versus official requirements.

### `DATA_AUDIT.md`

Generated after inspecting the real dataset. Include only independently computed observations:

- root shape and frame count;
- observed field ranges;
- timestamp/sampling statistics;
- lap-number and position behavior;
- detected anomalies with evidence;
- included/excluded laps and reasoning;
- no copied Gist-comment answers.

### `ASSUMPTIONS.md`

State clearly:

- no track identity or length;
- no `x/y`, heading, yaw, wheel speed, slip, pressure, wear, or ideal tyre window;
- steering profile is a track-shape proxy, not geometry;
- apex is an estimated zone;
- normalized position is not metres;
- in-memory cache disappears on restart;
- current active-dataset behavior is challenge-scale, not multi-tenant production design.

---

## 26. Performance and engineering quality

The dataset is expected to fit in memory. Prefer clarity over premature optimization, but avoid accidental quadratic work over frames and grid positions.

Target rough complexity:

- validation/cleaning: `O(n)`;
- lap grouping: `O(n)`;
- resampling: `O(laps * (framesPerLap + gridSize))` using two-pointer interpolation;
- per-position aggregation: `O(laps * gridSize)`;
- segmentation and delta analysis: `O(gridSize)`.

Engineering requirements:

- strict types;
- no `any` in core processing;
- no mutable global analytics state outside the store abstraction;
- explicit error types;
- immutable processed result where practical;
- pure functions for analytics;
- stable ordering of outputs;
- deterministic algorithms and initialization;
- comments explain why, not obvious syntax;
- no dead code or speculative framework abstractions;
- no hidden hard-coded answer.

---

## 27. Delivery scope and priorities

### P0 — required for a credible submission

- official wire contract and tyre normalization;
- data audit and cleaning report;
- complete real-lap detection and timing;
- position-domain linear resampling;
- driver-robust representative steering profile;
- adaptive corner threshold and hysteresis;
- corners with entry/apex-proxy/exit;
- best/worst lap selection;
- cumulative delta and primary loss localization;
- grounded evidence and radio call;
- tests and sample output;
- clear README.

### P1 — strong differentiators

- content-addressed ingest cache;
- optional dataset selection by ID;
- diagnostics endpoint;
- circular start/finish handling;
- leave-one-lap-out corner stability;
- confidence breakdown;
- sensitivity diagnostics for threshold/smoothing;
- OpenAPI schema;
- deterministic data-decimation support for future charts.

### P2 — later visualization

- Next.js analysis page;
- steering/threshold/corner chart;
- cumulative delta chart;
- best-vs-worst corner trace charts;
- evidence and confidence panel;
- upload or ingest workflow.

Do not spend phase-1 time polishing UI before the analytics and tests are defensible.

---

## 28. Required Codex working procedure

Codex must follow this order:

### Step 1 — inspect, do not immediately implement

- inspect repository state;
- locate `BRIEF-HARD.md`, `recorder.rs`, and `stint.telemetry.json`;
- read the official files;
- inspect JSON shape and calculate basic statistics with a temporary script;
- identify missing prerequisites;
- do not copy claims from Gist comments.

### Step 2 — write design artifacts

Create or update:

- `DESIGN.md`;
- `DATA_AUDIT.md` if data exists;
- `ASSUMPTIONS.md`;
- implementation checklist.

Explicitly distinguish:

- official requirements;
- our chosen API contract;
- assumptions;
- optional improvements.

### Step 3 — scaffold the smallest testable core

- initialize Bun/TypeScript/Hono;
- configure strict typecheck, test, lint, format;
- create raw/normalized contracts;
- implement tyre normalization;
- add tests.

### Step 4 — implement vertical slices

Recommended sequence:

1. validation and audit;
2. cleaning;
3. lap detection/timing;
4. resampling;
5. track profile and smoothing;
6. adaptive thresholds;
7. corner segmentation/phases;
8. time delta;
9. metrics/findings/confidence;
10. radio call;
11. store/cache;
12. HTTP routes;
13. dataset runner;
14. documentation and sample output.

Run tests and typecheck after every slice. Do not batch the whole project into one unverified change.

### Step 5 — verify against acceptance criteria

Run:

```bash
bun install
bun run typecheck
bun run lint
bun test
bun run analyze:data
```

Report:

- files changed;
- commands run;
- test results;
- actual dataset findings with evidence;
- remaining limitations;
- any requirement not completed.

### Step 6 — do not fabricate completion

If the data is unavailable, an algorithm fails, or tests remain red, say so explicitly. Do not write a plausible-looking sample result without executing the pipeline.

---

## 29. Definition of done

The phase-1 task is done only when:

- the service runs under Bun;
- the official raw contract is represented correctly;
- tyre temperatures are normalized correctly;
- ingesting the supplied data produces a complete audit;
- real laps and lap times are computed, not hard-coded;
- corners are derived from repeatable steering shape, including non-braking cases;
- corner identity does not depend on one lap's brake/speed strategy;
- apex is not defined from minimum speed;
- thresholds are derived from the dataset and diagnostic values are exposed;
- best/worst comparison uses shared track position;
- the main loss is localized with a consistent cumulative delta;
- every coaching statement traces to computed evidence;
- unsupported vehicle-dynamics claims are absent;
- repeated identical ingest is deterministic and cacheable;
- all required tests, typecheck, and lint pass;
- sample output is generated through the production pipeline;
- README, design, audit, assumptions, and limitations are complete;
- the code is understandable enough to defend in a walkthrough.

---

## 30. Initial prompt to execute in Codex

Copy the following as the first implementation task after placing this document in the repository:

```text
Read AGENTS.md and this master brief first. Then inspect the repository and the local RACEMAKE challenge files. Do not write the full implementation immediately.

First produce DESIGN.md, DATA_AUDIT.md, ASSUMPTIONS.md, a proposed file tree, and a phased implementation checklist. Verify the actual JSON root shape and independently inspect the data; treat GitHub Gist comments as non-authoritative and do not use their claimed answers.

Clearly separate official requirements from our proposed POST /ingest, GET /laps, and GET /analysis API. Identify every threshold or policy parameter that will need justification. Propose the exact deterministic algorithm for cleaning, lap timing, linear resampling, representative steering profile, adaptive threshold derivation, circular corner segmentation, apex-zone proxy, cumulative time delta, evidence-based findings, confidence, and content-addressed caching.

After writing the design artifacts, implement only the first vertical slice: project tooling, strict TypeScript contracts, Zod validation, raw-to-normalized conversion including tyre raw/10 Celsius scaling, canonical dataset hashing, and focused tests. Run typecheck, lint, and tests. Report what you changed and any uncertainties before proceeding to the next slice.
```

