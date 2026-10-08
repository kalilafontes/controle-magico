import { describe, expect, it } from 'vitest'
import { buildQuoteShareText, calculatePaymentStatus, calculateQuoteTotals, createDraftQuote, getPaymentStatusClass, getQuoteStatusClass, validateQuote } from './quote'

describe('orçamentos', () => {
  it('calcula subtotal e total com desconto', () => {
    expect(calculateQuoteTotals([{ id: '1', description: 'Peça', quantity: 2, unitPrice: 50 }], 10)).toEqual({ subtotal: 100, total: 90 })
  })

  it('não produz total negativo', () => {
    expect(calculateQuoteTotals([{ id: '1', description: 'Peça', quantity: 1, unitPrice: 50 }], 80).total).toBe(0)
  })

  it('informa os campos obrigatórios de um orçamento vazio', () => {
    expect(validateQuote(createDraftQuote())).toContain('Cliente é obrigatório.')
  })

  it('cria um primeiro produto estável para o novo orçamento', () => {
    const draft = createDraftQuote()
    expect(draft.items).toEqual([expect.objectContaining({ description: '', quantity: 1, unitPrice: 0 })])
  })

  it('informa o progresso do pagamento a partir do valor recebido', () => {
    expect(calculatePaymentStatus(680, 340)).toBe('Parcialmente pago')
    expect(calculatePaymentStatus(680, 680)).toBe('Pago')
  })

  it('atribui cores distintas para cada estágio e pagamento', () => {
    expect(getQuoteStatusClass('Aguardando produção')).toBe('status-production')
    expect(getQuoteStatusClass('Em produção')).toBe('status-in-production')
    expect(getQuoteStatusClass('Entregue')).toBe('status-delivered')
    expect(getQuoteStatusClass('Recusado')).toBe('status-rejected')
    expect(getPaymentStatusClass('Não pago')).toBe('payment-unpaid')
    expect(getPaymentStatusClass('Parcialmente pago')).toBe('payment-partial')
    expect(getPaymentStatusClass('Pago')).toBe('payment-paid')
  })

  it('monta um texto de compartilhamento sem destinatário específico', () => {
    const text = buildQuoteShareText({
      id: 'orc-1', createdAt: '', updatedAt: '', client: 'Ana', phone: '', status: 'Rascunho', validUntil: '2026-10-15',
      items: [{ id: 'item-1', description: 'Vaso geométrico', quantity: 2, unitPrice: 35 }], discount: 5, receivedAmount: 0, deliveryDate: '', notes: '',
    })

    expect(text).toBe('Orçamento\n\nOlá! 😊\nSegue o orçamento solicitado:\n\n• 2x Vaso geométrico — R$ 70,00\n\nDesconto: R$ 5,00\nTotal: R$ 65,00\nValidade: 15/10/2026')
  })

  it('omite o desconto quando ele é zero', () => {
    const text = buildQuoteShareText({
      id: 'orc-1', createdAt: '', updatedAt: '', client: 'Ana', phone: '', status: 'Rascunho', validUntil: '',
      items: [{ id: 'item-1', description: 'Chaveiro', quantity: 30, unitPrice: 2.5 }], discount: 0, receivedAmount: 0, deliveryDate: '', notes: '',
    })

    expect(text).toBe('Orçamento\n\nOlá! 😊\nSegue o orçamento solicitado:\n\n• 30x Chaveiro — R$ 75,00\n\nTotal: R$ 75,00')
  })
})
