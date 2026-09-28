import { describe, expect, it } from 'vitest'
import { formatMoneyInput, parseMoneyInput } from './money'

describe('valores em real', () => {
  it('formata valores numéricos sem expor controles de número', () => {
    expect(formatMoneyInput(25)).toBe('R$ 25,00')
  })

  it('converte valores digitados em real para número', () => {
    expect(parseMoneyInput('R$ 25,50')).toBe(25.5)
    expect(parseMoneyInput('R$ 1.234,56')).toBe(1234.56)
  })
})
