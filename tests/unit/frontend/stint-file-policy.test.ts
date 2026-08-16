import { describe, expect, test } from 'bun:test'
import { MAX_TELEMETRY_INGEST_SIZE_BYTES } from '../../../src/config/telemetry-ingest-config'
import {
  type StintFileCandidate,
  validateStintFileSelection,
} from '../../../frontend/src/upload/stint-file-policy'

const DEFAULT_FILE: StintFileCandidate = {
  name: 'stint.telemetry.json',
  size: 2_769_956,
  type: 'application/json',
}

describe('stint file selection validation', () => {
  test('accepts one supported JSON file and preserves the original value', () => {
    const result = validateStintFileSelection([DEFAULT_FILE])

    expect(result).toEqual({
      status: 'valid',
      file: DEFAULT_FILE,
    })
  })

  test('accepts an uppercase JSON extension and normalizes MIME casing and parameters', () => {
    const result = validateStintFileSelection([
      createFile({
        name: 'STINT.JSON',
        type: 'Application/JSON; Charset=UTF-8',
      }),
    ])

    expect(result.status).toBe('valid')
  })

  test('accepts an empty MIME type when the file has a JSON extension', () => {
    const result = validateStintFileSelection([
      createFile({ type: '' }),
    ])

    expect(result.status).toBe('valid')
  })

  test('rejects a file without a JSON extension', () => {
    expectInvalid(
      [createFile({ name: 'stint.txt' })],
      'Choose a JSON file.',
    )
  })

  test('rejects an explicitly unsupported MIME type', () => {
    expectInvalid(
      [createFile({ type: 'image/png' })],
      'Choose a supported JSON file.',
    )
  })

  test('rejects an empty file', () => {
    expectInvalid(
      [createFile({ size: 0 })],
      'The selected file is empty.',
    )
  })

  test('accepts a file exactly at the 100 MB limit', () => {
    const result = validateStintFileSelection([
      createFile({ size: MAX_TELEMETRY_INGEST_SIZE_BYTES }),
    ])

    expect(result.status).toBe('valid')
  })

  test('rejects a file above the 100 MB limit', () => {
    expectInvalid(
      [
        createFile({
          size: MAX_TELEMETRY_INGEST_SIZE_BYTES + 1,
        }),
      ],
      'The selected file is larger than 100 MB.',
    )
  })

  test('requires exactly one selected file', () => {
    expectInvalid([], 'Choose one stint file at a time.')
    expectInvalid(
      [DEFAULT_FILE, createFile({ name: 'second.json' })],
      'Choose one stint file at a time.',
    )
  })
})

function createFile(
  overrides: Partial<StintFileCandidate>,
): StintFileCandidate {
  return {
    ...DEFAULT_FILE,
    ...overrides,
  }
}

function expectInvalid(
  files: readonly StintFileCandidate[],
  expectedMessage: string,
): void {
  const result = validateStintFileSelection(files)

  expect(result.status).toBe('invalid')
  if (result.status === 'valid') {
    throw new TypeError('Expected the stint file selection to be invalid.')
  }

  expect(result.issues.map((issue) => issue.message)).toContain(
    expectedMessage,
  )
}
