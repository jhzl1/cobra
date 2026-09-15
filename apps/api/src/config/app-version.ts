import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The build this process is running.
 *
 * The deploy stamps APP_VERSION into the image; the manifest is the fallback for
 * running locally. Deliberately not part of `env.ts` — that file holds what has
 * to stop the boot when it is missing, and a version always resolves to
 * something.
 */
export const getAppVersion = (): string => {
  const stamped = process.env.APP_VERSION

  if (stamped) return stamped

  try {
    const manifest = readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')
    const { version } = JSON.parse(manifest) as { version?: string }

    return version ?? 'dev'
  } catch {
    return 'dev'
  }
}
