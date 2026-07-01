import { describe, it, expect, afterEach } from 'vitest'
import { pt } from './pt'
import { en } from './en'
import { es } from './es'
import { t, setLangDict, getLang, dateLocale, LANGS, isLang, type Lang } from './index'
import type { Messages } from './pt'

afterEach(() => setLangDict('pt'))

type Leaf = 'string' | 'function'
function shape(obj: Record<string, unknown>, path = ''): Record<string, Leaf> {
  const out: Record<string, Leaf> = {}
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    const p = path ? `${path}.${k}` : k
    if (typeof v === 'function') out[p] = 'function'
    else if (v && typeof v === 'object') Object.assign(out, shape(v as Record<string, unknown>, p))
    else out[p] = 'string'
  }
  return out
}

const DICTS: Record<Lang, Messages> = { pt, en, es }

describe('i18n — estrutura', () => {
  it('en e es têm exatamente as mesmas chaves e tipos que pt', () => {
    const ptShape = shape(pt as unknown as Record<string, unknown>)
    for (const lang of ['en', 'es'] as const) {
      const langShape = shape(DICTS[lang] as unknown as Record<string, unknown>)
      expect(Object.keys(langShape).sort(), `${lang}: conjunto de chaves`).toEqual(Object.keys(ptShape).sort())
      for (const key of Object.keys(ptShape)) {
        expect(langShape[key], `${lang}: tipo de ${key}`).toBe(ptShape[key])
      }
    }
  })

  it('nenhuma string é vazia em pt/en/es', () => {
    for (const lang of ['pt', 'en', 'es'] as const) {
      const walk = (obj: Record<string, unknown>, path = '') => {
        for (const k of Object.keys(obj)) {
          const v = obj[k]
          const p = path ? `${path}.${k}` : k
          if (typeof v === 'string') expect(v.trim().length, `${lang}: ${p} vazio`).toBeGreaterThan(0)
          else if (v && typeof v === 'object') walk(v as Record<string, unknown>, p)
        }
      }
      walk(DICTS[lang] as unknown as Record<string, unknown>)
    }
  })

  it('todas as funções retornam string não-vazia em cada idioma', () => {
    for (const lang of ['pt', 'en', 'es'] as const) {
      const walk = (obj: Record<string, unknown>, path = '') => {
        for (const k of Object.keys(obj)) {
          const v = obj[k]
          const p = path ? `${path}.${k}` : k
          if (typeof v === 'function') {
            const out = (v as (...a: unknown[]) => string)(2, 'x', 'y', 'z')
            expect(typeof out, `${lang}: ${p} tipo de retorno`).toBe('string')
            expect(out.length, `${lang}: ${p} retorno vazio`).toBeGreaterThan(0)
          } else if (v && typeof v === 'object') walk(v as Record<string, unknown>, p)
        }
      }
      walk(DICTS[lang] as unknown as Record<string, unknown>)
    }
  })
})

describe('i18n — troca de idioma', () => {
  it('default é pt', () => {
    expect(getLang()).toBe('pt')
    expect(t.common.back).toBe('Voltar')
  })

  it('setLangDict troca o dicionário resolvido por t', () => {
    setLangDict('en')
    expect(getLang()).toBe('en')
    expect(t.common.back).toBe('Back')
    expect(t.auth.login).toBe('Log in')
    setLangDict('es')
    expect(getLang()).toBe('es')
    expect(t.common.back).toBe('Volver')
    expect(t.auth.login).toBe('Entrar')
  })

  it('funções parametrizadas seguem o idioma vigente', () => {
    setLangDict('en')
    expect(t.common.scenarioCount(2)).toBe('2 scenarios')
    expect(t.common.scenarioCount(1)).toBe('1 scenario')
    setLangDict('es')
    expect(t.common.scenarioCount(2)).toBe('2 escenarios')
  })

  it('LANGS lista pt/en/es e isLang valida', () => {
    expect(LANGS.map(l => l.code)).toEqual(['pt', 'en', 'es'])
    expect(isLang('en')).toBe(true)
    expect(isLang('xx')).toBe(false)
  })

  it('dateLocale acompanha o idioma vigente', () => {
    setLangDict('pt')
    expect(dateLocale()).toBe('pt-BR')
    setLangDict('en')
    expect(dateLocale()).toBe('en-US')
    setLangDict('es')
    expect(dateLocale()).toBe('es-ES')
  })
})
