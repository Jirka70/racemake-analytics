# First-use telemetry controls guide — design QA

## Comparison target

- Source visual truth: `/Users/jirka/.codex/generated_images/01a0167f-54e8-7f72-8b07-e0cd600da25c/exec-554743ef-1e9e-447f-afc9-898c79c87c9f.png` (1586 × 992 px).
- Browser implementation: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-controls-guide-desktop-1586x992-final.png`, rendered at the same 1586 × 992 CSS viewport with device pixel ratio 1.
- Same-size full-view comparison: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-controls-guide-qa-comparison-final.png`; the two 1586 × 992 originals are placed side by side without scaling or density normalization.
- Focused guide-and-zoom comparison: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-controls-guide-qa-focused-final.png`; equal 520 × 300 crops from the same source and implementation images.
- Responsive evidence: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-controls-guide-medium-final.png` at 800 × 900, `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-controls-guide-mobile-final.png` at 390 × 844, and `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-controls-guide-mobile-move-final.png` at 390 × 844.
- Target-spotlight evidence: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-controls-guide-spotlight-desktop.png`, `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-controls-guide-spotlight-medium.png`, and `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-controls-guide-spotlight-mobile.png` show the production selection line, point marker, and details panel at 1280 × 900, 800 × 900, and 390 × 844.
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`.
- State: Lap 3 reviewed against Lap 2, C2 selected, full-lap viewport, and the first-time chart-controls guide open.

## Full-view and focused comparison evidence

- The implementation retains the source placement and hierarchy: a compact dark coach card above the chart footer, lime heading and active action, progress, navigation, and a clearly outlined real zoom control.
- The source's `Scroll or pinch over the chart to zoom` statement and mouse-wheel illustration are intentionally not reproduced because the production ECharts configuration has `zoomOnMouseWheel: false`. The implementation truthfully says to drag the slider or use the magnifier buttons and uses the existing Phosphor magnifier icon.
- Zoom is the first step rather than the source's second step because chart panning becomes available only after the viewport has been zoomed. The following steps explain drag/horizontal trackpad movement and selecting the visibly highlighted telemetry series.
- Every step now exposes its real target above the dimmed backdrop: the zoom controls for zoom, the chart interaction surface for panning, and a production-selected telemetry series for inspection. The panning step deliberately does not highlight a line. The inspection step renders the selected line in front, its actual point marker and the same details panel produced by a user click.

## Required fidelity surfaces

- Fonts and typography: existing RACEMAKE font stack, uppercase micro-labels, compact body copy, tabular progress count, weights and line heights remain consistent with the product and source hierarchy. Copy wraps cleanly at all tested widths.
- Spacing and layout rhythm: the desktop card aligns above the footer near its target; medium and mobile cards retain large touch targets and stay clear of the docked coaching sheet. The mobile zoom step moves the existing scroll container just enough to expose the real controls.
- Colors and visual tokens: the existing near-black surfaces, neutral borders, lime action color and product focus outlines are reused. A restrained 35% backdrop keeps the chart context readable.
- Image quality and assets: no raster or product asset was replaced. All visible guide symbols come from the installed Phosphor icon library; there are no custom SVG, CSS or text-glyph illustrations.
- Copy and content: every instruction maps to implemented behavior. The guide contains no wheel-zoom or pinch claim, differentiates mouse/trackpad desktop movement from mobile swipe, and names selection as hover-highlight followed by click on desktop.

## Interaction, persistence and responsive verification

- Verified Next and Back through all three steps on desktop and mobile, including presentation-specific copy.
- Verified that entering the inspection step creates a deterministic selection from currently visible non-null telemetry, while Back or dismissal removes only that guide-owned selection. The demonstration point remains inside the active viewport and is offset on compact layouts so its point marker is not covered by the details panel.
- Verified close, reload suppression, and the versioned `localStorage` first-use marker. The final preview uses the next guide key and is intentionally left open for inspection.
- Verified live 1586 → 800 → 390 px resizing. The active step survives layout changes, and a deferred resize reveal keeps mobile zoom controls visible after responsive reflow.
- The dialog receives initial focus, traps Tab within its actions, supports Escape, exposes explicit close/skip controls, and retains at least 40 px action targets.
- Clean browser reload reports no console errors. The final in-app browser state is marked deliverable with the first guide step open.

## Findings and comparison history

- P1 source mismatch identified before implementation: the selected concept advertised wheel/pinch zoom that the graph does not support. Fix: replace the claim and mouse-wheel visual with the actual slider/magnifier interaction. Post-fix evidence is the full-view and focused final comparison above.
- P2 first responsive pass: after an already-compact viewport changed from 800 to 390 px, responsive reflow could move the highlighted zoom controls below the coaching dock. Fix: defer the target reveal to the next animation frame on resize. Post-fix 390 px geometry places the control at 733–844 px and the final mobile capture keeps it visibly outlined.
- P1 target-spotlight pass: placing the chart above the backdrop also placed it above the guide card because both originally shared one stacking context. Fix: render the backdrop and dialog as sibling fixed layers, with the real target between them.
- P2 inspection pass: a centered compact demonstration point could be covered by its own details panel. Fix: choose a visible, non-null sample toward the right side of the current viewport, with deterministic fallback to another reviewed series when the preferred speed trace is unavailable.
- P0/P1/P2 after the fixes: none.
- P3: the implementation card is slightly taller than the source because it adds an explicit close action, a `Chart controls` context label, and more descriptive truthful copy. These additions improve first-use clarity without obscuring the target.

## Verification

- Focused guide and series-selection tests: 15 passed, 0 failed.
- Full repository tests: 425 passed, 0 failed.
- Root and frontend TypeScript checks, scoped lint, full lint, production build, production data analysis and `git diff --check` pass. Full lint retains 67 pre-existing warnings; the build retains the existing large-chunk warning.

final result: passed

---

# Limited-lap telemetry comparison — design QA

## Comparison target

- Source visual truth: `/Users/jirka/.codex/generated_images/01a02687-2248-76a0-80cd-8e38de2ba7e9/exec-d01af478-5104-49f5-9b86-677529c00309.png` (1496 × 1058 px).
- Browser implementation: `/Users/jirka/WEB/racemake-hard/artifacts/design-qa-limited-lap-telemetry-desktop.png`, rendered at the same 1496 × 1058 CSS viewport.
- Direct comparison input: `/Users/jirka/WEB/racemake-hard/artifacts/design-qa-limited-lap-telemetry-comparison.png`.
- Route: `http://localhost:4173/analysis/sha256:07e6fd1b02c9d9b887c02da460a6518fbf731b8142dde5e2f6a7fc9989426087`.
- State: limited Lap 4 reviewed against verified Lap 2, C2 selected, coaching-availability explanation hovered, and coaching rail unavailable.

## Full-view comparison evidence

- A limited lap is selectable for telemetry review but cannot become the verified reference or be swapped into that role.
- Time Delta, Speed, Pedals and Steering remain visible and comparable. The reviewed limited trace and overview are amber; the verified reference remains violet.
- Time Delta carries an `APPROXIMATE` badge and the plain-language `Boundary timing is uncertain` explanation instead of pretending that the boundary-derived delta is verified.
- The limited card, information tooltip and unavailable coaching rail preserve the approved hierarchy and copy.
- C2 selection remains functional and shades the same track-position interval through every chart.

## Required fidelity surfaces

- Fonts, compact labels, tabular times, borders, four-pixel radii and the existing near-black RACEMAKE surfaces are unchanged.
- Amber is used consistently for limited review data, violet for the verified reference and lime only for verified reviewed-lap states and region selection.
- All information and empty-state symbols come from the installed Phosphor icon library; no replacement asset or custom SVG was introduced.
- The implementation intentionally uses measured fixture data. The mock's amber sampling-gap band and coaching marker are absent because this Lap 4 has uncertain boundary timing but no reported interior sampling gap or coaching finding. No telemetry damage is fabricated to match the illustration.

## Interaction and accessibility verification

- Verified selecting Lap 4, retaining Lap 2 as reference, disabled Swap, previous/next review navigation, C2 selection and all four chart channels.
- Verified the coaching information tooltip on pointer hover and keyboard-addressable information/details actions.
- Verified the chart status exposes `Time delta is approximate because boundary timing is uncertain` and the canvas description names Lap 4 versus Lap 2.
- Verified the limited selection has an amber focus treatment rather than the verified-lap lime treatment.

## Findings and comparison history

- P2 initial browser pass: the selected limited card inherited the verified lap's lime focus outline.
- Fix: limited review cards now use an amber focus outline. The final implementation screenshot and direct comparison contain the corrected state.
- P0/P1/P2 after the fix: none.
- P3: the production header reports three ranked racing laps, and the horizontal strip scrolls Lap 4 into view beside the closing fragment. These are evidence-driven differences from the illustrative mock and are not hard-coded away.

## Verification

- Focused selection and data-quality tests: 15 passed, 0 failed.
- Clean-overlay full repository suite: 434 passed, 0 failed.
- Clean-overlay root and frontend TypeScript checks, full lint, production data analysis and production frontend build pass. Lint retains 70 pre-existing warnings; the build retains the existing large-chunk warning.
- Scoped changed-file Biome check and `git diff --check` pass in the working tree.
- The working tree's repo-wide commands are currently blocked by the unrelated existing `co znmconst` syntax text in `src/analytics/corner-detect/detect-corners.ts:50`; the clean overlay corrected only that text and did not modify the user's worktree.

final result: passed

---

# Limited-lap details — design QA

## Comparison target

- Desktop source visual truth: `/Users/jirka/.codex/generated_images/01a02687-2248-76a0-80cd-8e38de2ba7e9/exec-c02de21f-b330-4971-b84c-29265c6a989d.png` (1487 × 1058 px).
- Desktop browser implementation: `/Users/jirka/WEB/racemake-hard/artifacts/design-qa-limited-data-desktop-final.png` (1487 × 1028 px), rendered from a requested 1487 × 1058 browser viewport; the in-app browser reserved 30 px for its own chrome.
- Desktop combined comparison: `/Users/jirka/WEB/racemake-hard/artifacts/design-qa-comparison-desktop.png`; the source was cropped only at the bottom to 1487 × 1028, then placed beside the implementation without scaling.
- Mobile source visual truth: `/Users/jirka/.codex/generated_images/01a02687-2248-76a0-80cd-8e38de2ba7e9/exec-5e816b4e-754e-4a09-b6bf-c408fc245cc0.png` (852 × 1846 px at Retina density).
- Mobile browser implementation: `/Users/jirka/WEB/racemake-hard/artifacts/design-qa-limited-data-mobile-final.png`, rendered and captured at 426 × 923 CSS pixels with density 1.
- Mobile combined comparison: `/Users/jirka/WEB/racemake-hard/artifacts/design-qa-comparison-mobile.png`; the source was normalized to 426 × 923 and placed beside the equal-size implementation.
- State: the generated low-confidence-finish stint, Lap 3 reviewed against fastest Lap 2, Lap 4 marked `LIMITED DATA`, with the desktop popover or mobile inline `DETAILS` section open.

## Full-view and focused comparison evidence

- The desktop implementation preserves the approved hierarchy: amber outlined limited-lap card, approximate time, plain-language summary, review-only/ranking impact, an information action, and a popover anchored below the card rather than inside the coaching rail.
- The mobile implementation keeps the same evidence inside the open lap selector, expands it in normal document flow, and leaves the Reference selector below it. It does not introduce a drawer or a multi-select affordance.
- The combined images serve as both full-view and focused evidence because the desktop comparison retains the full 2986 × 1028 originals and the mobile comparison retains both complete 426 × 923 states; all card and detail copy is legible at original resolution.
- The source's illustrative `~1:13.590`, 240 ms and 98.7% → 1.8% values are intentionally replaced by the production fixture's actual `~1:12.911`, 250 ms and 98.7% → 1.1% evidence. The header reports three racing laps because the limited lap is returned for review but excluded from ranking.

## Required fidelity surfaces

- Fonts and typography: the existing RACEMAKE font stack, uppercase micro-labels, tabular lap times, compact body size and established weights are reused. Detail headings, evidence rows and impact copy wrap without clipping.
- Spacing and layout rhythm: the larger limited card gets a dedicated desktop row height; opening Details brings the full card into view before anchoring the popover. Mobile uses the approved Reviewed → list/detail → Reference → Swap document order.
- Colors and visual tokens: existing near-black surfaces, neutral borders, amber limitation state, lime availability checks, violet Reference state and product focus outlines are preserved.
- Image quality and assets: the RACEMAKE brand asset is unchanged. Information, warning, close, caret and check symbols come from the installed Phosphor library; no custom SVG, CSS illustration, emoji or replacement raster asset was introduced.
- Copy and content: confidence values remain API-only. The UI explains the actual recorder failure, exact observed transition, affected uses and remaining usable data in nontechnical language.

## Interaction and accessibility verification

- Uploaded and analyzed `data/stint-low-confidence-finish.telemetry.json` through the production UI.
- Verified desktop Details open, anchored repositioning after the lap strip scrolls, close button, outside dismissal and Escape dismissal with focus restoration.
- Verified mobile Reviewed selector open/close, inline Details expand/collapse, Reference selector remaining below the detail, and Escape dismissal.
- Limited Lap 4 cannot be selected for verified time comparison, while its separate Details control remains keyboard and pointer accessible.
- Browser console warnings/errors after the final interactions: none.

## Findings and comparison history

- P2 initial desktop pass: centering the reviewed Lap 3 left most of the wider Lap 4 card clipped by the horizontal strip. Fix: opening Details first scrolls the complete Lap 4 card into view, then anchors the portal to the information action and follows later strip movement. Post-fix evidence is the final desktop comparison.
- P2 initial mobile pass: an extra coaching-impact sentence made the detail taller than the approved state and pushed the Reference card under the coaching dock. Fix: retain the two approved time/ranking impact statements; backend `usage.coaching` still controls supported-region messaging where applicable. Post-fix evidence keeps the Reference card visible.
- P0/P1/P2 after fixes: none.
- P3: production fixture values and the additional closing fragment differ from the illustrative mock data. These are expected evidence-driven differences and should not be hard-coded to match the image.

## Verification

- Focused presentation and low-confidence fixture tests pass.
- Full clean-overlay suite: 432 passed, 0 failed.
- Root and frontend TypeScript checks pass in the clean overlay used to isolate the user's unrelated worktree syntax edit.
- Full lint exits successfully with 70 pre-existing warnings; scoped changed-file checks have no diagnostics.
- Production frontend build passes with the existing large-chunk warning.

final result: passed

---

# Inline mobile channel selector — design QA

## Evidence

- Source visual truth: `/Users/jirka/WEB/racemake-hard/mobile-channel-selector-concept-v2.png`
- Initial browser comparison: `/Users/jirka/WEB/racemake-hard/mobile-channel-selector-design-qa.jpg`
- Final radio-state implementation: `/Users/jirka/WEB/racemake-hard/mobile-channel-selector-radio.jpg`
- Post-selection RPM state: `/Users/jirka/WEB/racemake-hard/mobile-channel-selector-rpm.jpg`
- Viewport: `390 x 844` CSS pixels at device scale factor `1`
- Source pixels: `853 x 1844`; normalized to `390 x 844` in the comparison
- Implementation pixels: `390 x 844`
- State: comparison analysis, inline channel selector expanded, Delta selected

## Full-view comparison

The implemented control follows the approved interaction model: it expands in
normal document flow immediately below the `CHANNELS` trigger, pushes the chart
down, and does not use or overlap the coaching sheet. All seven comparison
channels are visible without horizontal clipping.

The surrounding lap cards differ from the generated concept because the
implementation preserves the product's existing compact responsive layout.
That surrounding layout was not part of the selected channel-picker change.

## Focused comparison

The focused comparison confirms the same two-column option rhythm, a full-width
tyre-temperature option, lime selected state, compact borders, and attached
trigger/panel composition. Project-native Phosphor icons replace the generated
mockup's approximate icons and remain consistent with the existing interface.
The final pass replaces square checkbox affordances with circular native radio
controls, making the single-selection model explicit.

## Required fidelity surfaces

- Fonts and typography: existing project typography is preserved; hierarchy,
  weights, uppercase trigger label, and compact option labels match the target.
- Spacing and layout rhythm: the attached panel, two-column grid, touch targets,
  gaps, borders, and full-width final option match the approved direction.
- Colors and visual tokens: existing charcoal surfaces, neutral borders, white
  labels, and lime active state are reused without introducing new tokens.
- Image and icon fidelity: the RACEMAKE brand asset is unchanged; channel icons
  use the installed Phosphor library rather than custom SVG or CSS drawings.
- Copy and content: Delta, Speed, Pedals, Steering, Gear, RPM, and Tyre
  temperatures are present and readable.

## Interaction verification

- Opened and closed the inline selector from the `CHANNELS` trigger.
- Confirmed all seven channel options are exposed in comparison mode.
- Confirmed the fieldset exposes seven native radios and exactly one checked
  value before and after changing channels.
- Selected RPM and confirmed the selector closed and the RPM chart rendered.
- Selected Tyre temperatures and confirmed the full label in the panel, the
  compact `Tyres` trigger label, and the tyre-temperature chart rendered.
- Confirmed the collapsed coaching control remains a separate bottom surface.
- Browser console warnings/errors checked: none.

## Findings

- P2 before the final pass: square checkbox indicators suggested that multiple
  charts could be selected even though compact mode renders one channel.
- Fix: replace the checkbox visuals and toggle-button semantics with one native
  radio group and Phosphor circle/radio indicators.
- P0/P1/P2 after the fix: none.

## Comparison history

- Pass 1: no actionable P0/P1/P2 mismatch was found. No visual correction loop
  was required.
- Pass 2 after user feedback: radio semantics and circular indicators now make
  the mutually exclusive choice explicit; browser evidence confirms exactly one
  checked radio and the selected RPM chart.

## Follow-up polish

No P3 follow-up is required for this scoped change.

## Verification

- Focused mobile selection test: 6 passed, 0 failed.
- Clean root and frontend TypeScript checks pass.
- Full repository tests: 427 passed, 0 failed.
- Full lint exits successfully with 69 pre-existing warnings.
- Production frontend build and production data analysis pass. The build retains
  the existing large-chunk warning.

final result: passed

---

# Footer cursor-position indicator — design QA

## Comparison target

- Source visual truth: `/Users/jirka/.codex/generated_images/01a0167f-54e8-7f72-8b07-e0cd600da25c/exec-9ce31592-7491-4f6a-abbb-6b62cb6421e9.png` (1586 × 992 px).
- Browser implementation: `/tmp/racemake-cursor-minimap-implementation-1536x960-final.png`, rendered at a 1536 × 960 CSS viewport and device pixel ratio 1.
- Normalized same-state comparison: `/tmp/racemake-cursor-minimap-comparison.png`; the source was proportionally normalized to the implementation viewport for a direct side-by-side review.
- Focused footer comparison: `/tmp/racemake-cursor-minimap-footer-comparison.png`.
- Responsive evidence: `/tmp/racemake-cursor-minimap-implementation-800x900.png` and `/tmp/racemake-cursor-minimap-implementation-390x844.png`, captured at matching CSS viewports and device pixel ratio 1.
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`.
- State: Lap 3 reviewed against Lap 2, C2 selected, chart zoomed to a centered 55% lap span, and the linked chart cursor at 47.9%.

## Full-view and focused comparison evidence

- The footer overview now repeats the active main-chart cursor as a one-pixel neutral line, a circular top-edge marker, and a compact tabular percentage label.
- The indicator uses the global 0–100% lap coordinate, so 47.9% stays at the same overview position when the main chart is zoomed or horizontally panned.
- The implementation preserves the source hierarchy and existing footer controls. It intentionally retains the production zoom control styling instead of copying the source mock's blue focus treatment.
- Focused comparison confirms that the marker, line and label align with the main chart's 47.9% axis pointer and remain legible without obscuring the delta traces, viewport outline or selected-region shading.

## Interaction and responsive verification

- ECharts `updateAxisPointer` events are the source of truth; the footer does not infer cursor position from viewport width alone.
- Moving the pointer across the chart updates the main cursor and overview indicator together; leaving the shared chart surface removes the footer indicator.
- A horizontal trackpad gesture updates the axis pointer after every viewport movement, so the marker continues to describe the data beneath the stationary physical cursor during a swipe.
- Zoom was verified at full-lap and 85%/55% spans. The same 47.9% point remained globally aligned in the overview.
- Desktop (1536 × 960), tablet (800 × 900), and mobile (390 × 844) layouts show the same interaction. The mobile/tablet label remains inside the viewport and is not clipped by the compact footer.
- Browser console warnings/errors: none.

## Verification

- New cursor-event unit tests: 4 passed, 0 failed.
- Full repository tests: 402 passed, 0 failed.
- Root and frontend TypeScript checks pass.
- Scoped Biome checks, full lint, production build, production data analysis and `git diff --check` pass. Full lint retains 67 pre-existing warnings; the build retains the existing large-chunk warning.

## Findings and comparison history

- P1 first interaction pass: after a horizontal swipe, the viewport moved but the footer marker retained the pre-swipe data position because the custom wheel handler prevented ECharts from receiving a native wheel-triggered axis update.
- Fix: after each animation-frame viewport update, dispatch the linked axis-pointer update at the current physical pointer coordinates. Browser evidence changed from a stale 47.9% marker to the correct 42.5% marker after the same stationary-cursor pan.
- P0/P1/P2 after the fix: none.
- P3: the implementation label is slightly more compact than the generated concept, matching the production footer's existing typography and leaving more of the overview trace visible.

final result: passed

# Mobile lap comparison and sampling-gap hover — design QA

## Comparison target

- Mobile source visual truth: `/Users/jirka/.codex/generated_images/01a0167f-54e8-7f72-8b07-e0cd600da25c/exec-c26c905b-f7cc-4006-8c7c-f6d3b1a5ce2a.png` (864 × 1821 px).
- Mobile browser implementation: `/tmp/racemake-mobile-picker-open-final.png`, rendered at a 390 × 844 CSS viewport and captured at device pixel ratio 1 (390 × 844 px).
- Mobile full-view combined comparison: `/tmp/racemake-mobile-design-qa-combined-final.png`; the source and implementation were proportionally normalized to the same 720 px comparison height because the generated source is a taller concept image rather than an exact CSS-viewport capture.
- Mobile focused comparison: `/tmp/racemake-mobile-design-qa-focused-final.png`.
- Desktop source visual truth: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/codex-clipboard-da972838-d29b-426e-8b77-854322f08113.png` (1536 × 1024 px).
- Desktop browser implementation: `/tmp/racemake-desktop-gap-hover.png`, rendered and captured at 1536 × 1024 CSS pixels and device pixel ratio 1; no density normalization was required.
- Desktop full-view combined comparison: `/tmp/racemake-desktop-gap-qa-combined.png`.
- Desktop focused tooltip comparison: `/tmp/racemake-desktop-gap-qa-focused.png`.
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`.
- Mobile state: Reviewed Lap selector open with Lap 3 selected, Lap 2 as the reference, Lap 1 visibly carrying a measured 95.5% telemetry-coverage warning, and Swap available.
- Desktop state: Lap 1 reviewed against Lap 2 with the 50.1–54.6% telemetry gap hovered.

## Full-view and focused comparison evidence

- The mobile implementation preserves the selected concept's hierarchy: `COMPARE LAPS`, lime Reviewed selector, violet Reference selector, explicit Swap action, track regions, telemetry channels, chart, and docked coaching surface.
- The open Reviewed menu is in normal document flow, so the Reference selector remains visible instead of being covered. It adds measured gap coverage and a position bar to the Lap 1 option; this is an intentional evidence-backed enhancement over the source mock.
- At 800 px the same controls use a compact three-column composition without wrapping or clipping; at 390 px they follow Reviewed → Reference → Swap vertically.
- The desktop implementation matches the supplied hover state: a subdued amber gap band, coach-readable tooltip beside the band, affected lap, exact track-position range, measured unavailable duration, and the computed statement that Lap 2 remains available.
- Focused comparisons were required because selector text, option states, telemetry coverage, tooltip copy, and icon alignment were too small to judge reliably from the full views alone.

## Required fidelity surfaces

- Fonts and typography: the existing RACEMAKE font stack, uppercase labels, tabular lap times, compact weights, truncation, and line heights are retained. Labels and values remain legible at 390 and 800 px.
- Spacing and layout rhythm: selectors use 64 px touch targets, consistent four-pixel radii and existing borders. Opening a list expands the workspace rather than obscuring the second selector. No horizontal viewport overflow was observed.
- Colors and visual tokens: existing near-black surfaces, lime reviewed state, violet reference state, amber data-quality state, neutral disabled state, and focus outlines map directly to the source and product tokens.
- Image quality and assets: no raster asset was replaced. The existing RACEMAKE mark and Phosphor icons remain sharp; no custom SVG, CSS illustration, emoji, or placeholder asset was introduced.
- Copy and content: lap numbers, times, fastest status, deltas, coverage, gap location and duration are derived from the active analysis. The tooltip only says another lap remains available when its own sampling gaps do not overlap the affected range.

## Interaction and accessibility verification

- Verified changing Reviewed Lap and Reference Lap independently, preventing the same lap from being chosen in both roles, selecting Lap 1 with a gap, selecting Lap 4 as reference, and swapping both roles.
- Verified open/close for both selectors, outside-pointer dismissal, Escape dismissal, and keyboard Enter activation.
- Verified that a mouse hover shows the sampling-gap tooltip and moving away hides it; a mouse click does not latch the tooltip open.
- Verified that keyboard focus exposes the same tooltip and that its `aria-describedby` relationship points to the rendered explanation.
- Verified responsive layouts at 390 × 844, 800 × 900 and 1536 × 1024.
- Browser console errors: none.
- Focused frontend tests: 31 passed, 0 failed. TypeScript checks, scoped lint, full lint, production build, production data analysis and `git diff --check` pass. Full repository tests report 394 passed and 3 pre-existing fixture failures because `data/stint-limited.telemetry.json` and `data/spa-synthetic.telemetry.json` are absent.

## Findings and comparison history

- P2 first mobile comparison: Swap appeared between the two selectors on phone width, while the selected concept placed both selectors together and Swap afterward.
- Fix: responsive ordering now renders Reviewed → Reference → Swap on phones and Reviewed → Swap → Reference at the wider compact breakpoint.
- Post-fix visual evidence: `/tmp/racemake-mobile-design-qa-combined-final.png` and `/tmp/racemake-mobile-design-qa-focused-final.png`.
- P1 interaction check: the first named-group CSS variant showed the tooltip on hover but not on keyboard focus.
- Fix: use the stable parent `group-focus-within` variant, preserve keyboard focus behavior, and suppress mouse-only focus so clicks do not create a persistent tooltip.
- Post-fix evidence: browser-computed tooltip visibility is `visible` on keyboard focus and `hidden` after a mouse click followed by pointer exit.
- P0/P1/P2 after fixes: none.
- P3: the implementation's Lap 1 menu row is taller than the generated concept because it exposes the requested measured gap state and position bar. This intentional difference improves scanability and does not block fidelity.

final result: passed

---

# Responsive analysis interaction follow-up — design QA

## Comparison target

- Source visual truth: the six user-provided screenshots from 2026-08-18 at 7.01.38 PM through 7.08.56 PM in `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/TemporaryItems/`.
- States represented: narrow desktop overflow, compact sampling gap, compact corner band, expanded coaching summary with multiple findings, coaching summary truncation, and docked coaching over the chart footer.
- Browser-rendered post-fix implementation screenshot: not captured. The controlled in-app browser still reports the local analysis tab as unreachable, despite the user's separately captured page being available.

## Findings from the supplied evidence

- P0: wheel gestures over the ECharts canvas did not reach the vertically scrollable compact workspace, making the lower chart axis and overview inaccessible.
- P1: the desktop layout remained active at tablet/narrow-desktop widths, causing the header, lap picker, region band, chart and coaching rail to compete for fixed horizontal space.
- P1: compact coaching truncated the actual coaching call, so `View evidence` appeared to reveal missing coaching copy rather than supporting telemetry.
- P2: the compact header omitted `Open stint` and did not adapt the data-quality action to narrow widths.
- P2: the corner strip used fixed-width cells without filling wider compact viewports, leaving a misleading blank tail after C7.
- P2: missing-telemetry details were exposed before activation and escaped the narrow amber gap.
- P2: the multiple-finding counter lacked explicit centered alignment.

## Implemented corrections

- Compact layout now covers viewports through 1023 px and chart-overlay CSS switches at the same 1024 px boundary.
- Wheel input over the chart targets the compact workspace; desktop keeps scrolling its multi-chart stack. The compact region band converts vertical wheel input to bounded horizontal movement only while more corners remain off-screen.
- The compact header always exposes `Open stint` and data quality, using icon-only controls on phone widths and labeled controls when space permits.
- Corner cells use a data-derived minimum strip width and flex to fill the viewport when all corners fit.
- Sampling-gap details are collapsed behind an in-band `More` control and expand only on activation.
- Coaching summary renders the complete coaching call; `View telemetry evidence` is now the separate evidence action, with an explicit return to `Coaching call`.
- Finding navigation uses symmetric columns and an explicitly centered counter.

## Verification evidence

- Focused responsive and wheel tests pass, including the 390, 800, 1023 and 1024 px layout boundary and both compact-workspace and desktop-chart wheel targets.
- Root and frontend TypeScript checks pass.
- Production build passes with the existing large-chunk warning.
- Full repository test suite and production data analysis pass.
- Full lint exits successfully with the repository's existing 70 warnings; scoped Biome checks have no diagnostics.
- Browser interaction and post-fix visual comparison remain blocked until a post-fix page capture is available.

final result: blocked

---

# Coaching panel scroll and viewport fix — design QA

## Reported failure

- Source screenshot: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/TemporaryItems/NSIRD_screencaptureui_qQoOMc/Screenshot 2026-08-18 at 6.18.42 PM.png`
- The fixed coaching sheet occupied most of the viewport, covered the telemetry chart, and exposed no usable vertical scroll or minimize path.
- The screenshot's wide CSS viewport had incorrectly entered the compact layout because the JavaScript breakpoint extended to 1119 px.

## Implemented correction

- Compact analysis now activates only through 767 px, matching a phone-specific layout rather than a narrow desktop/tablet layout.
- The mobile coaching surface starts as a 68 px dock. Summary and evidence are explicit expanded states with a visible minimize control.
- Summary uses a maximum height of 52dvh; evidence uses 76dvh. Both expose bounded vertical scrolling with touch panning and overscroll containment.
- The telemetry workspace reserves only the dock height, so the chart stays reachable while coaching is collapsed.

## Verification

- Root and frontend TypeScript checks pass.
- Production build passes with the existing large-chunk warning.
- All 381 repository tests pass.
- `bun run analyze:data` passes.
- Scoped Biome checks and `git diff --check` pass.
- A same-state implementation screenshot could not be captured because the controlled browser would not reopen the local hash route, so final visual/gesture QA remains blocked pending a manual reload in the user's existing local tab.

final result: blocked

---

# Responsive mobile analysis — design QA

## Comparison target

- Source visual truth, default mobile state: `/Users/jirka/.codex/generated_images/01a01454-d575-7342-b766-dd617ba6e124/exec-c5117835-8f39-4885-8650-dc364973a9e5.png`
- Source visual truth, expanded evidence: `/Users/jirka/.codex/generated_images/01a01454-d575-7342-b766-dd617ba6e124/exec-aab31d5d-bdf4-4110-9084-e8dd52d17fdb.png`
- Additional source states: single lap `exec-b36406ce-4a36-445a-90ff-37c4a8b154a8.png`, fragment `exec-b0e44eba-b59b-4efb-9ba6-a56fe72aca54.png`, telemetry gap `exec-287bec66-c7b8-465f-b5f8-c0142248a4ef.png`, no finding `exec-cd7479aa-e5c9-4664-8507-c8e0e8feacd4.png`, and multiple findings `exec-85ad9e2a-8a0f-48dd-ac45-2c61b1790923.png`, all in the same generated-images directory.
- Browser-rendered implementation screenshot: not captured; the controlled browser refused access to the local analysis hash route under its URL safety policy.
- Requested CSS viewport: 390 × 844 at device pixel ratio 1.
- Source pixels: 853 × 1844. The planned normalized comparison size was 390 × 843 CSS pixels; implementation density could not be measured.
- State: four racing laps, Lap 1 reviewed against fastest Lap 2, normal comparison view with the coaching finding collapsed and then expanded through `View evidence`.

## Full-view and focused comparison evidence

The source images were opened and inspected before implementation. A same-state browser capture and combined comparison input could not be produced because browser access to the local `analysis/sha256:…` route was blocked. Consequently neither the full-view composition nor the focused `View evidence` sheet can be passed from visual evidence in this run.

## Required fidelity surfaces

- Fonts and typography: code reuses the existing RACEMAKE typography, tabular numeric treatment, uppercase labels, and current font stack; browser fidelity remains unverified.
- Spacing and layout rhythm: the compact breakpoint introduces a 58 px header, condensed lap summary, horizontally scrolling corner band, one-chart workspace, overview controls, and fixed bottom sheet; visual proportions remain unverified.
- Colors and visual tokens: existing near-black, lime, violet, amber, and coaching-priority tokens are reused; rendered contrast remains unverified.
- Image quality and assets: the existing RACEMAKE image asset and Phosphor icon library are retained. No replacement illustration, CSS drawing, or handcrafted SVG was introduced.
- Copy and content: the mobile components render existing query results and callbacks. The single-lap state says that coaching requires at least two laps and ends with `Add another lap.` Fragment, gap, no-finding, and multiple-finding copy is represented in dedicated compact states.

## Interaction and runtime checks

- Static TypeScript checks pass for the root and frontend projects.
- The production build passes; it retains the existing large-chunk warning.
- All 381 repository tests pass; the focused frontend suite passes 88 tests.
- Lint exits successfully with the repository's existing 70 warnings.
- `bun run analyze:data` succeeds with the production analysis pipeline.
- Browser interaction, responsive overflow, `View evidence`, chart tabs, and console errors could not be checked because the local route was unavailable to the controlled browser.

## Findings

- P0/P1/P2: not classifiable without a browser-rendered implementation capture.
- Blocker: required same-viewport visual comparison and interaction evidence are missing.

## Comparison history

- No visual comparison iteration was possible. Code-level fixes made before the attempted capture include fragment/lap navigation in the compact summary, reserved bottom scroll space for the sheet, compact ECharts insets, and a duration label on visible sampling gaps.

final result: blocked

---

# Single racing lap review — design QA

## Comparison target

- Source visual truth: `/Users/jirka/.codex/generated_images/01a006dc-7ade-72a1-9a1c-5ef7a5859d84/exec-0a10276c-0e5d-474b-89ce-08254ca0ce8a.png`
- Browser-rendered implementation: `/Users/jirka/WEB/racemake-hard/tmp/single-lap-ui/implementation-1536x1024-final.png`
- Combined comparison input: `/Users/jirka/WEB/racemake-hard/tmp/single-lap-ui/source-vs-implementation.png`
- Route: `http://127.0.0.1:5173/analysis/sha256:b7065fbe22bd4abad459af5d1cc1b9093a61257287b82a420148c52691f26e4f`
- State: one complete racing lap between a 60% opening fragment and a 42% closing fragment; the racing lap contains one measured 2.672 s telemetry gap.
- Source pixels, implementation pixels, and CSS viewport: 1536 × 1024 at device pixel ratio 1. No density normalization was required. The combined comparison scales both originals equally to 768 × 512.

## Full-view comparison evidence

The source and implementation were rendered together in one comparison input. Both keep one selected lap available for review while disabling the previous/next lap actions, comparison selector, and swap action. Both omit the time-delta chart, track-region controls, footer delta overview, and footer region navigation. The footer contains only the full-lap reset and zoom controls. The coaching rail uses the centered “More laps needed for coaching” state rather than attempting to show findings.

The implementation intentionally differs from the generated reference wherever the real data is authoritative: it reports the computed 1:13.789 lap time rather than the mock's illustrative 1:16.187, and leaves the unsupported 2.672 s interval blank in speed, pedals, and steering instead of drawing continuous invented lines.

## Focused region comparison evidence

A separate crop was not necessary because the 1536 × 1024 combined comparison keeps the lap picker, track-region message, chart labels, telemetry gap, coaching empty state, and complete footer legible. Browser DOM inspection additionally confirmed that the comparison combobox and swap/adjacent-lap buttons are disabled, and that no time-delta heading or footer overview exists in the single-lap state.

## Required fidelity surfaces

- Fonts and typography: the implementation reuses the established RACEMAKE type scale, weights, uppercase labels, and tabular lap time. The disabled comparison copy and centered coaching message remain readable without truncation.
- Spacing and layout rhythm: the three lap/fragment cards are centered in the available picker space; the long `TRACK REGIONS` label no longer overlaps its unavailable-state bar; the footer preserves intentional empty space after the zoom controls.
- Colors and visual tokens: existing near-black surfaces, neutral borders, disabled-control treatment, and lime reviewed-lap trace match the source and the existing product system.
- Image quality and assets: the existing RACEMAKE mark and Phosphor chart icon are retained. ECharts renders the telemetry at device density with `connectNulls: false`; no placeholder image or handcrafted icon was introduced.
- Copy and content: fragment coverage, lap time, gap location, and traces come from the analysis responses. The single-lap empty-state copy explains exactly which features need another lap.

## Interaction, request, and runtime checks

- The single-lap `/series` request contains only Lap 1; duplicate lap numbers are never constructed.
- `/time-loss`, `/track`, `/coaching`, and `/ideal-lap` query hooks remain disabled until `/laps` reports at least two racing laps. `/laps`, `/diagnostics`, and the one-lap `/series` request remain available for review.
- Zoom in changed the visible span to 85%; `Full lap` restored it to 100%.
- The normal four-lap route still renders time delta, all track regions, footer overview/selection, ideal lap, and coaching findings.
- Browser console warnings/errors: none.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, and `git diff --check` completed successfully. Tests: 362 passed, 0 failed. Lint exits successfully with 70 existing warnings; the production build retains the existing large-chunk warning.

## Findings

- P0: none.
- P1: none.
- P2: none in the requested single-lap state.
- P3: the generated concept uses wider lap cards than the existing component system. The implementation keeps the established card dimensions and centers the shorter row, preserving consistency with the multi-lap screen.

## Comparison history

- First implementation pass P2: the single-lap cards were left-aligned in a large empty row, the long track-region label touched the unavailable-state bar, and the disabled comparison value truncated.
- Fix: center the one-lap card sequence, reserve a wider unavailable-state label gutter, and widen the picker controls column enough to display `No comparison lap`.
- Post-fix evidence: `implementation-1536x1024-final.png` and `source-vs-implementation.png` show the centered card sequence, clean region row, complete disabled comparison label, blank telemetry gap, and simplified footer. No actionable P0/P1/P2 differences remain.

final result: passed

---

# Fragment legend alignment — design QA

## Comparison target

- Source visual truth: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/TemporaryItems/NSIRD_screencaptureui_f0Kz9J/Screenshot 2026-08-18 at 11.49.53 AM.png`
- Browser-rendered implementation: `/Users/jirka/WEB/racemake-hard/artifacts/fragment-legend-alignment/implementation-full.png`
- Focused implementation crop: `/Users/jirka/WEB/racemake-hard/artifacts/fragment-legend-alignment/implementation-focused.png`
- Combined comparison input: `/Users/jirka/WEB/racemake-hard/artifacts/fragment-legend-alignment/comparison-before-after.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State: Start fragment selected, three default fragment charts visible, channel selector closed.
- Source pixels: 628 × 256 at double density, normalized to 314 × 128. Implementation: 1280 × 720 CSS pixels at device scale factor 1; focused crop normalized to 311 × 128.

## Full-view and focused comparison evidence

- The legend line, fragment label, captured percentage, and `3 CHARTS` control now share one vertical center line.
- The selector remains inside the fixed legend area, does not overlap the horizontally scrolling lap cards, and does not change the picker height.
- A focused comparison was required because the requested correction concerns the alignment of a compact control group rather than the surrounding analysis layout.

## Required fidelity surfaces

- Fonts and typography: text size, weight, letter spacing, and tabular percentage formatting are unchanged.
- Spacing and layout rhythm: the channel selector moved from bottom alignment to center alignment; horizontal gaps and the 94 px container height are unchanged.
- Colors and visual tokens: lime series color, neutral percentage, borders, and dark surfaces are unchanged.
- Image quality and assets: no assets were added or replaced; the existing Phosphor icon remains sharp.
- Copy and content: `Start fragment`, `60.0%`, and `3 CHARTS` remain unchanged.

## Findings and comparison history

- P2 before fix: the legend content was vertically centered while the channel selector was bottom-aligned, making two related controls look unrelated and visually unbalanced.
- Fix: the selector wrapper now uses the same vertical center alignment as the fragment legend and no longer adds bottom padding.
- P2 after fix: none.
- P0/P1: none.
- P3: none.

## Verification

- The channel selector still opens and closes after the alignment change.
- Browser console errors: none.
- TypeScript checks pass.

final result: passed

---

# Sampling-gap chart and lap-card presentation — design QA

## Comparison target

- Source visual truth: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/codex-clipboard-b625ed8d-111e-4dea-b669-2d6b3fef5e5c.png`
- Browser-rendered implementation: `/tmp/racemake-sampling-gap-implementation-1536x1024.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State: Lap 1 reviewed against Lap 2, the 50.1–54.6% telemetry gap visible across all chart rows, and its coach-readable tooltip open.
- Source pixels, implementation pixels, and CSS viewport: 1536 × 1024 at device pixel ratio 1.

## Visual comparison evidence

- The significant gap is shown at its exact normalized track position as one subdued amber vertical band across the telemetry stack.
- Dashed amber boundaries distinguish missing telemetry from the violet selected-region band and the severity-colored coaching markers.
- Hover and keyboard focus expose the affected lap, exact track-position range, and measured unavailable duration.
- The corresponding Lap 1 card shows `Data gap`, measured 95.5% coverage, and a compact amber segment at the same position in the full-lap bar.
- The implementation intentionally omits decorative diagonal hatching. The existing application uses restrained solid semantic overlays, and the user requested the amber gap to remain the primary signal rather than a visually dominant texture.

## Interaction and runtime checks

- Selecting Lap 1 renders the gap; selecting laps that do not contain a qualifying gap does not render it.
- Only gaps covering at least the named four-percent threshold are promoted into the charts and lap card. Smaller gaps remain available through diagnostics.
- Zoom projection clips the gap to the visible horizontal viewport while preserving its exact source coordinates.
- Unsupported chart samples stay `null`; the overlay explains the existing blank range and does not synthesize or connect telemetry across it.
- Keyboard users can focus the gap band and receive the same explanation exposed on pointer hover.
- Browser console warnings/errors: none in the final fresh analysis tab.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, and `git diff --check` completed successfully. Tests: 378 passed, 0 failed. Lint exits successfully with 70 existing warnings.

## Findings

- P0: none.
- P1: none.
- P2: none in the requested sampling-gap slice.
- P3: the compact production lap card uses `95.5%` instead of the longer `95.5% covered`; its accessible label explicitly says `telemetry coverage 95.5 percent`.

final result: passed

---

# Fragment layout parity — design QA

## Comparison target

- Source regular-lap state: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/TemporaryItems/NSIRD_screencaptureui_6LUYPb/Screenshot 2026-08-18 at 11.30.29 AM.png`
- Source oversized fragment state: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/TemporaryItems/NSIRD_screencaptureui_lZYiji/Screenshot 2026-08-18 at 11.30.20 AM.png`
- Corrected regular-lap implementation: `/Users/jirka/WEB/racemake-hard/artifacts/layout-regular-compact.png`
- Corrected fragment implementation: `/Users/jirka/WEB/racemake-hard/artifacts/layout-fragment-compact.png`
- Combined comparison input: `/Users/jirka/WEB/racemake-hard/artifacts/layout-regular-vs-fragment-comparison.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State: regular racing-lap review compared with the same screen after selecting the 40%–100% opening fragment.
- Source captures are 2776 × 1338 pixels at approximately 2× density and were normalized to the 1388 × 669 CSS viewport. Implementation captures are 1388 × 669 pixels at device pixel ratio 1.

## Full-view comparison evidence

The two source states and the two corrected implementation states were placed in one normalized comparison input. The source fragment regression visibly increased the header, picker, cards, notice, region row, footer, and details rail, pushing most of the chart below the fold. In the corrected implementation the regular-lap and fragment states now share the same 58 px header, 124 px picker, 44 px region row, 72 px footer, and 282 px default right rail. Consequently the chart frame begins and ends at the same vertical coordinates in both corrected captures.

Only state-specific content changes: fragment colors and title, recorded-input charts, missing-telemetry overlay, unavailable regions, fragment details, and the `Full fragment` label. Selecting a fragment no longer changes the surrounding layout scale.

## Focused comparison evidence

A focused crop was unnecessary because the reported regression concerns full-screen proportions, and the normalized full-view comparison keeps every affected major region visible. Browser interaction checks additionally confirmed that selecting Lap 1 restores the normal state and selecting Start fragment restores fragment content without reintroducing a separate notice row or enlarged chrome.

## Required fidelity surfaces

- Fonts and typography: fragment mode now uses the same logo, product title, lap count, header control, card, and right-rail type scale as regular mode. Amber remains a semantic state color rather than a reason to increase font size.
- Spacing and layout rhythm: the conditional fragment-only grid tracks and expanded-card dimensions were removed. Both states use the existing application spacing and resizable right-rail width.
- Colors and visual tokens: regular lime/violet comparison colors and fragment amber treatment remain unchanged; the correction affects dimensions only.
- Image quality and assets: the RACEMAKE mark, Phosphor icons, and ECharts canvas rendering are unchanged and remain sharp at the verified density.
- Copy and content: fragment coverage and limitations remain available on the selected card and in Fragment Details. The redundant full-width notice was removed because it displaced the primary chart without adding unique information.

## Interaction and runtime checks

- Verified regular lap → Start fragment → Lap 1 → Start fragment.
- Header navigation, cards, chart, region strip, footer controls, and details rail remain functional.
- Browser console warnings/errors: none.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, and `git diff --check` completed successfully. Tests: 378 passed, 0 failed. Lint exits successfully with 70 existing warnings; the production build retains the existing large-chunk warning.

## Findings and comparison history

- P0: none.
- P1 before fix: fragment mode used an 82 px header, 182 px picker, 158 px cards, an additional 52 px notice row, a 126 px footer, and a 340 px right rail. This materially reduced and displaced the primary telemetry chart.
- Fix: remove every fragment-specific size branch, return cards and rails to the regular-lap dimensions, and keep fragment context in the picker and details rail instead of a separate layout row.
- Post-fix evidence: `layout-regular-vs-fragment-comparison.png` shows identical major-region proportions and chart coordinates between the two corrected states.
- P1 after fix: none.
- P2: none.
- P3: none for the requested layout-parity correction.

final result: passed

---

# Lap-fragment inspection — design QA

## Comparison target

- Selected visual target: `/Users/jirka/.codex/generated_images/01a006dc-7ade-72a1-9a1c-5ef7a5859d84/exec-efd2fd94-3e8a-4750-a9b4-904c4f8ac4e6.png`
- Browser-rendered implementation: `/Users/jirka/WEB/racemake-hard/artifacts/fragment-review-implementation-final.png`
- Combined comparison input: `/Users/jirka/WEB/racemake-hard/artifacts/fragment-review-comparison-final.png`
- Route: `http://localhost:5173/analysis/sha256:0e473801bfd15a849bb247521283c93483a4eef538ed43da5653d7e2089c288f`
- State: the opening fragment is selected in a stint containing one complete racing lap, an opening fragment captured from 40% to the finish, and a closing fragment captured from the start to 42%.
- Source pixels, implementation pixels, and CSS viewport: 1802 × 873 at device pixel ratio 1. Both full views were placed unscaled beside each other in the 3620 × 873 comparison input.

## Full-view comparison evidence

The approved source and browser result were judged together at the same viewport. The implementation preserves the target hierarchy: amber fragment state in the header and selected card, expanded data picker, partial-telemetry notice, region availability, three recorded-input charts, explicit unrecorded area and recording boundary, simplified fragment footer, and a dedicated details rail instead of coaching output.

The real telemetry remains authoritative where it differs from the generated concept. Lap 1 reports its measured 2.672 s data gap, C3 remains unavailable because the opening fragment begins at 40%, and the plotted lines reflect the checked-in single-lap fixture rather than the illustrative traces in the mock.

## Focused comparison evidence

A separate crop was unnecessary because the 1802 × 873 comparison keeps the card labels, fragment notice, region strip, chart boundary, missing-data label, footer, and details rail legible. Browser DOM inspection additionally confirmed the exact fragment range, `NOT RECORDED`, `RECORDING START`, the three facts in the details rail, and the absence of comparison and coaching controls in fragment mode.

## Required fidelity surfaces

- Typography and spacing: the fragment state uses the requested expanded 158 px cards, taller header, stronger card hierarchy, wider details rail, and the existing RACEMAKE font and square control language.
- Colors and tokens: amber identifies partial telemetry and boundaries; lime remains reserved for measured telemetry and complete racing-lap data; neutral disabled regions communicate unavailable track sections.
- Image and icon fidelity: the existing RACEMAKE mark and Phosphor icons are retained. Telemetry remains an ECharts canvas backed by real samples; no invented asset or substitute trace was introduced.
- Copy and content: fragment coverage, start/end positions, available regions, and plotted samples come from analysis responses. The UI explicitly states that fragments are not used for comparison or coaching.

## Interaction, request, and runtime checks

- Selecting Start fragment requests only `/fragment-series` for that fragment and the three visible input channels. The regular lap-series query is disabled while fragment mode is active; comparison, time-loss, coaching, and ideal-lap queries remain unavailable for the one-lap fixture.
- The header next action returns from Start fragment to Lap 1. End fragment opens the mirrored state with `RECORDING END`; selecting Lap 1 restores the normal one-lap workspace; returning to Start fragment restores fragment mode.
- Unrecorded grid cells stay `null`; no interpolation or extrapolation is performed across the fragment boundary.
- Browser console warnings/errors: none.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, and `git diff --check` completed successfully. Tests: 378 passed, 0 failed. Lint exits successfully with 70 existing warnings; the production build retains the existing large-chunk warning.

## Findings and comparison history

- P0: none.
- P1: none.
- P2 before final pass: the first browser implementation used the normal 282 px coaching-rail width and a smaller fragment typography scale, making the details rail and picker visibly lighter than the selected target.
- Fix: fragment mode received its own 340 px resizable rail width and the fragment header, picker cards, notice, and fact rows were raised to the target hierarchy.
- P2 after fix: none.
- P3: the generated source uses decorative diagonal hatching in the unrecorded area. The implementation uses the product's existing dark missing-data treatment plus an explicit label and boundary, avoiding a new decorative asset while preserving the same meaning.

final result: passed

---

# Lap fragments in the lap picker — design QA

## Comparison target

- Source visual truth: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/codex-clipboard-2f2f468c-3e13-4150-8653-1ce5d5e5f097.png`
- Browser-rendered implementation: `/Users/jirka/WEB/racemake-hard/artifacts/lap-fragments-implementation-v2.png`
- Additional missing-telemetry state: `/Users/jirka/WEB/racemake-hard/artifacts/lap-1-missing-telemetry.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State: Lap 3 reviewed against Lap 2; opening fragment, four complete racing laps, and closing fragment visible in track order.
- Source pixels, implementation pixels, and CSS viewport: 1536 × 1024 at device pixel ratio 1. No density normalization was required.

## Full-view comparison evidence

The source and implementation were opened together in one comparison input at the same pixel dimensions. Within the requested lap-fragment slice, both show Lap 0 before the complete laps and Lap 5 after them. Each fragment has no lap time, names its boundary role, reports the captured percentage, and uses a compact position bar to distinguish measured and unmeasured track coverage. The surrounding application retains its existing header, comparison controls, ideal-lap legend, data-quality notice, chart layout, and coaching rail; those intentionally differ from the broader concept screenshot and were not redesigned in this slice.

## Focused region comparison evidence

A separate crop was not needed because both 1536-pixel originals keep the complete lap-picker row and its small labels legible. Browser DOM inspection additionally confirmed the exact fragment descriptions (`60.0% captured from 40.0% to 100.0%` and `42.0% captured from 0.0% to 42.0%`) and confirmed that both fragments are non-interactive articles rather than lap-selection buttons.

## Required fidelity surfaces

- Fonts and typography: fragment titles, em dash, role label, and percentage reuse the existing compact lap-card hierarchy without wrapping or truncation.
- Spacing and layout rhythm: the picker row grows to 124 px, the cards to 94 px, and all six requested lap positions remain visible at the 1536 px reference viewport.
- Colors and visual tokens: measured coverage uses the established lime token; unmeasured coverage uses the neutral dark track and fragment cards remain visually distinct from selected and reference laps.
- Image quality and assets: the fragment cards contain no source image assets. The position bar is rendered at device density and the existing RACEMAKE mark and icon library remain unchanged.
- Copy and content: lap numbers and percentages are calculated from `/laps.fragments`; no fragment time, coverage, or ordering is hard-coded from the supplied stint.

## Interaction and runtime checks

- Lap 0 and Lap 5 are not clickable and cannot enter the compared/reference lap selection.
- Selecting Lap 1 still works as a racing-lap comparison.
- Lap 1's unsupported telemetry samples remain `null`; ECharts keeps `connectNulls: false`, so the unsupported part of each line is blank with no invented overlay or replacement data.
- A fresh analysis tab produced no console errors or warnings.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, and `git diff --check` completed successfully. Tests: 356 passed, 0 failed. Lint exits successfully with 70 existing warnings; the production build retains the existing large-chunk warning.

## Findings

- P0: none.
- P1: none.
- P2: none within the requested lap-fragment slice.
- P3: the concept uses hatching for unmeasured coverage while the implementation uses the application's neutral track. The measured extent and percentage remain unambiguous without adding a new decorative pattern.

## Comparison history

- First pass P2: the wider cards and the existing ideal-lap card pushed the closing Lap 5 fragment outside the initial viewport.
- Fix: fragment and complete-lap cards were returned to the established 108 px width, and the optional ideal-lap summary follows the ordered lap/fragment sequence; the always-visible legend still reports the ideal lap.
- Post-fix evidence: `lap-fragments-implementation-v2.png` shows Lap 0, Laps 1–4, and Lap 5 together in the initial 1536 px viewport, matching the source sequence. No actionable P0/P1/P2 differences remain.

final result: passed

---

# Data quality UI design QA

- Source visual truth: `/Users/jirka/.codex/generated_images/019fe64a-5e9d-70e3-a89f-c63b99d9b153/exec-ba933ad7-bc20-4c7f-820c-59826396ce9b.png`
- Browser-rendered implementation: `/Users/jirka/WEB/racemake-hard/artifacts/qa/data-quality-limited-final.png`
- Route: `http://localhost:5173/analysis/sha256:5613f60a427bf24965d98244ac92427bd1ed128c05fb45970145a4acea03944a`
- State: generated limited-analysis fixture ingested; limitation banner visible; shared Data quality popover open; technical details collapsed.
- Requested CSS viewport: 1488 × 1057 at device pixel ratio 1.
- Source pixels: 1486 × 1059.
- Implementation capture pixels: 1488 × 1028. The in-app capture surface omitted 29 vertical pixels while preserving the requested 1488-pixel width and 1× density; comparison used the shared above-the-fold content region.

## Full-view comparison evidence

The source and implementation were opened together in one comparison input. The implementation preserves the target hierarchy: compact dark header, amber limitation banner directly below it, disabled excluded-lap cards, uninterrupted analysis workspace, and an anchored dark Data quality panel. The banner action and panel status use the same amber semantic token. The panel repeats the coach-readable explanation, separates excluded laps from still-available features, and keeps technical telemetry details collapsed.

Expected content differences are data-derived rather than visual drift. The reference mock shows one excluded lap and three usable laps; the deliberately damaged fixture shows two excluded laps and two usable laps. The application also keeps the already-agreed real header fields instead of the mock's unsupported circuit/date metadata.

## Focused region comparison

A separate crop was not required: at 1488 pixels both the complete banner and the 340-pixel Data quality panel are legible in the full-view source and implementation captures. Their typography, spacing, borders, status color, action hierarchy, and content grouping can be judged directly.

## Required fidelity surfaces

- Fonts and typography: existing RACEMAKE application typography is preserved; banner title, supporting copy, section labels, measured values, and action text follow the source hierarchy without overflow.
- Spacing and layout rhythm: banner is a compact fixed-height strip; the analysis workspace shrinks rather than overflows; panel sections use consistent 16–20 pixel padding and separators.
- Colors and visual tokens: existing near-black surfaces, neutral borders, lime capability checks, and amber limitation state match the established application palette and source intent.
- Image and icon fidelity: the existing RACEMAKE mark is retained; Phosphor icons are used for information, checks, warnings, and dismissal. No placeholder or handcrafted graphic replaces a visible asset.
- Copy and content: every limitation value comes from `AnalysisUsability` evidence. No lap number, missing duration, uncovered percentage, capability, or remaining-lap count is invented in the UI.

## Interaction verification

- `View data details` opens the same controlled popover as the header `Data quality` button.
- The header button closes and reopens the panel.
- `Technical details` expands and exposes the telemetry diagnostics.
- Dismissing the banner also closes the panel; reloading the analysis restores the per-analysis notice.
- Excluded lap cards are visible but disabled and are not offered as chart comparison choices.
- Browser console checked: no error or warning messages; only Vite connection and React DevTools informational entries.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, and `git diff --check` completed successfully. Tests: 348 passed, 0 failed. Lint exits successfully with 70 existing-style/large-fixture warnings; the production build retains the existing large-chunk warning.

## Findings

No actionable P0, P1, or P2 differences remain for the data-quality feature. The transient panel overlays part of the coaching rail rather than ending immediately before it as in the mock; this is acceptable P3 behavior because the rail is resizable and the panel must remain anchored to one shared header/banner control.

## Comparison history

- Final pass: no P0/P1/P2 findings. No post-comparison visual fix was required.

## Final result

final result: passed

---

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

---

# Selected telemetry series — design QA

## Comparison target

- Selected visual target: `/Users/jirka/.codex/generated_images/01a0167f-54e8-7f72-8b07-e0cd600da25c/exec-2b73bc7b-224c-420e-9f02-87b59b911314.png`
- Verified implementation: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-series-selection-desktop.png`
- Full-view comparison: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-series-selection-qa-comparison.png`
- Focused comparison: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-series-selection-qa-focused.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State: Lap 3 reviewed against Lap 2, C2 selected, 22.5–77.5% viewport, Lap 3 Speed selected at 47.9%.
- Source pixels: 1586 × 992. Implementation screenshot and CSS viewport: 1600 × 1000 at device scale factor 1. Both were normalized to 1586 × 992 for comparison.

## Full-view and focused comparison evidence

- Clicking a telemetry line brings that series to the foreground with a thicker lime stroke, restrained glow, a selected sample point, and a linked vertical guide across every visible chart.
- The detail panel follows the target hierarchy and reports the selected lap and channel, track position, sampled value, comparison-lap value, delta, and telemetry completeness.
- `Range in view` is intentionally omitted at the user's request.
- Existing lap picker, region strip, footer overview, coaching rail, telemetry colors, and chart geometry remain unchanged.
- Non-selected lines stay readable: same-channel alternatives recede more strongly than context lines in other charts.

## Interaction and responsive verification

- Verified line click, reviewed-line priority where lines overlap, same-line click to clear, close-button clear, and Escape clear.
- Verified the selection and guide remain fixed to their telemetry position while zooming and panning.
- Verified at 1600 × 1000, 800 × 900, and 390 × 844; the compact panel stays inside the viewport and drops only the nonessential dismissal hint.
- A selected point inside a missing-data interval is reported as partial and comparison values are never borrowed across a null gap.
- Fresh browser console warnings and errors after the final reload: none.

## Findings and comparison history

- P0: none.
- P1 before fix: ECharts emitted a deprecation warning for `triggerLineEvent`.
- Fix: line clicks now use `triggerEvent: "line"`; the fresh console log is empty.
- P2 before fix: an ideal-lap line could capture a click where it overlapped the reviewed lap.
- Fix: reviewed, comparison, and ideal series now have explicit base z-ordering, with the reviewed lap on top.
- P2 before fix: the first visual pass made contextual series either too prominent or too faint.
- Fix: same-channel siblings use 0.18 opacity while lines in other charts retain up to 0.35 opacity, and the selected glow was reduced.
- P2 after fixes: none.
- P3: the live sampled delta is −0.2 km/h rather than the mock's illustrative −0.1 km/h; the implementation correctly uses production telemetry.

## Verification

- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, scoped Biome formatting, and `git diff --check` completed successfully.
- Test result: 410 passed, 0 failed. Lint retains 67 pre-existing warnings and exits successfully. The production build retains the existing large-chunk warning.

final result: passed

---

# Telemetry tooltip collision avoidance — design QA

## Comparison target

- Source visual truth: `/var/folders/nl/r07j_tss4hs495mltd3xxrdc0000gn/T/TemporaryItems/NSIRD_screencaptureui_lhfYgV/Screenshot 2026-08-19 at 10.18.46 AM.png`
- Verified implementation: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-tooltip-collision-fixed-1212.png`
- Full-view comparison: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-tooltip-collision-qa-comparison.png`
- Focused comparison: `/Users/jirka/WEB/racemake-hard/artifacts/telemetry-tooltip-collision-qa-focused.png`
- Route: `http://localhost:5173/analysis/sha256:79d048e79816fb2c0d4dc10d5b1b6efc63a1e6e3fa38aabc0bc78c5f3e352f81`
- State: Lap 1 reviewed against Lap 2, Speed chart selected, full lap visible, Missing telemetry details open for 50.1–54.6%, telemetry value tooltip visible nearby.
- Source pixels: 2424 × 1368 at Retina density, normalized to 1212 × 684 CSS pixels. Implementation viewport and screenshot: 1212 × 684 at device scale factor 1.

## Full-view and focused comparison evidence

- The source shows the value tooltip drawn directly over the lower half of the Missing telemetry explanation, hiding track-position, duration, and comparison-lap copy.
- The revised implementation measures the visible Missing telemetry panel and places the value tooltip in the nearest free quadrant around the pointer with a 10 px exclusion gap.
- The focused before/after comparison shows both complete panels at once with no shared pixels.
- Typography, telemetry colors, chart geometry, gap styling, markers, and tooltip copy remain unchanged.

## Interaction and responsive verification

- Verified both tooltips simultaneously at 1212 × 684, 800 × 900, and 390 × 844.
- On the medium layout the value tooltip moves below the Missing telemetry panel; on mobile it remains confined to the chart and preserves a visible gap.
- Positioning checks cover the normal lower-right placement, opposite-side avoidance, above-obstacle fallback, and compact viewport edge clamping.
- Both mouse hover and keyboard focus continue to expose the Missing telemetry details, while the chart value tooltip remains available in and around the amber interval.
- No visible runtime error or browser error overlay appeared during responsive interaction testing.

## Required fidelity surfaces

- Fonts and typography: unchanged; both panels retain their existing sizes, weights, line heights, and wrapping.
- Spacing and layout rhythm: only dynamic tooltip placement changes; an explicit 10 px obstacle gap prevents visual merging.
- Colors and visual tokens: unchanged amber, neutral, violet, border, and surface tokens.
- Image quality and assets: ECharts canvas rendering and existing Phosphor icon remain unchanged; no new visual assets were introduced.
- Copy and content: all Missing telemetry and sampled-value content remains visible and unchanged.

## Findings and comparison history

- P0: none.
- P1 before fix: the chart value tooltip overlapped the Missing telemetry tooltip and made its central explanatory content unreadable.
- Fix: visible explanatory overlays are now registered as collision obstacles, and the ECharts tooltip evaluates four bounded placements before every display update.
- Post-fix evidence: desktop, medium, and mobile captures show complete non-overlapping panels; four focused positioning tests cover the fallback rules.
- P1 after fix: none.
- P2: none.
- P3: none.

## Verification

- `bun run typecheck`, `bun run lint`, `bun test`, `bun run analyze:data`, `bun run build`, scoped Biome formatting, and `git diff --check` completed successfully.
- Test result: 414 passed, 0 failed. Lint retains 67 pre-existing warnings and exits successfully. The production build retains the existing large-chunk warning.

final result: passed
