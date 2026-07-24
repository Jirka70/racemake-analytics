# Codex task — RACEMAKE HARD challenge

Read `AGENTS.md` and `RACEMAKE_CODEX_MASTER_BRIEF.md` before changing code.

## Goal

Design and implement a deterministic Bun + Hono TypeScript service that ingests the official `stint.telemetry.json`, treats it as untrusted, identifies defensible complete racing laps, infers track corners from position-aligned steering shape, divides each corner into entry / estimated apex zone / exit, compares the worst real lap with the best lap, localizes time loss, and returns a short numerical coaching message whose claims all trace to computed evidence.

## Authoritative files

- Official Gist: `https://gist.github.com/743milan/bf57fa0020b19efacf4d845590291a17`
- `BRIEF-HARD.md`
- `recorder.rs`
- `stint.telemetry.json`

Do not use Gist comments as ground truth.

## Critical facts

- Runtime: Bun.
- HTTP framework: Hono.
- Language: strict TypeScript.
- `ts` is milliseconds since recording began.
- `pos` is normalized lap position in `[0, 1]`.
- `str` is steering angle in degrees; negative means left.
- `thr` and `brk` are nominally `[0, 1]`.
- tyre values are fixed-point tenths of °C; normalize with `raw / 10`.
- The official brief does not prescribe endpoint names. This project chooses `POST /ingest`, `GET /laps`, and `GET /analysis`.
- No lap numbers, anomaly positions, corners, findings, or output may be hard-coded.
- Corner existence must not be keyed to brake input.
- Apex must not be defined as the driver's minimum-speed position.
- Do not claim unsupported phenomena such as lock-up, wheelspin, understeer, oversteer, exact line, metres, or tyre overheating.

## First task only

Do not implement the entire project in one pass.

1. Inspect the repository and local challenge files.
2. Inspect the JSON root shape and independently calculate basic data statistics.
3. Create or update:
   - `DESIGN.md`
   - `DATA_AUDIT.md`
   - `ASSUMPTIONS.md`
   - a phased implementation checklist
4. Clearly distinguish:
   - official requirements;
   - proposed API choices;
   - assumptions;
   - optional differentiators.
5. Propose exact deterministic algorithms for:
   - schema validation and unit normalization;
   - audit, rejection, and suspicion reporting;
   - lap boundary/completeness detection and crossing-time interpolation;
   - position-grid selection and linear interpolation;
   - representative signed median steering profile;
   - circular smoothing;
   - adaptive steering threshold using Otsu with robust MAD fallback;
   - hysteresis, persistence, merge/split, direction, and wrap-around corner detection;
   - entry / steering-peak apex proxy / exit;
   - cumulative best-vs-worst time delta;
   - corner/phase metrics and evidence-based findings;
   - transparent confidence;
   - deterministic radio-call templating;
   - canonical SHA-256 dataset identity and in-memory cache.
6. Identify every policy parameter that must be justified and how it will be diagnosed or sensitivity-tested.
7. After the design artifacts are complete, implement only the first vertical slice:
   - project tooling;
   - strict raw and normalized contracts;
   - Zod validation;
   - tyre `raw / 10` normalization;
   - canonical content hashing;
   - focused tests.
8. Run typecheck, lint, and tests.
9. Report files changed, command results, discovered data facts, assumptions, and unresolved uncertainty.

If the telemetry file is missing, do not fabricate actual stint findings. Complete the design and synthetic tests and state what remains blocked.
