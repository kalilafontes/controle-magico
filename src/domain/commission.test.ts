import { describe, expect, it } from 'vitest'
import { calculateCommissionValues } from './commission'

describe('comissão', () => {
  it('soma 25% do lucro a metade da diferença entre venda e valor total base', () => {
    expect(calculateCommissionValues(1, 12, 10)).toEqual({
      saleTotal: 12,
      costTotal: 10,
      profit: 5,
      commission: 2.25,
    })
  })
})
