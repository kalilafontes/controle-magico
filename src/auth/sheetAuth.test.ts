import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSavedSession, getSavedSession, loginWithSheet, saveSession } from './sheetAuth'

describe('autenticação pela planilha', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks() })

  it('guarda uma sessão persistente retornada pelo login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { token: 'sessão-1', name: 'Kalila' } }) } as Response)

    await expect(loginWithSheet('https://script.google.com/macros/s/abc/exec', 'kalila.fontes@gmail.com', 'magica1')).resolves.toEqual({ token: 'sessão-1', name: 'Kalila' })
    expect(getSavedSession()).toEqual({ token: 'sessão-1', name: 'Kalila' })
  })

  it('recusa uma resposta de login incompleta', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { name: 'Kalila' } }) } as Response)

    await expect(loginWithSheet('https://script.google.com/macros/s/abc/exec', 'kalila.fontes@gmail.com', 'magica1')).rejects.toThrow('Não foi possível entrar')
  })

  it('remove apenas a sessão quando a pessoa sai', () => {
    saveSession({ token: 'sessão-1', name: 'Kalila' })
    clearSavedSession()
    expect(getSavedSession()).toBeNull()
  })
})
