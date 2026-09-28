import { describe, expect, it } from 'vitest'
import { mapPlanRow } from './planningRepository'

describe('mapPlanRow', () => {
  it('lê quantidade na coluna C após a alteração da planilha', () => {
    const plan = mapPlanRow(['1', 'Vaso', '3', 'PLA rosa', '2', '30', '5', '28/09/2026 10:00', '28/09/2026 12:35', '2:35', 'Imprimindo', '5', 'Troca de filamento'], 5)

    expect(plan).toMatchObject({ piece: 'Vaso', quantity: 3, details: 'PLA rosa', hours: 2, status: 'Imprimindo', pauseDuring: 5, occurrence: 'Troca de filamento' })
  })
})
