import { describe, expect, it } from 'vitest'
import { createPlansFromQuote } from './production'
import type { Quote } from './quote'

describe('createPlansFromQuote', () => {
  it('cria um planejamento para cada produto mantendo descrição e quantidade', () => {
    const quote: Quote = {
      id: 'orc-1', createdAt: '', updatedAt: '', client: 'Ana', phone: '', status: 'Aprovado', validUntil: '',
      items: [
        { id: 'item-1', description: 'Vaso geométrico', quantity: 2, unitPrice: 35 },
        { id: 'item-2', description: 'Chaveiro', quantity: 10, unitPrice: 4 },
      ],
      discount: 0, receivedAmount: 0, deliveryDate: '', notes: '',
    }

    expect(createPlansFromQuote(quote)).toEqual([
      expect.objectContaining({ piece: 'Vaso geométrico', quantity: 2, details: 'Cliente: Ana', status: 'Planejado', printer: 'Osvalda' }),
      expect.objectContaining({ piece: 'Chaveiro', quantity: 10, details: 'Cliente: Ana', status: 'Planejado', printer: 'Osvalda' }),
    ])
  })
})
