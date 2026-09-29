import type { Quote, QuoteItem } from '../domain/quote'
import { parseMoneyInput } from '../domain/money'

const headers = ['ID', 'Criado em', 'Atualizado em', 'Cliente', 'Telefone', 'Status', 'Validade', 'Subtotal', 'Desconto', 'Total', 'Observações']
const quoteRange = 'Or%C3%A7amentos!A2:M'
const itemRange = 'Itens%20do%20Or%C3%A7amento!A2:E'

type ItemRow = { row: number; quoteId: string; item: QuoteItem }

function parseSheetDate(value: unknown) {
  if (typeof value === 'number') return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10)
  const text = String(value || '')
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text
}

export function createSheetsRepository(spreadsheetId: string, token: string) {
  const api = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
  const request = (path: string, init: RequestInit = {}) => fetch(`${api}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  }).then(async response => {
    if (!response.ok) {
      const body = await response.text()
      const message = (() => { try { return JSON.parse(body).error?.message || body } catch { return body } })()
      throw Object.assign(new Error(message || 'Falha na planilha'), { status: response.status })
    }
    return response.json()
  })
  const totals = (quote: Quote) => quote.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const getQuoteRows = async () => {
    const data = await request(`/values/${quoteRange}?valueRenderOption=UNFORMATTED_VALUE`)
    return (data.values || []) as string[][]
  }
  const getItemRows = async (): Promise<ItemRow[]> => {
    const data = await request(`/values/${itemRange}?valueRenderOption=UNFORMATTED_VALUE`)
    return ((data.values || []) as string[][])
      .map((row, index) => ({
        row: index + 2,
        quoteId: row[0],
        item: { id: `item-${index + 2}`, description: row[1] || '', quantity: Number(row[2] || 0), unitPrice: parseMoneyInput(String(row[3] || '')) },
      }))
      .filter(row => row.quoteId)
  }
  const getSheetIds = async () => {
    const data = await request('/?fields=sheets(properties(sheetId,title))')
    const sheets = data.sheets || []
    const quoteSheet = sheets.find((sheet: { properties: { title: string } }) => sheet.properties.title === 'Orçamentos')
    const itemSheet = sheets.find((sheet: { properties: { title: string } }) => sheet.properties.title === 'Itens do Orçamento')
    if (!quoteSheet || !itemSheet) throw new Error('Não encontrei as abas de orçamento na planilha.')
    return { quotes: quoteSheet.properties.sheetId as number, items: itemSheet.properties.sheetId as number }
  }
  const getQuotes = async (): Promise<Quote[]> => {
    const [rows, itemRows] = await Promise.all([getQuoteRows(), getItemRows()])
    return rows.map(row => ({
      id: row[0], createdAt: row[1], updatedAt: row[2], client: row[3], phone: row[4], status: row[5], validUntil: row[6],
      discount: parseMoneyInput(String(row[8] || '')), total: parseMoneyInput(String(row[9] || '')), receivedAmount: parseMoneyInput(String(row[11] || '')), deliveryDate: parseSheetDate(row[12]), notes: row[10] || '',
      items: itemRows.filter(itemRow => itemRow.quoteId === row[0]).map(itemRow => itemRow.item),
    } as Quote))
  }
  const saveQuote = async (quote: Quote) => {
    const items = quote.items.filter(item => item.description.trim() || item.quantity !== 1 || item.unitPrice !== 0)
    if (!items.length || items.some(item => !item.description.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) throw new Error('Preencha os itens com valores válidos.')
    const [currentRows, itemRows] = await Promise.all([getQuoteRows(), getItemRows()])
    const quoteToSave = { ...quote, items }
    const sum = totals(quoteToSave)
    const row = [quote.id, quote.createdAt, new Date().toISOString(), quote.client, quote.phone, quote.status, quote.validUntil, sum, quote.discount, Math.max(0, sum - quote.discount), quote.notes, quote.receivedAmount, quote.deliveryDate]
    const index = currentRows.findIndex(current => current[0] === quote.id)
    const quotePath = index >= 0
      ? `/values/Or%C3%A7amentos!A${index + 2}:M${index + 2}?valueInputOption=USER_ENTERED`
      : '/values/Or%C3%A7amentos!A:M:append?valueInputOption=USER_ENTERED'
    await request(quotePath, { method: index >= 0 ? 'PUT' : 'POST', body: JSON.stringify({ values: [row] }) })

    const existing = itemRows.filter(itemRow => itemRow.quoteId === quote.id)
    await Promise.all(items.slice(0, existing.length).map((item, itemIndex) => {
      const values = [[quote.id, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice]]
      const current = existing[itemIndex]
      return request(`/values/Itens%20do%20Or%C3%A7amento!A${current.row}:E${current.row}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values }) })
    }))
    const newItems = items.slice(existing.length)
    if (newItems.length) await request('/values/Itens%20do%20Or%C3%A7amento!A:E:append?valueInputOption=USER_ENTERED', { method: 'POST', body: JSON.stringify({ values: newItems.map(item => [quote.id, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice]) }) })
    await Promise.all(existing.slice(items.length).map(item => request(`/values/Itens%20do%20Or%C3%A7amento!A${item.row}:E${item.row}?valueInputOption=USER_ENTERED`, {
      method: 'PUT', body: JSON.stringify({ values: [['', '', '', '', '']] }),
    })))
    return quoteToSave
  }
  const deleteQuote = async (quoteId: string) => {
    const [quoteRows, itemRows, sheetIds] = await Promise.all([getQuoteRows(), getItemRows(), getSheetIds()])
    const quoteIndex = quoteRows.findIndex(row => row[0] === quoteId)
    if (quoteIndex < 0) throw new Error('Orçamento não encontrado.')
    const itemRowsToDelete = itemRows.filter(item => item.quoteId === quoteId).sort((a, b) => b.row - a.row)
    const requests = [
      { deleteDimension: { range: { sheetId: sheetIds.quotes, dimension: 'ROWS', startIndex: quoteIndex + 1, endIndex: quoteIndex + 2 } } },
      ...itemRowsToDelete.map(item => ({ deleteDimension: { range: { sheetId: sheetIds.items, dimension: 'ROWS', startIndex: item.row - 1, endIndex: item.row } } })),
    ]
    await request('/:batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) })
  }
  return { getQuotes, saveQuote, deleteQuote, headers }
}
