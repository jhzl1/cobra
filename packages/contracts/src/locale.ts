import { z } from 'zod'

/**
 * Zod answers in Spanish, everywhere.
 *
 * This is the net, not the copy. Every module in this package imports it, not
 * just the index, because importing one of them directly would otherwise build
 * its schemas before the locale was ever set — which is how the test that
 * guards this caught it in the first place.
 *
 * Both sides get the same wording: the API validates with these same schemas and
 * the panel shows what it sends back.
 *
 * The messages it produces read like a compiler ("Demasiado pequeño: se
 * esperaba que texto tuviera >=2 caracteres"), which is why every constraint the
 * operator can actually trip carries its own message. Seeing one of these on
 * screen means a field was left without one.
 */
z.config(z.locales.es())
