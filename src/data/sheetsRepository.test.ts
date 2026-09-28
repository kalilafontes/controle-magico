import { describe, expect, it, vi } from 'vitest'
import { createSheetsRepository } from './sheetsRepository'
import type { Quote } from '../domain/quote'

const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response

const quote = (items: Quote['items']): Quote => ({
  id: 'orc-1', createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-28T10:00:00.000Z',
  client: 'Kalila', phone: '', status: 'Rascunho', validUntil: '2026-10-01', discount: 0,
  receivedAmount: 0, deliveryDate: '', notes: '', items,
})

describe('createSheetsRepository', () => {
  it('carrega os produtos da aba de itens pelo ID do orçamento', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ values: [
        ['orc-1', '2026-09-28', '', 'Kalila', '', 'Rascunho', '2026-10-01', '30,50', '0', '30,50', '', '0', 46293],
        ['orc-2', '2026-09-28', '', 'Outra', '', 'Rascunho', '2026-10-01', '8', '0', '8'],
      ] }))
      .mockResolvedValueOnce(response({ values: [
        ['orc-1', 'Base', '2', '10,25', '20,50'],
        ['orc-2', 'Chaveiro', '1', '8', '8'],
        ['orc-1', 'Tampa', '1', '10', '10'],
      ] }))

    const quotes = await createSheetsRepository('sheet-id', 'token').getQuotes()

    expect(quotes[0].items).toEqual([
      { id: 'item-2', description: 'Base', quantity: 2, unitPrice: 10.25 },
      { id: 'item-4', description: 'Tampa', quantity: 1, unitPrice: 10 },
    ])
    expect(quotes[1].items).toEqual([{ id: 'item-3', description: 'Chaveiro', quantity: 1, unitPrice: 8 }])
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('Itens%20do%20Or%C3%A7amento!A2:E'))).toBe(true)
    expect(quotes[0].total).toBe(30.5)
    expect(quotes[0].deliveryDate).toBe('2026-09-28')
    fetchMock.mockRestore()
  })

  it('atualiza os itens existentes e limpa somente o produto removido', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ values: [['orc-1', '2026-09-28', '', 'Kalila', '', 'Rascunho', '2026-10-01', '30', '0', '30']] }))
      .mockResolvedValueOnce(response({ values: [
        ['orc-1', 'Base antiga', '1', '10', '10'],
        ['orc-1', 'Tampa removida', '1', '20', '20'],
        ['orc-2', 'Outro orçamento', '1', '8', '8'],
      ] }))
      .mockResolvedValue(response({}))

    await createSheetsRepository('sheet-id', 'token').saveQuote(quote([
      { id: 'item-2', description: 'Base nova', quantity: 2, unitPrice: 15 },
    ]))

    const calls = fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body || '{}')) }))
    expect(calls).toContainEqual(expect.objectContaining({
      url: expect.stringContaining('Itens%20do%20Or%C3%A7amento!A2:E2'),
      body: { values: [['orc-1', 'Base nova', 2, 15, 30]] },
    }))
    expect(calls).toContainEqual(expect.objectContaining({
      url: expect.stringContaining('Itens%20do%20Or%C3%A7amento!A3:E3'),
      body: { values: [['', '', '', '', '']] },
    }))
    expect(calls.some(call => call.url.includes('A4:E4'))).toBe(false)
    fetchMock.mockRestore()
  })

  it('rejeita itens inválidos antes de alterar a planilha', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(createSheetsRepository('sheet-id', 'token').saveQuote(quote([
      { id: 'item-1', description: '', quantity: 0, unitPrice: Number.NaN },
    ]))).rejects.toThrow('Preencha os itens')

    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockRestore()
  })
})
