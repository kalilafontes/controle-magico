import type { Quote } from './quote'

export interface ProductionPlanDraft {
  order: string
  piece: string
  quantity: number
  details: string
  hours: number
  minutes: number
  pause: number
  start: string
  end: string
  duration: string
  status: string
  pauseDuring: number
  occurrence: string
  printer: string
}

export const createPlansFromQuote = (quote: Quote): ProductionPlanDraft[] => quote.items.map(item => ({
  order: '',
  piece: item.description,
  quantity: item.quantity,
  details: quote.client ? `Cliente: ${quote.client}` : '',
  hours: 0,
  minutes: 0,
  pause: 0,
  start: '',
  end: '',
  duration: '',
  status: 'Planejado',
  pauseDuring: 0,
  occurrence: '',
  printer: 'Bambu A1',
}))
