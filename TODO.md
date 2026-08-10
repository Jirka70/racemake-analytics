# TODO after MVP

## Channel trust after an anomaly

The current audit can mark a discontinuity on one transition, but it treats later stable samples as usable again. That is insufficient when a sensor may have reset, acquired a permanent offset, or otherwise become unreliable. Keep the global timeline intact when only one channel is affected; model trust separately for each channel.

### Channel value statuses

Use discrete statuses instead of a numeric confidence score:

- `usable`: the value can be displayed, aggregated, and used as an interpolation or derivative endpoint.
- `suspect`: preserve and display the raw value with its reason, but do not use it as an interpolation or derivative endpoint. Aggregation eligibility must be decided by one central audit policy, not by thresholds repeated in analyzers.
- `invalid`: retain the raw value for audit and diagnostics, but exclude it from aggregation, interpolation, derivatives, and evidence-backed findings.
- `unassessed`: there was not enough support to evaluate the value. Display it with this limitation, but do not use it as an interpolation or derivative endpoint.

Keep the status separate from the reason and supporting evidence. A statistical threshold crossing creates suspicion; it must not automatically mean `invalid`, especially when MAD and IQR are zero.

### Channel issue reasons

Define typed reason codes so callers can distinguish at least:

- isolated spike with an immediate return;
- persistent level discontinuity;
- unverified sensor state after a discontinuity;
- repeated discontinuities;
- stuck or frozen signal;
- hard range violation;
- physically impossible rate of change;
- independently corroborated cross-channel inconsistency;
- insufficient data for assessment.

Timestamp corruption remains a frame-level problem rather than a channel status. An invalid timestamp makes interpolation impossible and the affected frame should be excluded when the timeline can be bridged safely; otherwise it must create a timeline break.

### Channel epochs

After a persistent single-channel discontinuity, start a new epoch for that channel:

```text
trusted epoch | discontinuity boundary | unverified epoch
```

- Do not interpolate, derive, or compare values across the boundary.
- Do not split the global continuous timeline when timestamps remain continuous; unaffected channels must remain usable.
- Mark the new epoch `suspect` until there is independent evidence that trust can be restored.
- After enough stable samples, relative trends inside the new epoch may be usable under a central policy, while absolute values and comparisons with the previous epoch remain unsupported.
- If no trustworthy recovery evidence exists, keep the channel suspect until the end of the stint.
- Repeated jumps, a frozen signal, hard range violations, or physically impossible behavior can escalate the channel to `invalid`.

Possible recovery evidence includes a known source reset, a credible return to the expected signal, agreement with independent channels, or another explicit sensor-health signal. Smooth values after a jump alone are not proof that the new absolute level is correct.

If all related channels jump together, treat that as evidence of a shared telemetry/source problem rather than automatically classifying every sensor as an independent failure.

### Central downstream policy

Expose typed helpers or final eligibility flags from the audit layer, such as `canAggregateChannel`, `canInterpolateChannel`, and `canCalculateDerivative`. Downstream lap, corner, and coaching analyzers must consume those decisions without defining their own confidence thresholds.

Add focused tests for status transitions, epoch boundaries, recovery, repeated-fault escalation, zero-scale MAD/IQR data, and preservation of unaffected channels.

## Corner detection limitations

Add typed `CornerDetectionLimitation` diagnostics instead of interpreting every empty or weak result as evidence that the track has no corners. Cover at least:

- too few real-racing laps to verify repeatability;
- Otsu threshold unavailable for an empty, constant, or nearly constant steering-strength profile;
- weak Otsu class separability or an implausibly small threshold class;
- insufficient position or steering support over part of the track;
- a whole-track steering profile without a defensible straight baseline;
- an inner-corner boundary that is deep in the median profile but not repeatable across laps;
- sensitivity of the minimum recognizable valley width to grid and Savitzky–Golay resolution.

Store the threshold diagnostics and limitation reasons in the corner-detection result. A limitation must describe uncertainty; it must not silently invent a fallback corner layout.

### Final corner metadata

- Preserve candidate confidence when a candidate is split into final detected corners.
- Derive each corner's direction (`left`, `right`, or `mixed`) from the signed representative steering profile.
- Assign every final corner a stable deterministic ID for findings and coaching references.
- Expose the normalized apex-proxy center position in addition to its cell index and interval.

## Coaching phenomena

Implement evidence-backed coaching phenomena in this order:

1. `LATE_BRAKING` and `EARLY_BRAKING` using shared dataset-derived brake-activity thresholds and hysteresis.
2. `EARLY_THROTTLE_LIFT` and `LATE_THROTTLE_APPLICATION`.
3. `LOWER_ENTRY_SPEED`, `LOWER_APEX_PROXY_SPEED`, `LOWER_EXIT_SPEED`, and `LATE_SPEED_RECOVERY`.
4. `LATE_BRAKE_RELEASE`, `EARLY_BRAKE_RELEASE`, and `LONGER_BRAKING_DURATION`.
5. `DIFFERENT_GEAR_SELECTION`, `EXTRA_GEAR_CHANGE`, `EARLIER_DOWNSHIFT`, `LATER_UPSHIFT`, and `GEAR_OSCILLATION`.
6. `EARLIER_STEERING_INPUT`, `LATER_STEERING_INPUT`, `HIGHER_STEERING_DEMAND`, and `STEERING_CORRECTION`.

Also localize `TIME_LOSS_BEFORE_CORNER`, `TIME_LOSS_IN_CORNER`, and `TIME_LOSS_ON_EXIT` so driver-input differences can be connected to an observed consequence.

Treat a control-input difference as descriptive until supporting telemetry shows a defensible adverse outcome. For example, later braking is not automatically a mistake. Do not turn different gear choice into a claim that the gear was wrong, and do not infer racing line, understeer, oversteer, or driving technique from steering shape alone.
