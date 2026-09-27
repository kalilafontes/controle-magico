import { describe, expect, it } from 'vitest'
import { getSavedToken, toAuthErrorMessage } from './googleAuth'

describe('mensagens de autenticação', () => {
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
})
