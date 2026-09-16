const STORAGE_KEY = 'cobra.sound'

/**
 * A short blip, synthesised rather than fetched.
 *
 * A file would be one more asset to serve and to cache-bust, and this is two
 * sine tones. The context is created on demand because a browser refuses one
 * built before the page has been interacted with.
 */
const blip = () => {
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
 * The interruption, in the order that respects the operator.
 *
 * Nothing at all while the tab is in front: they are already looking at it, and
 * the list updates on its own. The desktop notification only exists for the tab
 * that is behind something else, which is the case that prompted this.
 */
export const announce = (title: string, body: string): void => {
  if (document.visibilityState === 'visible') return

  if (soundEnabled()) {
    try {
      blip()
    } catch {
      // Autoplay policies. The notification below still lands.
    }
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') return

  try {
    // `tag` collapses a burst from the same person into one notification instead
    // of stacking four.
    new Notification(title, { body, tag: title })
  } catch {
    // Some browsers only allow this from a service worker. Nothing else breaks.
  }
}
