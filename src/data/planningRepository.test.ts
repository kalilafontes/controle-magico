import { describe, expect, it, vi } from 'vitest'
import { createPlanningRepository, mapPlanRow, type PrintPlan } from './planningRepository'

describe('mapPlanRow', () => {
  it('lê quantidade na coluna C após a alteração da planilha', () => {
    const plan = mapPlanRow(['1', 'Vaso', '3', 'PLA rosa', '2', '30', '5', '28/09/2026 10:00', '28/09/2026 12:35', '2:35', 'Imprimindo', '5', 'Troca de filamento'], 5)

    expect(plan).toMatchObject({ piece: 'Vaso', quantity: 3, details: 'PLA rosa', hours: 2, status: 'Imprimindo', pauseDuring: 5, occurrence: 'Troca de filamento' })
  })
})

describe('createPlanningRepository', () => {
  const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response

  it('consulta o planejamento na planilha dedicada', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ values: [] }))

    await createPlanningRepository('token').getPlans()

    expect(String(fetchMock.mock.calls[0][0])).toContain('/1MxuTek5kmQlXgDerypCeJ8IkY2k-PWBtGMsWw8kOOl8/values/Planejamento!A5:M')
    fetchMock.mockRestore()
  })

  it('remove fisicamente apenas a linha selecionada', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ sheets: [{ properties: { sheetId: 42, title: 'Planejamento' } }] }))
      .mockResolvedValue(response({}))

    await createPlanningRepository('token').deletePlan(6)

    expect(fetchMock.mock.calls).toHaveLength(2)
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      requests: [{ deleteDimension: { range: { sheetId: 42, dimension: 'ROWS', startIndex: 5, endIndex: 6 } } }],
    })
    fetchMock.mockRestore()
  })

  it('insere uma nova impressão na posição cronológica sem usar append', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({
      values: [
        ['1', 'Peça atual', '1', '', '2', '10', '0', '28/09/2026 09:58', '28/09/2026 12:08', '2:10', 'Em impressão'],
        ['2', 'Próxima', '1', '', '1', '00', '0', '28/09/2026 13:00', '28/09/2026 14:00', '1:00', 'Planejado'],
      ],
    })).mockResolvedValueOnce(response({ sheets: [{ properties: { sheetId: 42, title: 'Planejamento' } }] }))
      .mockResolvedValue(response({}))

    const newPlan: PrintPlan = {
      order: '', piece: 'Nova peça', quantity: 1, details: 'PLA', hours: 1, minutes: 0, pause: 0,
      start: '28/09/2026 10:20', end: '', duration: '', status: 'Planejado', pauseDuring: 0, occurrence: '',
    }

    await createPlanningRepository('token').savePlan(newPlan)

    const calls = fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body || '{}')) }))
    expect(calls.some(call => call.url.includes('A:M:append'))).toBe(false)
    expect(calls).toContainEqual(expect.objectContaining({
      url: expect.stringContaining(':batchUpdate'),
      body: expect.objectContaining({ requests: expect.arrayContaining([{ insertDimension: { range: { sheetId: 42, dimension: 'ROWS', startIndex: 5, endIndex: 6 } } }]) }),
    }))
    expect(calls).toContainEqual(expect.objectContaining({
      url: expect.stringContaining('values:batchUpdate'),
      body: expect.objectContaining({ data: expect.arrayContaining([
        expect.objectContaining({ range: 'Planejamento!A6:H6', values: [['2', 'Nova peça', 1, 'PLA', 1, 0, 0, '28/09/2026 12:08']] }),
      ]) }),
    }))

    fetchMock.mockRestore()
  })
})
