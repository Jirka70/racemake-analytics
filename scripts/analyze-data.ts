import { mkdir, rename, rm } from 'node:fs/promises'
import { DEFAULT_FRAME_AUDIT_CONFIG } from '../src/config/frame-audit-config'
import { createInMemoryAnalysisStore } from '../src/http/analysis-store'
import { getCoaching } from '../src/http/get-coaching'
import { getDiagnostics } from '../src/http/get-diagnostics'
import { getLaps } from '../src/http/get-laps'
import { getTimeLoss } from '../src/http/get-time-loss'
import { getTrack } from '../src/http/get-track'
import { ingestTelemetryAnalysis } from '../src/http/ingest-telemetry-analysis'

const stintPath = `${import.meta.dir}/../data/stint.telemetry.json`
const artifactsDirectory = `${import.meta.dir}/../artifacts`
const sampleOutputPath = `${artifactsDirectory}/sample-output.json`
const diagnosticsOutputPath = `${artifactsDirectory}/diagnostics.json`
const input: unknown = await Bun.file(stintPath).json()
const analysisStore = createInMemoryAnalysisStore({
  maximumEntryCount: 1,
})
const ingest = ingestTelemetryAnalysis(input, {
  analysisStore,
  frameAuditConfig: DEFAULT_FRAME_AUDIT_CONFIG,
})
const query = { analysisId: ingest.analysisId }
const laps = getLaps(query, analysisStore)
const track = getTrack(query, analysisStore)
const timeLoss = getTimeLoss(query, analysisStore)
const coaching = getCoaching(query, analysisStore)
const diagnostics = getDiagnostics(query, analysisStore)

const sampleOutput = {
  formatVersion: 1,
  source: 'data/stint.telemetry.json',
  ingest,
  laps,
  track,
  timeLoss,
  coaching,
} as const

assertArtifactInvariants(sampleOutput, diagnostics)
await mkdir(artifactsDirectory, { recursive: true })
await Promise.all([
  writeJsonAtomically(sampleOutputPath, sampleOutput),
  writeJsonAtomically(diagnosticsOutputPath, diagnostics),
])

const racingLaps = laps.laps.filter((lap) => lap.eligibility === 'racing')
console.log([
  `Analysis: ${ingest.analysisId}`,
  `Frames: ${ingest.receivedFrameCount} received, ${ingest.retainedTimelineFrameCount} retained, ${ingest.excludedTimelineFrameCount} excluded`,
  `Racing laps: ${racingLaps.length}; track regions: ${track.regions.length}; coaching findings: ${coaching.rankedPhenomena.length}`,
  `Audit issues: ${diagnostics.frameAudit.issues.length}; detector failures: ${coaching.detectorFailures.length}`,
  `Wrote ${sampleOutputPath}`,
  `Wrote ${diagnosticsOutputPath}`,
].join('\n'))

interface AnalysisContext {
  readonly analysisId: string
  readonly sessionId: string
}

function assertArtifactInvariants(
  sample: typeof sampleOutput,
  diagnosticOutput: typeof diagnostics,
): void {
  if (sample.ingest.cacheHit) {
    throw new Error('The first production analysis run must be a cache miss')
  }

  if (
    sample.ingest.retainedTimelineFrameCount
      + sample.ingest.excludedTimelineFrameCount
    !== sample.ingest.receivedFrameCount
  ) {
    throw new Error('Retained and excluded frame counts must cover the input')
  }

  const contexts: readonly AnalysisContext[] = [
    sample.laps,
    sample.track,
    sample.timeLoss,
    sample.coaching,
    diagnosticOutput,
  ]
  if (
    contexts.some(
      (context) =>
        context.analysisId !== sample.ingest.analysisId
        || context.sessionId !== sample.ingest.sessionId,
    )
  ) {
    throw new Error('Every generated response must describe one analysis')
  }

  const racingLaps = sample.laps.laps.filter(
    (lap) => lap.eligibility === 'racing',
  )
  if (racingLaps.length === 0 || racingLaps.some((lap) => lap.lapTimeMs <= 0)) {
    throw new Error('Sample output must contain positive real-racing lap times')
  }
  if (sample.track.regions.length === 0) {
    throw new Error('Sample output must contain a derived track model')
  }
  if (sample.timeLoss.fastestLap === null) {
    throw new Error('Sample output must identify the fastest real-racing lap')
  }
  if (sample.coaching.detectorFailures.length > 0) {
    throw new Error('Sample output must not contain coaching detector failures')
  }

  const issueIds = diagnosticOutput.frameAudit.issues.map(({ id }) => id)
  if (new Set(issueIds).size !== issueIds.length) {
    throw new Error('Diagnostic issue IDs must be unique')
  }
}

async function writeJsonAtomically(
  targetPath: string,
  value: unknown,
): Promise<void> {
  const temporaryPath = `${targetPath}.${process.pid}.tmp`
  try {
    await Bun.write(temporaryPath, `${JSON.stringify(value, null, 2)}\n`)
    await rename(temporaryPath, targetPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}
