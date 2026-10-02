import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPlanningRepository, getEndFormula, mapPlanRow, type PrintPlan } from './planningRepository'

const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response
const plan: PrintPlan = { row: 5, order: '1', piece: 'Base', quantity: 1, details: '', hours: 2, minutes: 0, pause: 0, start: '01/10/2026 08:00', end: '01/10/2026 10:00', duration: '2:00', status: 'Planejado', pauseDuring: 0, occurrence: '', printer: 'Bambu A1' }

describe('createPlanningRepository', () => {
  afterEach(() => vi.restoreAllMocks())
  it('consulta o planejamento pelo Web App', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: [plan] }))
    await expect(createPlanningRepository('https://script/exec', 'sessão').getPlans()).resolves.toEqual([plan])
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'plans.list', token: 'sessão' })
  })
  it('salva uma impressão existente pelo Web App', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: plan }))
    await createPlanningRepository('https://script/exec', 'sessão').savePlan(plan)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'plans.save', payload: { plan } })
  })
  it('sincroniza horários e mantém a lista calculada sem uma nova leitura', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: true }))
    await expect(createPlanningRepository('https://script/exec', 'sessão').synchronizeSchedule([{ ...plan, start: '01/10/2026 09:00' }], [plan])).resolves.toEqual([
      expect.objectContaining({ row: plan.row }),
    ])
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'plans.synchronize' })
  })
})

describe('mapPlanRow', () => {
  it('preserva a impressora vinda da coluna N', () => expect(mapPlanRow(['1', 'Vaso', '3', 'PLA rosa', '2', '30', '5', '', '', '', 'Planejado', '5', '', 'Bambu A1 2'], 5)).toMatchObject({ quantity: 3, printer: 'Bambu A1 2' }))
  it('mantém a fórmula de fim sem pausa antes', () => expect(getEndFormula(8)).toBe('=H8+E8/24+F8/1440+L8/1440'))
})
