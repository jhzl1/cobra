const STORAGE_KEY = 'cobra.sound'

/**
 * One audio context for the page, resumed the first time anyone touches it.
 *
 * A browser hands back a context in `suspended` until the page has had a real
 * gesture, and a suspended context plays nothing and throws nothing — which is
 * exactly how the alert was silent while every other part of it worked. Creating
 * one per blip made it worse: each new context started suspended again.
 */
let context: AudioContext | null = null

const contextOf = (): AudioContext | null => {
  if (context) return context

  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!Ctor) return null

  context = new Ctor()

  return context
}

/** Any gesture unlocks the audio, and one is enough for the life of the page. */
export const unlockSound = (): void => {
  void contextOf()?.resume()
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockSound()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }

  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/**
 * A short blip: two sine tones, synthesised rather than fetched.
 *
 * A file would be one more asset to serve and to cache-bust, and this is two
 * notes.
 */
export const playBlip = (): void => {
  const audio = contextOf()

  if (!audio) return

  // Still suspended when nobody has touched the page yet. Resuming is async, so
  // this blip is lost and the next one lands — better than a silence with no
  // explanation.
  if (audio.state === 'suspended') {
    void audio.resume()
    return
  }

  const gain = audio.createGain()

  gain.connect(audio.destination)
  gain.gain.setValueAtTime(0.0001, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35)

  for (const [frequency, at] of [
    [880, 0],
    [1174, 0.09],
  ] as const) {
    const oscillator = audio.createOscillator()

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    oscillator.start(audio.currentTime + at)
    oscillator.stop(audio.currentTime + at + 0.12)
  }
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
