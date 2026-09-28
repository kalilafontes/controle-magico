import { describe, expect, it } from 'vitest'
import { makeSequentialSchedule } from './planningSchedule'

describe('makeSequentialSchedule', () => {
  it('adia a próxima impressão que começaria antes do fim da anterior', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, start: '28/09/2026 09:58', end: '', hours: 2, minutes: 10, pause: 0, pauseDuring: 0 },
      { row: 6, start: '28/09/2026 10:20', end: '', hours: 1, minutes: 0, pause: 0, pauseDuring: 0 },
    ])

    expect(schedule[1]).toMatchObject({ start: '28/09/2026 12:08' })
  })
})
