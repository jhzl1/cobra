import { slugify } from './tenants.service'

describe('slugify', () => {
  it('turns a company name into a URL segment', () => {
    expect(slugify('Acme Telecomunicaciones')).toBe('acme-telecomunicaciones')
    expect(slugify('  Redes   del  Sur  ')).toBe('redes-del-sur')
  })

  it('keeps the letter when it strips the accent', () => {
    // Without the NFD split, "ó" is a single codepoint outside a-z and the
    // whole syllable is dropped: "telecomunicacin".
    expect(slugify('Telecomunicación')).toBe('telecomunicacion')
    expect(slugify('Ñandú Networks')).toBe('nandu-networks')
  })

  it('drops punctuation without leaving dangling hyphens', () => {
    expect(slugify('Acme S.A.S.')).toBe('acme-s-a-s')
    expect(slugify('¡Internet Ya!')).toBe('internet-ya')
    expect(slugify('--raro--')).toBe('raro')
  })

  it('truncates without ending in a hyphen', () => {
    const slug = slugify('Proveedor de Servicios de Internet del Valle del Cauca Sociedad')

    expect(slug.length).toBeLessThanOrEqual(36)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('falls back when nothing latin survives', () => {
    // The column is `not null` with a format check, so an empty slug would fail
    // the insert rather than the validation, which nobody could act on.
    expect(slugify('株式会社')).toBe('empresa')
    expect(slugify('...')).toBe('empresa')
  })
})
