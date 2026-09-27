import { describe, expect, it } from 'vitest'
import { calculatePaymentStatus, calculateQuoteTotals, createDraftQuote, validateQuote } from './quote'

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

  it('informa o progresso do pagamento a partir do valor recebido', () => {
    expect(calculatePaymentStatus(680, 340)).toBe('Parcialmente pago')
    expect(calculatePaymentStatus(680, 680)).toBe('Pago')
  })
})
