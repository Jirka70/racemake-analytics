import {
  API_ERRORS,
  type ApiErrorCode,
  type ApiValidationIssue,
} from './api-errors'

export class ApiRequestError extends Error {
  readonly code: ApiErrorCode
  readonly issues?: readonly ApiValidationIssue[]

  constructor(
    code: ApiErrorCode,
    issues?: readonly ApiValidationIssue[],
  ) {
    super(API_ERRORS[code].message)
    this.name = 'ApiRequestError'
    this.code = code
    this.issues = issues
  }
}
