# Synthetic Spa-like telemetry dataset

`spa-synthetic.telemetry.json` is a deterministic, generated fixture in the
same `racemake.telemetry.stint.v1` wire format as the supplied challenge
dataset. It is not real telemetry and must not be presented as measured Spa
data.

The model uses:

- a 7.004 km lap;
- an approximate 19-turn Spa-Francorchamps steering shape;
- a GT-style speed, gear, RPM, brake, throttle, and tyre-temperature model;
- an opening partial lap, four complete laps, and a closing partial lap;
- irregular roughly 18 Hz sampling;
- fixed-point wire tyre temperatures in tenths of a degree Celsius.

The complete laps use the same track-level steering shape but different pace.
One lap contains localized performance losses while fast corners such as the
Eau Rouge/Raidillon sequence and Blanchimont remain detectable without being
defined by brake input.

To exercise the untrusted-input audit, the generator deliberately adds:

- one exact adjacent duplicate;
- one isolated implausible speed sample;
- one large positive sampling gap.

Regenerate the default fixture:

```bash
bun run generate:spa-data
```

Write to another path or use another integer seed:

```bash
bun scripts/generate-spa-dataset.ts data/my-spa.json 12345
```

Turn positions and performance are intentionally approximate synthetic
controls. They are not surveyed geometry, a racing line, or ground truth about
any real driver or car.
