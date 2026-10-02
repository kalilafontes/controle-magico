import type { Quote } from '../domain/quote'
import { createAppsScriptClient } from './appsScriptClient'

export function createSheetsRepository(appsScriptUrl: string, token: string) {
  const api = createAppsScriptClient(appsScriptUrl, () => token)
  const getQuotes = () => api.request<Quote[]>('quotes.list')
  const saveQuote = async (quote: Quote) => {
    const items = quote.items.filter(item => item.description.trim() || item.quantity !== 1 || item.unitPrice !== 0)
    if (!items.length || items.some(item => !item.description.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) throw new Error('Preencha os itens com valores válidos.')
    return api.request<Quote>('quotes.save', { quote: { ...quote, items } })
  }
  const deleteQuote = (quoteId: string) => api.request<boolean>('quotes.delete', { quoteId })
  return { getQuotes, saveQuote, deleteQuote }
}
