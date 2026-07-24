import type { ZodType } from 'zod'

export function zValidate<Output>(
  schema: ZodType<Output>,
  input: unknown,
): Output {
  return schema.parse(input)
}
