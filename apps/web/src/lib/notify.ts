const STORAGE_KEY = 'cobra.sound'

/**
 * A short blip, synthesised rather than fetched.
 *
 * A file would be one more asset to serve and to cache-bust, and this is two
 * sine tones. The context is created on demand because a browser refuses one
 * built before the page has been interacted with.
 */
export const playBlip = () => {
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!Ctor) return

  const context = new Ctor()
  const gain = context.createGain()

  gain.connect(context.destination)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35)

  for (const [frequency, at] of [
    [880, 0],
    [1174, 0.09],
  ] as const) {
    const oscillator = context.createOscillator()

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    oscillator.start(context.currentTime + at)
    oscillator.stop(context.currentTime + at + 0.12)
  }

  setTimeout(() => void context.close(), 600)
}

export const soundEnabled = (): boolean => localStorage.getItem(STORAGE_KEY) !== 'off'

export const setSoundEnabled = (on: boolean): void => {
  localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
}

/** Asked once, and only from a click — a prompt on load is the one people deny. */
export const askForNotifications = async (): Promise<void> => {
  if (!('Notification' in window) || Notification.permission !== 'default') return

  await Notification.requestPermission()
}

/**
 * The interruption, in two tiers, because "not looking at it" has two meanings.
 *
 * The sound fires whenever the message is not in the conversation on screen —
 * being on Configuración with the panel in front is exactly the case this was
 * built for, and keying it to tab visibility meant it never played there.
 *
 * The desktop notification stays for the hidden tab only. With the panel in
 * front it would say what is already on it.
 */
export const announce = (title: string, body: string): void => {
  if (soundEnabled()) {
    try {
      playBlip()
    } catch {
      // Autoplay policies, before any click has happened on the page.
    }
  }

  if (document.visibilityState === 'visible') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  try {
    // `tag` collapses a burst from the same person into one notification instead
    // of stacking four.
    new Notification(title, { body, tag: title })
  } catch {
    // Some browsers only allow this from a service worker. Nothing else breaks.
  }
}
