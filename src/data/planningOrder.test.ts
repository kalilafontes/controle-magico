import { describe, expect, it } from 'vitest'
import { assignPlanningOrder } from './planningOrder'

describe('assignPlanningOrder', () => {
  it('numera pelo horário de início, do mais cedo para o mais tarde', () => {
    const plans = assignPlanningOrder([
      { row: 5, start: '28/09/2026 14:00', order: '' },
      { row: 6, start: '28/09/2026 09:00', order: '' },
      { row: 7, start: '', order: '' },
    ])

    expect(plans.map(plan => [plan.row, plan.order])).toEqual([[6, '1'], [5, '2'], [7, '']])
  })
})
