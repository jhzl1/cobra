import type { AnyFieldApi, AnyFormApi } from '@tanstack/react-form'
import { fieldErrorsOf } from '~/lib/api'

/**
 * What to show under a field, or nothing.
 *
 * Errors only surface once the field has been touched: validating on change
 * from the first keystroke would paint "requerido" in red before anyone has
 * typed anything.
 */
export const fieldError = (field: AnyFieldApi): string | undefined => {
  if (!field.state.meta.isTouched) return undefined

  const [issue] = field.state.meta.errors

  if (!issue) return undefined

  return typeof issue === 'string' ? issue : (issue as { message?: string }).message
}

/**
 * Puts the API's per-field errors back on the fields that caused them.
 *
 * Covers what the client cannot know on its own: a slug already taken, an
 * address already granted, a number already registered. Anything the API
 * complains about that has no field on screen is returned, for the form to show
 * as a single message.
 */
export const applyServerErrors = (form: AnyFormApi, error: unknown): string[] => {
  const unmatched: string[] = []

  for (const { field, message } of fieldErrorsOf(error)) {
    if (field && field in form.state.values) {
      form.setFieldMeta(field, (meta) => ({
        ...meta,
        isTouched: true,
        errorMap: { onServer: message },
      }))
    } else {
      unmatched.push(message)
    }
  }

  return unmatched
}
