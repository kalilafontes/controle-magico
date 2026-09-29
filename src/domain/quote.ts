export type QuoteStatus = 'Rascunho' | 'Enviado' | 'Aguardando aprovação' | 'Aprovado' | 'Aguardando produção' | 'Aguardando entrega' | 'Entregue' | 'Recusado'

export interface QuoteItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export interface Quote {
  id: string
  createdAt: string
  updatedAt: string
  client: string
  phone: string
  status: QuoteStatus
  validUntil: string
  items: QuoteItem[]
  discount: number
  total?: number
  receivedAmount: number
  deliveryDate: string
  notes: string
}

export function createDraftQuote(): Quote {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, client: '', phone: '', status: 'Rascunho', validUntil: '', items: [{ id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 }], discount: 0, receivedAmount: 0, deliveryDate: '', notes: '' }
}

export function calculatePaymentStatus(total: number, receivedAmount: number) {
  if (receivedAmount <= 0) return 'Não pago'
  if (receivedAmount >= total) return 'Pago'
  return 'Parcialmente pago'
}

export const getQuoteStatusClass = (status: QuoteStatus) => ({
  Rascunho: 'status-draft',
  Enviado: 'status-sent',
  'Aguardando aprovação': 'status-approval',
  Aprovado: 'status-approved',
  'Aguardando produção': 'status-production',
  'Aguardando entrega': 'status-delivery',
  Entregue: 'status-delivered',
  Recusado: 'status-rejected',
}[status])

export const getPaymentStatusClass = (status: string) => ({
  'Não pago': 'payment-unpaid',
  'Parcialmente pago': 'payment-partial',
  Pago: 'payment-paid',
}[status] || 'payment-unpaid')

export function calculateQuoteTotals(items: QuoteItem[], discount: number) {
  const subtotal = items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice), 0)
  return { subtotal, total: Math.max(0, subtotal - Math.max(0, discount)) }
}

const formatQuoteMoney = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
const formatQuoteDate = (value: string) => value ? value.split('-').reverse().join('/') : ''

export function buildQuoteShareText(quote: Quote) {
  const { total } = calculateQuoteTotals(quote.items, quote.discount)
  const items = quote.items.map(item => `• ${item.quantity}x ${item.description} — ${formatQuoteMoney(item.quantity * item.unitPrice)}`).join('\n')
  const priceDetails = quote.discount > 0 ? `\n\nDesconto: ${formatQuoteMoney(quote.discount)}\nTotal: ${formatQuoteMoney(total)}` : `\n\nTotal: ${formatQuoteMoney(total)}`
  return `Orçamento\n\nOlá! 😊\nSegue o orçamento solicitado:\n\n${items}${priceDetails}${quote.validUntil ? `\nValidade: ${formatQuoteDate(quote.validUntil)}` : ''}`
}

export function validateQuote(quote: Quote): string[] {
  const errors: string[] = []
  if (!quote.client.trim()) errors.push('Cliente é obrigatório.')
  if (!quote.validUntil) errors.push('Validade é obrigatória.')
  if (!quote.items.length) errors.push('Adicione pelo menos um item.')
  if (quote.items.some((item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0)) errors.push('Preencha os itens com valores válidos.')
  return errors
}
