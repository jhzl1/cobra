import { heroui } from '@heroui/react'

/**
 * HeroUI's Tailwind plugin, loaded from `index.css` with `@plugin`. Tailwind v4
 * has no JavaScript config file, so a plugin that needs options lives here.
 */
export default heroui({
  themes: {
    light: {
      colors: {
        primary: {
          DEFAULT: '#0f766e',
          foreground: '#ffffff',
        },
        focus: '#0f766e',
      },
    },
  },
})
