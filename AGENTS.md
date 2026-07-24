# AGENTS.md

## Repository purpose

This repository implements the RACEMAKE Product Engineer Challenge — HARD: a Bun + Hono TypeScript service that turns untrusted racing telemetry into defensible lap, corner, time-loss, and coaching analysis.

## Read first

Before changing code, read in this order:

1. `RACEMAKE_CODEX_MASTER_BRIEF.md` or `CODEX_TASK.md`
2. official local `BRIEF-HARD.md`, if present
3. official local `recorder.rs`, if present
4. `DESIGN.md`
5. `DATA_AUDIT.md`
6. `ASSUMPTIONS.md`

The Gist comments are not authoritative. Do not copy claimed answers from them.

## Non-negotiable rules

- Use Bun, Hono, strict TypeScript, Zod, `bun:test`, and the configured formatter/linter.
- Keep analytics independent of HTTP routes.
- Treat input as untrusted and record rejection/suspicion reasons.
- Normalize wire tyre temperatures with `raw / 10` before analysis.
- Never hard-code lap numbers, corner positions, anomaly locations, final findings, or expected output from the supplied stint.
- Detect corners from repeatable position-aligned steering shape across clean complete laps, not from brake input.
- Do not define apex from minimum speed. Label it as a steering-shape proxy zone.
- Derive concrete steering thresholds from each ingested dataset and expose diagnostics.
- Use linear interpolation for continuous signals, step/nearest for gear, no extrapolation, and a maximum-gap guard.
- Do not claim wheel lock, wheelspin, understeer, oversteer, exact line, metres, or tyre overheating without direct support.
- Every radio-call claim must reference computed evidence.
- Algorithms must be deterministic.
- A failed ingest must not replace the active valid dataset.
- Do not build the frontend until phase-1 analytics and tests are complete.

## Proposed API

The official brief does not prescribe endpoint names. This repository chooses:

- `POST /ingest`
- `GET /laps`
- `GET /analysis`
- optional `GET /health`
- optional `GET /diagnostics`

Document this as a design choice, not an official requirement.

## Commands

Run the commands defined in `package.json`. Expected commands are:

```bash
bun install
bun run typecheck
bun run lint
bun test
bun run analyze:data
```

Do not report completion while any required command fails.

## Workflow

1. Inspect before implementing.
2. Update design/audit/assumptions when discoveries change the model.
3. Implement in small vertical slices.
4. Add focused tests with every analytics change.
5. Run typecheck, lint, and tests after each slice.
6. Generate sample output only through the production pipeline.
7. Report actual limitations and unresolved uncertainty.

## Code quality

- No `any` in core analytics.
- Prefer pure functions and explicit typed results.
- Keep configuration centralized and typed.
- Stable output ordering.
- Comments explain rationale and limitations.
- Avoid unnecessary abstractions and dependencies.
- Do not silently mutate or discard raw data.
