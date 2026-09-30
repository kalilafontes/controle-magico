import { describe, expect, it } from 'vitest'
import { makeSequentialSchedule, reorderPlannedStarts } from './planningSchedule'

describe('makeSequentialSchedule', () => {
  it('move um planejamento atrasado para o horário atual', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, status: 'Planejado', start: '29/09/2026 07:30', end: '', hours: 8, minutes: 20, pause: 0, pauseDuring: 0 },
    ], new Date(2026, 8, 29, 19, 59))

    expect(schedule[0]).toMatchObject({ start: '29/09/2026 19:59', end: '30/09/2026 04:19' })
  })

  it('adia a próxima impressão que começaria antes do fim da anterior', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, start: '28/09/2026 09:58', end: '', hours: 2, minutes: 10, pause: 0, pauseDuring: 0 },
      { row: 6, start: '28/09/2026 10:20', end: '', hours: 1, minutes: 0, pause: 0, pauseDuring: 0 },
    ], new Date(2026, 8, 28, 8))

    expect(schedule[1]).toMatchObject({ start: '28/09/2026 12:08' })
  })

  it('preserva a impressão em andamento e ajusta somente a próxima', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, status: 'Em impressão', start: '28/09/2026 09:58', end: '', hours: 2, minutes: 10, pause: 0, pauseDuring: 0 },
      { row: 6, status: 'Planejado', start: '28/09/2026 10:20', end: '', hours: 1, minutes: 0, pause: 0, pauseDuring: 0 },
    ], new Date(2026, 8, 28, 8))

    expect(schedule[0]).toMatchObject({ start: '28/09/2026 09:58', end: '' })
    expect(schedule[1]).toMatchObject({ start: '28/09/2026 12:08' })
  })

  it('encadeia a próxima impressão após a ativa mesmo que ela tenha um horário futuro salvo', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, status: 'Em impressão', start: '29/09/2026 20:14', end: '29/09/2026 23:09', hours: 2, minutes: 55, pause: 0, pauseDuring: 0 },
      { row: 6, status: 'Planejado', start: '30/09/2026 05:04', end: '', hours: 8, minutes: 20, pause: 10, pauseDuring: 0 },
    ], new Date(2026, 8, 29, 20, 14))

    expect(schedule.find(plan => plan.row === 6)).toMatchObject({ start: '29/09/2026 23:19', end: '30/09/2026 07:39' })
  })

  it('calcula as filas das impressoras separadamente', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, printer: 'Bambu A1', status: 'Em impressão', start: '29/09/2026 20:14', end: '29/09/2026 23:09', hours: 2, minutes: 55, pause: 0, pauseDuring: 0 },
      { row: 6, printer: 'Bambu A1', status: 'Planejado', start: '30/09/2026 05:04', end: '', hours: 1, minutes: 0, pause: 10, pauseDuring: 0 },
      { row: 7, printer: 'Bambu A1 2', status: 'Planejado', start: '29/09/2026 20:14', end: '', hours: 1, minutes: 0, pause: 0, pauseDuring: 0 },
    ], new Date(2026, 8, 29, 20, 14))

    expect(schedule.find(plan => plan.row === 6)).toMatchObject({ start: '29/09/2026 23:19' })
    expect(schedule.find(plan => plan.row === 7)).toMatchObject({ start: '29/09/2026 20:14' })
  })

  it('agenda um planejamento sem início após o último item da mesma impressora', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, printer: 'Bambu A1', status: 'Planejado', start: '29/09/2026 20:00', end: '', hours: 2, minutes: 0, pause: 0, pauseDuring: 0 },
      { row: 6, printer: 'Bambu A1', status: 'Planejado', start: '', end: '', hours: 1, minutes: 0, pause: 10, pauseDuring: 0 },
    ], new Date(2026, 8, 29, 19))

    expect(schedule.find(plan => plan.row === 6)).toMatchObject({ start: '29/09/2026 22:10', end: '29/09/2026 23:10' })
  })

  it('prioriza a impressão em andamento quando ela e a próxima têm o mesmo início', () => {
    const schedule = makeSequentialSchedule([
      { row: 6, status: 'Planejado', start: '29/09/2026 07:30', end: '', hours: 3, minutes: 15, pause: 0, pauseDuring: 0 },
      { row: 5, status: 'Em impressão', start: '29/09/2026 07:30', end: '29/09/2026 12:20', hours: 4, minutes: 50, pause: 0, pauseDuring: 0 },
    ], new Date(2026, 8, 29, 7))

    expect(schedule.find(plan => plan.row === 6)).toMatchObject({ start: '29/09/2026 12:20', end: '29/09/2026 15:35' })
  })

  it('aplica a pausa antes entre o término anterior e o início da próxima impressão', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, status: 'Em impressão', start: '29/09/2026 12:20', end: '29/09/2026 15:35', hours: 3, minutes: 15, pause: 0, pauseDuring: 0 },
      { row: 6, status: 'Planejado', start: '29/09/2026 15:35', end: '', hours: 2, minutes: 55, pause: 10, pauseDuring: 0 },
    ], new Date(2026, 8, 29, 7))

    expect(schedule.find(plan => plan.row === 6)).toMatchObject({ start: '29/09/2026 15:45', end: '29/09/2026 18:40' })
  })

  it('não altera automaticamente linhas que não estão planejadas', () => {
    const schedule = makeSequentialSchedule([
      { row: 5, status: 'Em impressão', start: '28/09/2026 09:58', end: '28/09/2026 12:08', hours: 2, minutes: 10, pause: 0, pauseDuring: 0 },
      { row: 6, status: 'Pausado', start: '28/09/2026 10:20', end: '28/09/2026 11:20', hours: 1, minutes: 0, pause: 0, pauseDuring: 0 },
      { row: 7, status: 'Planejado', start: '28/09/2026 10:30', end: '', hours: 1, minutes: 0, pause: 0, pauseDuring: 0 },
    ], new Date(2026, 8, 28, 8))

    expect(schedule[0]).toMatchObject({ start: '28/09/2026 09:58', end: '28/09/2026 12:08' })
    expect(schedule[1]).toMatchObject({ start: '28/09/2026 10:20', end: '28/09/2026 11:20' })
    expect(schedule[2]).toMatchObject({ start: '28/09/2026 12:08', end: '28/09/2026 13:08' })
  })
})

describe('reorderPlannedStarts', () => {
  it('move para a primeira posição visual mesmo quando as linhas da planilha já foram reordenadas', () => {
    const plans = reorderPlannedStarts([
      { row: 6, status: 'Planejado', start: '29/09/2026 11:00' },
      { row: 7, status: 'Planejado', start: '29/09/2026 10:00' },
    ], 6, 7, 'before')

    expect(plans.map(plan => [plan.row, plan.start])).toEqual([
      [6, '29/09/2026 10:00'],
      [7, '29/09/2026 11:00'],
    ])
  })

  it('move um planejamento para depois de outro sem deslocar a impressão em andamento', () => {
    const plans = reorderPlannedStarts([
      { row: 5, status: 'Em impressão', start: '29/09/2026 08:00' },
      { row: 6, status: 'Planejado', start: '29/09/2026 10:00' },
      { row: 7, status: 'Planejado', start: '29/09/2026 11:00' },
    ], 6, 7, 'after')

    expect(plans.map(plan => [plan.row, plan.start])).toEqual([
      [5, '29/09/2026 08:00'],
      [6, '29/09/2026 11:00'],
      [7, '29/09/2026 10:00'],
    ])
  })
})
