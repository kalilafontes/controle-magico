import { describe, expect, it, vi } from 'vitest'
import { createPlanningRepository, findFormulaSourceRow, getEndFormula, mapPlanRow, type PrintPlan } from './planningRepository'

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

  it('preserva o status 401 quando o token expira', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401, text: async () => 'token expirado' } as Response)

    await expect(createPlanningRepository('token').getPlans()).rejects.toMatchObject({ status: 401 })

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
    const plans = [
      ['1', 'Peça atual', '1', '', '2', '10', '0', '28/09/2026 09:58', '28/09/2026 12:08', '2:10', 'Em impressão'],
      ['2', 'Próxima', '1', '', '1', '00', '0', '28/09/2026 13:00', '28/09/2026 14:00', '1:00', 'Planejado'],
    ]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input)
      if (url.includes('/values/Planejamento!A5:M')) return response({ values: plans })
      if (url.includes('includeGridData=true')) return response({ sheets: [{ data: [{ startRow: 4, rowData: [{ values: [{ userEnteredValue: { formulaValue: '=H5' } }, { userEnteredValue: { formulaValue: '=E5' } }] }] }] }] })
      if (url.includes('properties(sheetId,title)')) return response({ sheets: [{ properties: { sheetId: 42, title: 'Planejamento' } }] })
      return response({})
    })

    const newPlan: PrintPlan = {
      order: '', piece: 'Nova peça', quantity: 1, details: 'PLA', hours: 1, minutes: 0, pause: 0,
      start: '28/09/2026 10:20', end: '', duration: '', status: 'Planejado', pauseDuring: 0, occurrence: '',
    }

    await createPlanningRepository('token').savePlan(newPlan)

    const calls = fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body || '{}')) }))
    expect(calls.some(call => call.url.includes('A:M:append'))).toBe(false)
    expect(calls).toContainEqual(expect.objectContaining({
      url: expect.stringContaining(':batchUpdate'),
      body: expect.objectContaining({ requests: expect.arrayContaining([
        { insertDimension: { range: { sheetId: 42, dimension: 'ROWS', startIndex: 5, endIndex: 6 } } },
        { copyPaste: expect.objectContaining({ source: { sheetId: 42, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 8, endColumnIndex: 10 } }) },
      ]) }),
    }))
    expect(calls).toContainEqual(expect.objectContaining({
      url: expect.stringContaining('values:batchUpdate'),
      body: expect.objectContaining({ data: expect.arrayContaining([
        expect.objectContaining({ range: 'Planejamento!A6:H6', values: [['2', 'Nova peça', 1, 'PLA', 1, 0, 0, '28/09/2026 12:08']] }),
      ]) }),
    }))

    fetchMock.mockRestore()
  })

  it('localiza uma linha com fórmulas em fim e duração', () => {
    expect(findFormulaSourceRow({ sheets: [{ data: [{ startRow: 4, rowData: [
      { values: [{ userEnteredValue: { stringValue: '17:30' } }] },
      { values: [{ userEnteredValue: { formulaValue: '=H6' } }, { userEnteredValue: { formulaValue: '=E6' } }] },
    ] }] }] })).toBe(6)
  })

  it('gera a fórmula de fim sem incluir a pausa antes', () => {
    expect(getEndFormula(8)).toBe('=H8+E8/24+F8/1440+L8/1440')
  })

  it('corrige a fórmula de fim de um planejamento quando o valor salvo diverge da duração', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({}))
    const plan: PrintPlan = { row: 6, order: '1', piece: 'Tecla', quantity: 1, details: '', hours: 2, minutes: 55, pause: 45, start: '29/09/2026 07:30', end: '29/09/2026 09:00', duration: '', status: 'Planejado', pauseDuring: 0, occurrence: '' }

    await expect(createPlanningRepository('token').synchronizeSchedule([plan])).resolves.toBe(true)

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.data).toContainEqual({ range: 'Planejamento!I6', values: [['=H6+E6/24+F6/1440+L6/1440']] })
    fetchMock.mockRestore()
  })
})
