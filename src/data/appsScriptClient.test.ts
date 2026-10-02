import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppsScriptClient, SessionExpiredError } from './appsScriptClient'

describe('createAppsScriptClient', () => {
  afterEach(() => vi.restoreAllMocks())

  it('envia a sessão e a ação em JSON simples para o Web App', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: ['orçamento'] }) } as Response)

    await expect(createAppsScriptClient('https://script.google.com/macros/s/abc/exec', () => 'sessão-1').request<string[]>('quotes.list')).resolves.toEqual(['orçamento'])

    expect(fetchMock).toHaveBeenCalledWith('https://script.google.com/macros/s/abc/exec', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'quotes.list', token: 'sessão-1', payload: {} }),
    }))
  })

  it('identifica sessão recusada pelo Web App', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: false, code: 'UNAUTHORIZED', message: 'Sessão inválida.' }) } as Response)

    await expect(createAppsScriptClient('https://script.google.com/macros/s/abc/exec', () => 'sessão-1').request('quotes.list')).rejects.toBeInstanceOf(SessionExpiredError)
  })
})
