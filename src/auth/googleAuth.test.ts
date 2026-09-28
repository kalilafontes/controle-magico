import { beforeEach, describe, expect, it } from 'vitest'
import { clearSavedToken, getSavedToken, toAuthErrorMessage } from './googleAuth'

describe('mensagens de autenticação', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear() })
  it('orienta novo login quando a sessão expira', () => {
    expect(toAuthErrorMessage(401)).toContain('Entre novamente')
  })

  it('explica o acesso negado à planilha', () => {
    expect(toAuthErrorMessage(403)).toContain('acesso à planilha')
  })

  it('recupera o token válido salvo durante a sessão', () => {
    sessionStorage.setItem('orcamentos-token', JSON.stringify({ value: 'abc', expiresAt: Date.now() + 60_000 }))
    expect(getSavedToken()).toBe('abc')
  })

  it('mantém o token válido depois que a aba é reaberta', () => {
    localStorage.setItem('orcamentos-token', JSON.stringify({ value: 'persistente', expiresAt: Date.now() + 60_000 }))
    expect(getSavedToken()).toBe('persistente')
  })

  it('remove o token salvo ao encerrar a sessão', () => {
    sessionStorage.setItem('orcamentos-token', 'sessão')
    localStorage.setItem('orcamentos-token', 'persistente')

    clearSavedToken()

    expect(sessionStorage.getItem('orcamentos-token')).toBeNull()
    expect(localStorage.getItem('orcamentos-token')).toBeNull()
  })
})
