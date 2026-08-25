# Assumptions and known limitations

## Available telemetry

- The dataset does not identify the circuit or provide track length, Cartesian
  coordinates, heading, yaw, wheel speeds, slip, tyre pressure, tyre wear, or
  a validated tyre operating window.
- Normalized track position is a circular fraction of one lap, not distance in
  metres.
- The representative steering profile is a repeatable driver-input proxy for
  track shape, not surveyed circuit geometry.
- The reported apex is a steering-shape proxy zone. It is not a geometric apex
  and is not defined from minimum speed.
- Analyses are cached in memory and disappear when the service restarts. The
  explicit `analysisId` contract is suitable for the challenge but does not
  provide durable or multi-tenant storage.

## Persistent channel discontinuities

The audit currently blocks interpolation and derivatives only across the
transition where a persistent channel-level shift is detected. Samples that
form a stable run after that boundary become usable again. This preserves
unaffected channels, but smooth values after a jump do not prove that the new
absolute sensor level is trustworthy.

This matters for absolute comparisons across laps or epochs. The supplied
stint contains persistent discontinuities at lap boundaries involving tyre
core temperatures and, at some boundaries, speed or engine RPM. Findings must
therefore not interpret those discontinuities as driver or vehicle behaviour.
The current implementation exposes the boundaries in diagnostics, but it does
not yet maintain channel trust beyond each boundary.

## Sampling gaps around start/finish

A sampling gap inside a lap does not normally invalidate crossing-to-crossing
time. It does invalidate that time when the missing interval may contain an
unobserved start/finish boundary, because two real laps could otherwise be
merged into one apparently valid detected lap.

The detector treats either a start/finish-shaped position drop or any recorded
lap-counter change across the gap as conservative evidence of that risk. The
lap counter is used only to veto time, ranking, and coaching; it never creates
a crossing. The detected interval and its recorded telemetry remain available
for review as limited data.

### Proposed channel-epoch solution

1. Give every audited channel value a typed status: `usable`, `suspect`,
   `invalid`, or `unassessed`, with a separate reason and evidence record.
2. Start a new per-channel epoch after a persistent discontinuity without
   splitting the global timeline for unaffected channels.
3. Forbid interpolation, derivatives, aggregation, and absolute comparison
   across channel-epoch boundaries.
4. Keep a new epoch `suspect` until trust is restored by independent evidence,
   such as a known recorder reset, a credible return to the previous scale, or
   corroboration from a separate sensor. Stability alone is not recovery
   evidence.
5. Centralize downstream eligibility in helpers such as
   `canInterpolateChannel`, `canAggregateChannel`, and
   `canCompareChannelEpochs`. Corner and coaching code must consume those
   decisions rather than reimplementing thresholds.
6. Require evidence-backed findings to use comparable trusted epochs. When
   that is impossible, return a limitation instead of a numerical claim.
7. Add focused tests for epoch creation, unaffected-channel preservation,
   recovery, repeated-fault escalation, and comparisons that span epochs.

This is a documented follow-up, not an implemented capability in the current
submission scope.
