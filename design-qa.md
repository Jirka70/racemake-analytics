# Delta overview and synchronized region strip — design QA

## Comparison target

- Full-lap source visual truth: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/TemporaryItems/NSIRD_screencaptureui_QxwQ9Y/Screenshot 2026-08-14 at 8.57.56 PM.png`
- Zoomed-state source evidence: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/TemporaryItems/NSIRD_screencaptureui_eB1cpk/Screenshot 2026-08-14 at 9.14.26 PM.png`
- Full-lap implementation: `/Users/jirka/WEB/racemake-hard/tmp/delta-overview/implementation-full-lap.png`
- Zoomed implementation: `/Users/jirka/WEB/racemake-hard/tmp/delta-overview/implementation-zoomed.png`
- Combined comparison inputs: `/Users/jirka/WEB/racemake-hard/tmp/delta-overview/comparison-full-lap.png` and `/Users/jirka/WEB/racemake-hard/tmp/delta-overview/comparison-zoomed.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State A: Lap 3 reviewed against Lap 2, full lap visible, C2 selected.
- State B: Lap 3 reviewed against Lap 2, approximately 23%–78% visible, C6 selected.
- Source pixels: 1438 × 1046 and 2188 × 1016. Implementation pixels and CSS viewport: 1280 × 720 at device scale factor 1.
- The user screenshots are differently cropped desktop captures. For visual comparison, every image was normalized to 1200 px width and the telemetry workspace/footer were judged as the shared content region.

## Full-view comparison evidence

- The footer now includes a compact full-lap time-delta trace between the zoom control and selection summary, matching the source hierarchy.
- The lime trace shows the reviewed-lap delta while the violet zero line represents the second lap baseline.
- The selected corner appears as a translucent violet band in the overview, matching the selected band across the main charts.
- When zoomed, a subtle neutral outline in the overview preserves full-lap context by showing the currently visible chart window.

## Focused comparison evidence

- Before the fix, the zoomed main chart displayed roughly 24%–77% while the region strip remained on a 0%–100% scale; C6 therefore appeared near the middle of the strip while its chart band was at the far right.
- After the fix, both the chart and region strip use the same viewport projection. In the verified zoomed state C3, C4, C5, and C6 occupy their correct visible positions, and C6 aligns with the violet chart band at the right edge.
- Regions outside the visible viewport are omitted; partially visible regions are clipped rather than moved or stretched beyond their real overlap.
- Accessible region labels continue to report original lap positions rather than the projected on-screen percentages.

## Required fidelity surfaces

- Typography: existing compact uppercase labels, lap legend, and selection hierarchy remain unchanged; no text crowding was introduced.
- Spacing and layout rhythm: the footer grows from 56 px to 72 px to fit the overview without compressing the trace or selection controls. Four footer columns remain usable at the application's minimum desktop width.
- Colors and tokens: reviewed-lap lime, second-lap violet, selected-region violet, and neutral viewport outline reuse the existing telemetry palette.
- Image quality and assets: both overview and main telemetry use ECharts canvas rendering; lines remain sharp and no substitute raster, inline SVG, or placeholder asset was introduced.
- Copy and content: `VIEW`, `SELECTION`, actual region position, and the hidden full-lap overview description explain the displayed state without internal analytics terminology.

## Interaction and runtime checks

- Verified full-lap C2 selection.
- Verified three zoom-in steps, producing an approximately 23%–78% viewport.
- Verified selecting C6 after zoom aligns the region strip button, cross-chart band, footer range, and overview band.
- Verified the mini overview keeps the full lap visible while the main chart and region strip zoom together.
- Verified region accessible names keep the source positions after projection.
- React review passed: the expensive chart model is memoized, ECharts instances and observers are disposed, the viewport remains single-source state, and repeated region lookup uses an indexed map.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, and `git diff --check` completed successfully.
- Test result: 319 passed, 0 failed. Lint retains 69 pre-existing warnings and exits successfully.
- Production build retains the existing large-chunk warning; no new build failure was introduced.

## Findings

- P0: none.
- P1: none.
- P2: none within the requested delta-overview and synchronized-region slice.
- P3: the overview is intentionally informational in this slice; direct dragging inside the overview can be added later if it proves more discoverable than the existing chart pan interaction.

## Comparison history

- P1 before fix: the region strip remained at full-lap scale while the chart was zoomed, causing selected corners to be visibly misaligned with their actual telemetry region.
- Fix: all track-region segments are clipped and projected through the same horizontal viewport used by the ECharts data zoom.
- Post-fix evidence: the zoomed combined comparison shows C6 at the far-right edge in both the strip and chart, with matching selection spans.
- The first full-lap overview comparison found no additional actionable P0/P1/P2 mismatch.

final result: passed

---

# Ideal-lap legend and region-sourced telemetry — design QA

## Comparison target

- Selected visual target: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/codex-clipboard-4cfa39d8-837c-4212-b33c-1b6edc1ea5f2.png`
- Verified legend implementation: `/Users/jirka/WEB/racemake-hard/tmp/ideal-lap/legend.png`
- Verified region-source panel: `/Users/jirka/WEB/racemake-hard/tmp/ideal-lap/region-sources.png`
- Verified region-aware tooltip: `/Users/jirka/WEB/racemake-hard/tmp/ideal-lap/region-tooltip.png`
- Combined comparison input: `/Users/jirka/WEB/racemake-hard/tmp/ideal-lap/comparison.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State: Lap 3 reviewed with Lap 2 as the second chart lap, C2 selected, full lap visible, four default charts.

## Visual and information fidelity

- The compact lap legend now matches the source hierarchy with reviewed-lap lime, second-lap violet, and a neutral dotted Ideal entry with its theoretical time.
- Ideal does not masquerade as a recorded lap. Opening its legend entry states that it is theoretical and lists the source lap for all 14 detected track regions.
- The source panel reuses the established dark surface, neutral border, compact uppercase heading, and existing typography without moving the lap cards or chart controls.
- The theoretical trace is neutral gray, dotted, thinner than both real-lap traces, and rendered beneath them so it adds context without obscuring the selected comparison.

## Data and interaction checks

- The Ideal trace is composed from the fastest observed pass through each region; it is not averaged and does not contain a hard-coded lap assignment.
- In C2 the live tooltip reports `Ideal · C2 from Lap 2`; immediately after the region boundary it reports `Ideal · C2-C3 from Lap 4`.
- The complete stint derives all seven corners from Lap 2 and all seven connecting straights from Lap 4. The legend source panel displays the same computed mapping.
- The start/finish-wrapping region is split only for elapsed-time construction and remains one visible `C7-C1` source in the legend.
- The selected real laps plus the unique Ideal source laps are requested in one `/series` call. The default four-channel response for this stint is 308,242 bytes before transport compression.
- Keyboard users can open the native Ideal details control and read the same source mapping; the chart keeps its existing accessible comparison description.

## Verification

- React review passed: time-loss and track requests remain parallel, the derived Ideal definition is memoized, and ECharts instances are not recreated by pointer movement.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, Biome formatting, and `git diff --check` completed successfully.
- Test result: 330 passed, 0 failed. Lint retains 69 pre-existing warnings and exits successfully.
- Production build retains the existing large-chunk warning; no new build failure was introduced.
- Browser console errors: none.

## Findings

- P0: none.
- P1: none.
- P2: none within the requested Ideal-lap legend and region-source slice.
- P3: transferring the additional source lap increases the uncompressed default `/series` response from 214,001 to 308,242 bytes for this stint. Deterministic chart decimation remains the planned network optimization rather than dropping every nth sample.

final result: passed

---

# Multi-chart vertical scrolling — design QA

## Comparison target

- Source visual truth: `/Users/jirka/.codex/generated_images/019fe64a-5e9d-70e3-a89f-c63b99d9b153/exec-55ff0e3a-9526-4513-8d71-9dccd5e3e81d.png`
- Five-chart implementation at the top of the stack: `/Users/jirka/WEB/racemake-hard/tmp/chart-scroll-fix/five-charts-top.png`
- Five-chart implementation after a wheel scroll over the chart: `/Users/jirka/WEB/racemake-hard/tmp/chart-scroll-fix/five-charts-scrolled.png`
- Latest five-chart implementation after reliable wheel scrolling: `/Users/jirka/WEB/racemake-hard/tmp/chart-scroll-fix/five-charts-reliable-wheel.png`
- Combined comparison input: `/Users/jirka/WEB/racemake-hard/tmp/chart-scroll-fix/comparison-source-top-scrolled.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State: Lap 3 reviewed with Lap 2 as the second chart lap, C2 selected, Gear added as the fifth chart, full-lap horizontal viewport.
- Source pixels: 1672 × 941. Implementation screenshots and CSS viewport: 1280 × 720 at device scale factor 1. The source was normalized to 1280 × 720 for the three-panel comparison.

## Full-view comparison evidence

- The lap picker and region strip keep their existing positions while the telemetry rows alone form the vertical scroll area.
- The full-lap overview, horizontal zoom controls, and selected-region navigation remain persistently visible at the bottom of the telemetry workspace.
- The coaching rail remains independent and does not shift while the chart stack scrolls.
- Adding a fifth row does not compress the existing graph rows below their intended readable height.

## Focused interaction evidence

- Before the wheel gesture, Time delta is visible at the top and Gear begins at the bottom of the chart viewport.
- After a normal wheel gesture over the ECharts canvas, the chart stack moves down to reveal the complete Gear plot while the footer stays at the same screen coordinates.
- A 12 px high-resolution trackpad-style gesture moves the stack from 0 px to 12 px and the inverse gesture returns it to 0 px. A 120 px mouse-wheel-style gesture reaches the 72 px boundary and the inverse gesture returns it to 0 px.
- The horizontal chart zoom remains at `0` after the wheel gesture, proving that vertical scrolling no longer changes the track-position viewport.
- The explicit zoom button still changes the horizontal zoom to `15`, preserving intentional zoom control.

## Required fidelity surfaces

- Typography: chart labels, axis labels, and footer hierarchy are unchanged.
- Spacing and layout rhythm: only the chart row is scrollable; the 108 px lap picker, 44 px region strip, and 72 px footer tracks remain stable.
- Colors and visual tokens: no color, border, opacity, or selected-region treatment changed.
- Image quality and assets: ECharts canvas rendering remains sharp during and after scrolling; no replacement assets were introduced.
- Copy and content: chart names, footer labels, lap context, and coaching content remain unchanged.

## Findings and comparison history

- P0: none.
- P1 before fix: a normal wheel gesture over the chart was consumed by ECharts horizontal zoom, so the fifth chart could only be reached with the scrollbar; scrolling the workspace also moved the full-lap overview and controls off screen.
- Fix: wheel zoom was disabled for the inside data-zoom controller, and vertical overflow was moved from the whole telemetry workspace to the chart stack only.
- P1 found during follow-up interaction testing: disabling ECharts wheel zoom alone did not make wheel delivery deterministic. Small trackpad deltas and reverse-direction gestures could still be consumed by the chart canvas, producing little or no vertical movement.
- Follow-up fix: the chart-stack container now captures vertical wheel gestures before they reach ECharts, normalizes pixel-, line-, and page-based deltas, scrolls the stack directly, and leaves horizontal zoom to the explicit footer controls. Tooltip activation no longer listens to wheel events.
- Post-fix evidence: the latest five-chart capture shows Gear fully visible and the footer fixed in place. Browser interaction checks confirm small trackpad-style deltas and large mouse-wheel-style deltas work in both directions while horizontal zoom stays at `0`.
- P1 after fix: none.
- P2: none.
- P3: the native overlay scrollbar remains intentionally subtle; the primary wheel/trackpad gesture now works without requiring users to target it.

## Verification

- Normal wheel gesture over the chart scrolls the chart stack vertically.
- High-resolution trackpad-style wheel deltas scroll in both directions without being dropped.
- Conventional mouse-wheel deltas scroll in both directions and clamp cleanly at the stack boundaries.
- Horizontal zoom does not change during vertical scrolling.
- Footer overview and controls remain visible before and after scrolling.
- Explicit horizontal zoom control remains functional.
- Fresh browser console errors: none.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, Biome formatting, and `git diff --check` completed successfully.
- Test result: 327 passed, 0 failed. Lint retains 69 pre-existing warnings and exits successfully. The production build retains the existing large-chunk warning.

final result: passed

---

# Telemetry chart selector — design QA

## Comparison target

- Selected visual target: `/Users/jirka/.codex/generated_images/019fe64a-5e9d-70e3-a89f-c63b99d9b153/exec-55ff0e3a-9526-4513-8d71-9dccd5e3e81d.png`
- Verified implementation: `/Users/jirka/WEB/racemake-hard/tmp/channel-selection/implementation-verified-open.png`
- Combined comparison input: `/Users/jirka/WEB/racemake-hard/tmp/channel-selection/comparison-source-implementation.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State: Lap 3 reviewed with Lap 2 as the second chart lap, C2 selected, full lap visible, four default charts selected, selector open.
- Source pixels: 1672 × 941. Implementation screenshot and CSS viewport: 1280 × 720 at device scale factor 1. The source was normalized to 1280 × 720 before the side-by-side comparison.

## Full-view comparison evidence

- The selector is positioned beside the lime/violet lap legend, outside the horizontally scrolling lap-card list, so it remains discoverable and its popover is not clipped.
- The compact `4 CHARTS` trigger preserves the source hierarchy without competing with the lap-review controls.
- The open popover overlays the chart workspace without moving the region strip, charts, footer, or coaching rail.
- Existing telemetry colors, dark surfaces, borders, compact uppercase labels, and square control geometry are preserved.

## Focused selector evidence

- The implementation preserves the source grouping: `PRIMARY` contains Time delta, Speed, Pedals, and Steering; `ADDITIONAL` contains Gear, RPM, and Tyre temperatures.
- Checked boxes use the established Racemake lime and unchecked controls use the neutral border treatment.
- `Reset to default` is visibly disabled in the default state and becomes available after a selection changes.
- The popover width, row spacing, label hierarchy, and anchor relationship remain close to the selected visual while using real accessible checkbox controls.

## Interaction and runtime checks

- Verified opening and closing the selector, including outside-click and Escape behavior.
- Verified enabling Gear changes the trigger to `5 CHARTS` and renders a Gear row.
- Verified enabling Gear, RPM, and Tyre temperatures changes the trigger to `7 CHARTS` and renders all seven rows.
- Verified hiding Speed changes the trigger to `3 CHARTS`, removes the Speed row, and reset restores the default four charts.
- The final visible chart cannot be unchecked, preventing an empty telemetry workspace.
- Only channels required by the selected rows are requested from `/series`; optional RPM, gear, and tyre channels are not transferred in the default view.
- Browser console errors: none in a fresh analysis tab.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, Biome formatting, and `git diff --check` completed successfully.
- Test result: 324 passed, 0 failed. Lint retains 69 pre-existing warnings and exits successfully. The production build retains the existing large-chunk warning.

## Findings and comparison history

- P0: none.
- P1: none.
- P2 before fix: the first Gear row used one y-axis label per gear, producing unnecessary label density.
- Fix: the Gear axis keeps the full reverse-to-eighth range but uses a three-gear tick interval; individual gear values remain available in the shared tooltip.
- P2 after fix: none.
- P3: the implementation popover is slightly narrower than the generated target because it follows the existing 1280 px application density; copy remains fully visible and the control does not cover the coaching rail.

final result: passed
