import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSheetsRepository } from './sheetsRepository'
import { SessionExpiredError } from './appsScriptClient'
import type { Quote } from '../domain/quote'
const quote: Quote = { id: 'orc-1', createdAt: '', updatedAt: '', client: 'Kalila', phone: '', status: 'Rascunho', validUntil: '', items: [{ id: 'item-1', description: 'Base', quantity: 1, unitPrice: 20 }], discount: 0, total: 20, receivedAmount: 0, deliveryDate: '', notes: '' }
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response
describe('createSheetsRepository', () => {
  afterEach(() => vi.restoreAllMocks())
  it('usa a ação de listagem de orçamentos do Web App', async () => { const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: [quote] })); await expect(createSheetsRepository('https://script/exec', 'sessão').getQuotes()).resolves.toEqual([quote]); expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'quotes.list', token: 'sessão' }) })
  it('salva um orçamento pelo Web App', async () => { const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: quote })); await createSheetsRepository('https://script/exec', 'sessão').saveQuote(quote); expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'quotes.save', payload: { quote } }) })
  it('rejeita itens inválidos sem chamar o Web App', async () => { const fetchMock = vi.spyOn(globalThis, 'fetch'); await expect(createSheetsRepository('https://script/exec', 'sessão').saveQuote({ ...quote, items: [{ ...quote.items[0], description: '', quantity: 0 }] })).rejects.toThrow('Preencha os itens'); expect(fetchMock).not.toHaveBeenCalled() })
  it('propaga sessão inválida', async () => { vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: false, code: 'UNAUTHORIZED', message: 'Sessão inválida.' })); await expect(createSheetsRepository('https://script/exec', 'sessão').getQuotes()).rejects.toBeInstanceOf(SessionExpiredError) })
})
