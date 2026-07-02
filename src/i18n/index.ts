import { pt } from './pt'
import { en } from './en'
import { es } from './es'
import type { Messages } from './pt'

export type Lang = 'pt' | 'en' | 'es'

export const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: 'pt', label: 'PT', name: 'Português' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Español' },
]

const DICTS: Record<Lang, Messages> = { pt, en, es }

export function isLang(v: unknown): v is Lang {
  return v === 'pt' || v === 'en' || v === 'es'
}

let currentLang: Lang = 'pt'
let current: Messages = pt

export function setLangDict(lang: Lang) {
  currentLang = lang
  current = DICTS[lang]
}

export function getLang(): Lang {
  return currentLang
}

const LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }

export function dateLocale(): string {
  return LOCALES[currentLang]
}

// `t` é um Proxy que sempre resolve o dicionário do idioma vigente, então
// os componentes seguem importando `t` estaticamente e o texto acompanha a
// troca de idioma ao re-renderizar. Constantes de módulo NÃO devem capturar
// `t.x.y` (valor congelado) — leiam `t` em tempo de render (função/JSX).
export const t: Messages = new Proxy({} as Messages, {
  get(_target, prop: string | symbol) {
    return (current as Record<string | symbol, unknown>)[prop]
  },
}) as Messages

export type { Messages }
