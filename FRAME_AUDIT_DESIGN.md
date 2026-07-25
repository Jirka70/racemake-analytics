# Frame audit design

## Status and purpose

This document records the agreed design for the dynamic audit of normalized
telemetry. Read it before implementing or changing frame cleaning, continuity
detection, lap grouping, or interpolation.

The audit is intended to work with any dataset produced by the same recorder
contract. It must not contain expected lap numbers, anomaly indexes, values, or
thresholds fitted to `data/stint.telemetry.json`.

The audit cannot prove that every unusual value is an error. Its responsibility
is narrower:

- detect contract and sequence-integrity problems;
- find isolated local outliers and unsupported time ranges;
- identify boundaries across which interpolation or derivatives are unsafe;
- preserve evidence and uncertainty for downstream processing;
- avoid classifying unusual but possible driver behaviour as corrupt data.

Reverse movement, coasting, unusual gear selection, aggressive inputs, and slow
driving are not corruption by themselves.

## Position in the pipeline

```text
Unknown JSON payload
  -> Zod schema validation
  -> validated wire payload
  -> wire-format normalization
  -> normalized telemetry
  -> frame audit and classification
  -> audited frames, transitions, and continuous segments
  -> lap grouping
  -> complete-lap selection
```

Zod validates the static wire contract. The frame audit operates only on
already normalized telemetry and evaluates relationships between samples. It
must not import Hono, inspect HTTP requests, or repeat wire-format parsing.

Lap completeness, stationary-fragment classification, and lap confidence are
downstream responsibilities. The frame audit may provide evidence used by
those steps, but it must not become a combined audit-and-lap-analysis module.

## Three sources of rules

Keep these categories explicit in configuration and diagnostics:

1. **Recorder contract**
   - field presence and types;
   - documented ranges for position, throttle, brake, and gear;
   - tyre fixed-point normalization;
   - these rules are not inferred from the current dataset.
2. **Structural invariants**
   - finite normalized values;
   - timestamp ordering;
   - duplicate samples;
   - valid relationships required to evaluate neighboring samples.
3. **Data-derived limits**
   - typical sampling interval;
   - maximum supported sampling gap;
   - per-channel residual baseline;
   - local-outlier and discontinuity thresholds.

Numeric multipliers, minimum support, and window-duration multipliers are
algorithmic policy. The resulting limits in milliseconds, km/h, RPM, degrees,
or degrees Celsius must be computed from each dataset and emitted in
diagnostics.

## Classification model

Severity describes the importance of an issue. Action describes the processing
decision. These are independent concepts.

```ts
type IssueSeverity = 'info' | 'warning' | 'error' | 'fatal'

type IssueAction =
  | 'retain'
  | 'exclude-channel-value'
  | 'exclude-frame'
  | 'split-segment'
  | 'exclude-lap'
  | 'reject-dataset'

type FrameDisposition = 'accepted' | 'suspect' | 'rejected'
```

An invalid RPM value can therefore be an `error` whose action is
`exclude-channel-value`; the position, timestamp, and other channels in that
frame can remain usable. Reject an entire frame only when a required structural
value is unusable or several failures make the sample unsafe as a whole.

`exclude-lap` is part of the shared action vocabulary, but the frame audit does
not issue it. Lap selection decides that later.

## Stable issue vocabulary

Use a deliberately small set of general codes:

```ts
type IssueCode =
  | 'CONTRACT_VIOLATION'
  | 'DUPLICATE_SAMPLE'
  | 'TIME_ORDER_VIOLATION'
  | 'SAMPLING_GAP'
  | 'LOCAL_OUTLIER'
  | 'SEQUENCE_DISCONTINUITY'
  | 'CYCLE_MARKER_MISMATCH'
  | 'PARTIAL_CYCLE'
  | 'INSUFFICIENT_SUPPORT'
  | 'STATIONARY_FRAGMENT'
  | 'INSUFFICIENT_BASELINE'
```

The code identifies the general problem class. `reason`, `channels`, observed
values, and thresholds carry the precise explanation. Do not introduce
dataset-specific codes such as a particular speed value, frame index, lap
number, or boundary.

Examples of reasons include:

- `exact-duplicate`;
- `duplicate-timestamp`;
- `timestamp-regression`;
- `isolated-spike`;
- `persistent-level-shift`;
- `position-wrap-mismatch`;
- `opening-fragment`;
- `closing-fragment`;
- `zero-mad`.

The reason may initially remain a string if a closed union would create a large
speculative taxonomy. Issue codes and actions are the stable machine-facing
contract.

## Public audit result

Channel names should come from a closed structural type derived from the
normalized telemetry model, not arbitrary strings.

```ts
interface ProcessingIssue {
  readonly code: IssueCode
  readonly reason: string
  readonly severity: IssueSeverity
  readonly action: IssueAction
  readonly scope:
    | 'dataset'
    | 'segment'
    | 'lap'
    | 'frame'
    | 'channel'
    | 'transition'

  readonly sourceIndex?: number
  readonly nextSourceIndex?: number
  readonly timestampMs?: number
  readonly recordedLapNumber?: number
  readonly channels?: readonly TelemetryChannel[]

  readonly observed?: Readonly<
    Record<string, number | string | boolean>
  >
  readonly thresholds?: Readonly<Record<string, number>>
  readonly message: string
}

interface AuditedFrame {
  readonly frame: NormalizedTelemetryFrame
  readonly disposition: FrameDisposition
  readonly invalidChannels: readonly TelemetryChannel[]
  readonly issues: readonly ProcessingIssue[]
}

interface AuditedTransition {
  readonly fromSourceIndex: number
  readonly toSourceIndex: number
  readonly durationMs: number
  readonly continuity: 'continuous' | 'gap' | 'discontinuous'
  readonly interpolationAllowed: boolean
  readonly derivativesAllowed: boolean
  readonly issues: readonly ProcessingIssue[]
}

interface ContinuousSegment {
  readonly id: string
  readonly startSourceIndex: number
  readonly endSourceIndex: number
  readonly startTimestampMs: number
  readonly endTimestampMs: number
  readonly frameCount: number
}

interface TelemetryAuditResult {
  readonly frames: readonly AuditedFrame[]
  readonly transitions: readonly AuditedTransition[]
  readonly continuousSegments: readonly ContinuousSegment[]
  readonly issues: readonly ProcessingIssue[]
  readonly diagnostics: AuditDiagnostics
}
```

### Why transitions and continuous segments both exist

`AuditedTransition` describes the edge between two adjacent samples. A sampling
gap or a recorder discontinuity belongs to that edge, not necessarily to either
endpoint frame. Both endpoint frames may remain valid while interpolation and
derivative calculation across their boundary are forbidden.

`ContinuousSegment` is a derived, higher-level view: a maximal run of frames
whose transitions are all `continuous`. It prevents every downstream consumer
from having to reconstruct runs itself. Lap grouping, resampling, and later
visualization can consume these segments directly.

Use the name `transition` for adjacent-frame edges and `segment` for a
multi-frame continuous range so that the two concepts are not confused.

## Channel descriptions

The generic audit algorithm should operate from a small configuration describing
the behavior of each normalized channel:

```ts
interface ChannelDefinition {
  readonly name: TelemetryChannel
  readonly kind: 'continuous' | 'step' | 'counter' | 'circular'
  readonly interpolation: 'linear' | 'nearest' | 'step' | 'none'
  readonly documentedRange?: {
    readonly minimum: number
    readonly maximum: number
  }
  readonly localContinuityCheck: boolean
  readonly group:
    | 'time'
    | 'track-progress'
    | 'motion'
    | 'powertrain'
    | 'driver-input'
    | 'tyres'
}
```

This is configuration for real behavioral variation, not a framework for every
mathematical operation. Median, MAD, IQR, quantiles, interpolation, and circular
unwrapping remain small pure functions.

Initial local continuity checks should cover:

- normalized track position;
- speed;
- engine RPM;
- normalized tyre temperatures.

Do not initially treat rapid changes in throttle, brake, steering, or gear as
corruption. Those signals can legitimately change abruptly.

## Audit passes

Perform the audit deterministically in four conceptual passes.

### Pass 1: structural sequence checks

- retain stable `sourceIndex` values from normalization;
- detect exact adjacent duplicate samples;
- detect equal timestamps with different samples;
- detect timestamp regressions and non-positive deltas;
- establish which samples and transitions are eligible for statistical
  calibration.

Timestamp regression creates a segment boundary. A large positive time delta
does not make either endpoint invalid.

### Pass 2: robust calibration

From eligible positive time deltas calculate:

```text
typicalDtMs = median(positive deltas)
dtMadMs = MAD(positive deltas)
maximumGapMs = max(
  gapMedianMultiplier * typicalDtMs,
  typicalDtMs + gapMadMultiplier * dtMadMs
)
```

The multipliers are documented configuration. `maximumGapMs` is specific to the
ingested dataset.

For every locally checked continuous channel, calculate a residual against its
neighbors and derive a separate robust residual distribution.

### What “do not calculate the baseline blindly” means

The baseline is the dataset's estimate of normal local variation. It must not
learn from transitions that are already structurally unsuitable:

- do not calculate a residual across a timestamp regression;
- do not calculate one across a large sampling gap;
- do not use a neighbor that is structurally invalid;
- do not calculate a linear residual through a circular position wrap until the
  position has been locally unwrapped.

Use a simple two-stage robust calibration:

1. calculate median and MAD from all structurally eligible residuals;
2. identify extreme calibration candidates using that preliminary robust scale;
3. omit only those candidates from the calibration set;
4. calculate median and MAD once more for the final baseline.

This omission applies only while estimating the baseline. It does not silently
remove frames from the audit result. The final baseline is then used to classify
every eligible sample and produce explicit issues.

The second calculation prevents a cluster of corrupt values from inflating the
definition of “normal.” One recalculation is sufficient for the MVP; do not
build an iterative statistical framework.

When MAD is zero or support is insufficient, use an explicitly configured
fallback such as IQR or a high residual percentile. Record the selected method
and emit `INSUFFICIENT_BASELINE` when no defensible scale can be derived.

### Pass 3: local outliers and discontinuities

For an eligible triple of samples, use time-weighted interpolation:

```text
ratio =
  (current.timestampMs - previous.timestampMs)
  / (next.timestampMs - previous.timestampMs)

predicted =
  previousValue + ratio * (nextValue - previousValue)

residual = abs(currentValue - predicted)
```

Compare the residual with the final per-channel robust baseline:

```text
threshold =
  medianResidual + spikeMadMultiplier * scaledMadResidual
```

`spikeMadMultiplier` is policy. The resulting channel-unit threshold is
data-derived and must be exposed in diagnostics.

Before evaluating circular position, locally unwrap a valid sequence such as
`0.999 -> 0.000 -> 0.001` to approximately
`0.999 -> 1.000 -> 1.001`. Never classify a valid start/finish wrap as a local
spike because ordinary linear arithmetic ignored circularity.

A three-sample residual detects an isolated spike well, but not a persistent
level shift. Distinguish the cases with robust time windows on both sides of a
candidate boundary:

- a value departs and immediately returns to the previous level:
  `LOCAL_OUTLIER`;
- values on each side are internally stable but continue at different levels:
  `SEQUENCE_DISCONTINUITY`;
- several channel groups shift at the same boundary: stronger evidence for a
  sequence discontinuity.

Window duration should be derived from `typicalDtMs` and a configured duration
multiplier. Do not fit it to a known frame count in the supplied stint.

Correlated channels do not count as fully independent evidence. Speed, RPM, and
gear naturally move together. A simultaneous shift in motion, powertrain, and
tyre groups is stronger evidence than several shifts within one group.

### Pass 4: materialize decisions

- attach issues to frames, channels, and transitions;
- calculate each frame disposition without deleting the normalized source
  frame;
- mark gap and discontinuity transitions as unsafe for interpolation and
  derivatives;
- split `continuousSegments` at every gap, discontinuity, or time-order
  violation;
- preserve deterministic ordering by source index and issue generation order;
- emit the calibration values and fallback decisions in diagnostics.

## Decision policy

| Situation | Severity | Action | Result |
|---|---|---|---|
| Exact duplicate sample | warning or error | exclude-frame | Preserve issue and one usable copy |
| Equal timestamp, different data | error | exclude-frame or split-segment | Do not derive through ambiguous ordering |
| Timestamp regression | error | split-segment | Preserve both sides as separate runs |
| Large positive sampling gap | warning | retain | Forbid interpolation and derivatives across edge |
| Isolated outlier in one non-essential channel | error | exclude-channel-value | Keep other channel values |
| Isolated position outlier | error | exclude-frame for position-based processing | Preserve evidence |
| Persistent level shift | warning or error | split-segment | Keep both stable sides |
| Sustained unusual driving | info or no issue | retain | Treat as behavior, not corruption |
| Insufficient statistical support | warning | retain | Disable affected heuristic or lower confidence |

Do not reject a whole dataset merely because a heuristic cannot establish a
baseline. Dataset rejection is reserved for a failed wire contract or a stream
that lacks the structural information required by the pipeline.

## Diagnostics

`AuditDiagnostics` must expose at least:

- count of input, accepted, suspect, and rejected frames;
- count of invalid values by channel;
- count and duration of continuous segments;
- median positive sampling interval;
- sampling-interval MAD;
- calculated maximum gap;
- number of samples used for sampling calibration;
- per-channel residual median, MAD, scaled MAD, IQR, and relevant percentiles;
- final per-channel local-outlier threshold;
- selected baseline and fallback method;
- number of samples used in each preliminary and final calibration;
- configured multipliers used to derive every threshold;
- detected gap and discontinuity transitions.

Diagnostics are part of explainability and future visualization support. They
must report calculated values, not only the names of algorithms.

## Lap-related issues belong downstream

The following concepts are intentionally deferred to lap grouping and
complete-lap selection:

- agreement between position wrap and recorded lap counter;
- opening and closing partial laps;
- position coverage;
- relative sample support between laps;
- stationary tail and non-racing laps;
- lap confidence;
- whether a gap makes only positional analysis unavailable or invalidates the
  whole lap.

The audit provides continuous segments, transition issues, channel validity, and
sampling diagnostics needed to make those decisions.

Crossing-to-crossing lap time may remain valid when a lap contains a sampling
gap, while interpolation, corner analysis, and time-loss localization in the
missing region are not valid. Downstream code must preserve this distinction.

## Explicit non-goals for the first implementation

- inferring corruption from reverse gear or apparent direction of travel;
- rejecting throttle, brake, steering, or gear transitions merely for being
  fast;
- determining whether a driver action is correct;
- car-specific maximum speed, RPM, acceleration, or tyre-temperature limits not
  provided by the recorder contract;
- repairing long corrupt sequences;
- automatically interpolating excluded samples;
- lap completeness and lap selection;
- a reusable general-purpose time-series framework.

## Minimum test strategy

Use synthetic data so tests validate the algorithm rather than encode the
supplied stint's known answers:

- clean irregularly sampled sequence remains accepted;
- exact duplicate and same-timestamp conflict are distinguished;
- timestamp regression splits continuous segments;
- sampling rate and maximum gap are derived from input data;
- large gap preserves endpoint frames and forbids interpolation;
- one-channel isolated spike excludes only that channel where possible;
- multi-channel isolated spike can reject the frame;
- persistent level shift creates a segment boundary instead of rejecting the
  new stable run;
- circular position wrap is not classified as a spike;
- isolated circular-position corruption is classified;
- zero MAD uses the documented fallback;
- insufficient support emits a diagnostic issue without crashing;
- output and issue ordering are deterministic;
- no input frame is mutated or silently discarded.

Integration with the real payload should assert general invariants only:
successful audit, stable deterministic output, internally consistent counts,
and no interpolation permission across emitted gaps or discontinuities. Known
frame indexes or expected anomaly values must not become production or
integration-test constants.
