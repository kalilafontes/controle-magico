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

  it('preserva a impressão em andamento e ajusta somente a próxima', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, status: 'Em impressão', start: '09:58', end: '', hours: 2, minutes: 10, pause: 0, pauseDuring: 0 },
      { row: 6, status: 'Planejado', start: '28/09/2026 10:20', end: '', hours: 1, minutes: 0, pause: 0, pauseDuring: 0 },
    ])

    expect(schedule[0]).toMatchObject({ start: '09:58', end: '' })
    expect(schedule[1]).toMatchObject({ start: '28/09/2026 12:08' })
  })

  it('não altera automaticamente linhas que não estão planejadas', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, status: 'Em impressão', start: '28/09/2026 09:58', end: '28/09/2026 12:08', hours: 2, minutes: 10, pause: 0, pauseDuring: 0 },
      { row: 6, status: 'Pausado', start: '28/09/2026 10:20', end: '28/09/2026 11:20', hours: 1, minutes: 0, pause: 0, pauseDuring: 0 },
      { row: 7, status: 'Planejado', start: '28/09/2026 10:30', end: '', hours: 1, minutes: 0, pause: 0, pauseDuring: 0 },
    ])

    expect(schedule[0]).toMatchObject({ start: '28/09/2026 09:58', end: '28/09/2026 12:08' })
    expect(schedule[1]).toMatchObject({ start: '28/09/2026 10:20', end: '28/09/2026 11:20' })
    expect(schedule[2]).toMatchObject({ start: '28/09/2026 12:08', end: '28/09/2026 13:08' })
  })
})
