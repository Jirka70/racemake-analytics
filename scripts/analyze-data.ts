import { DEFAULT_FRAME_AUDIT_CONFIG } from '../src/config/frame-audit-config'
import { createInMemoryAnalysisStore } from '../src/http/analysis-store'
import { getCoaching } from '../src/http/get-coaching'
import { getDiagnostics } from '../src/http/get-diagnostics'
import { getLaps } from '../src/http/get-laps'
import { getTrack } from '../src/http/get-track'
import { ingestTelemetryAnalysis } from '../src/http/ingest-telemetry-analysis'

const stintPath = `${import.meta.dir}/../data/stint.telemetry.json`
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
const coaching = getCoaching(query, analysisStore)
const diagnostics = getDiagnostics(query, analysisStore)

console.log(JSON.stringify({
  analysisId: ingest.analysisId,
  sessionId: ingest.sessionId,
  receivedFrameCount: ingest.receivedFrameCount,
  retainedTimelineFrameCount: ingest.retainedTimelineFrameCount,
  excludedTimelineFrameCount: ingest.excludedTimelineFrameCount,
  laps: laps.laps.map((lap) => ({
    lapNumber: lap.lapNumber,
    lapTimeMs: lap.lapTimeMs,
    eligibility: lap.eligibility,
  })),
  trackRegionCount: track.regions.length,
  rankedPhenomena: coaching.rankedPhenomena,
  detectorFailures: coaching.detectorFailures,
  diagnosticIssueCount: diagnostics.frameAudit.issues.length,
}, null, 2))
