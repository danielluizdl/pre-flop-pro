import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { LanguageSelect } from './LanguageSelect'
import { Sidebar } from './Sidebar'
import { useStore } from '../../store/useStore'
import { getLang, setLangDict } from '../../i18n'

afterEach(() => { setLangDict('pt'); useStore.setState({ lang: 'pt' }) })

describe('LanguageSelect', () => {
  it('abre o menu e lista os 3 idiomas', () => {
    render(<LanguageSelect />)
    fireEvent.click(screen.getByRole('button', { name: /Idioma \/ Language/ }))
    expect(screen.getByRole('option', { name: /Português/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /English/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Español/ })).toBeInTheDocument()
  })

  it('selecionar um idioma atualiza o store e o dicionário', () => {
    render(<LanguageSelect />)
    fireEvent.click(screen.getByRole('button', { name: /Idioma \/ Language/ }))
    fireEvent.click(screen.getByRole('option', { name: /English/ }))
    expect(useStore.getState().lang).toBe('en')
    expect(getLang()).toBe('en')
  })

  it('a opção do idioma vigente fica marcada (aria-selected)', () => {
    useStore.setState({ lang: 'es' })
    setLangDict('es')
    render(<LanguageSelect />)
    fireEvent.click(screen.getByRole('button', { name: /Idioma \/ Language/ }))
    expect(screen.getByRole('option', { name: /Español/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: /English/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('a troca de idioma reflete no texto traduzido de outro componente', () => {
    setLangDict('en')
    useStore.setState({ lang: 'en', userMode: 'visitor', page: 'dashboard' })
    render(<Sidebar collapsed={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'My Ranges' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Meus Ranges' })).not.toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<LanguageSelect />)
    fireEvent.click(screen.getByRole('button', { name: /Idioma \/ Language/ }))
    expect((await axe(container)).violations).toEqual([])
  })
})
