import { BadRequestException, type PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'

/**
 * Validates a payload against a schema from @cobra/contracts, so the API and the
 * panel enforce one definition instead of a DTO class that drifts out of sync.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))

      throw new BadRequestException({ message: 'Los datos enviados no son válidos', details })
    }

    return result.data
  }
}
