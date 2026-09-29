import { assignPlanningOrder } from './planningOrder'
import { makeSequentialSchedule } from './planningSchedule'

export interface PrintPlan { row?: number; order: string; piece: string; quantity: number; details: string; hours: number; minutes: number; pause: number; start: string; end: string; duration: string; status: string; pauseDuring: number; occurrence: string }
export const getEndFormula = (row: number) => `=H${row}+E${row}/24+F${row}/1440+L${row}/1440`

type FormulaGrid = { startRow?: number; rowData?: { values?: { userEnteredValue?: { formulaValue?: string } }[] }[] }
type FormulaSheetResponse = { sheets?: { data?: FormulaGrid[] }[] }

export const findFormulaSourceRow = (data: unknown) => {
  const grids = (data as FormulaSheetResponse).sheets?.flatMap(sheet => sheet.data || []) || []
  for (const grid of grids) {
    const rowIndex = grid.rowData?.findIndex(row => (row.values?.filter(value => value.userEnteredValue?.formulaValue).length || 0) >= 2) ?? -1
    if (rowIndex >= 0) return (grid.startRow || 0) + rowIndex + 1
  }
  return null
}

export const mapPlanRow = (row: string[], sheetRow: number): PrintPlan => ({
  row: sheetRow,
  order: row[0] || '',
  piece: row[1] || '',
  quantity: Number(row[2] || 1),
  details: row[3] || '',
  hours: Number(row[4] || 0),
  minutes: Number(row[5] || 0),
  pause: Number(row[6] || 0),
  start: row[7] || '',
  end: row[8] || '',
  duration: row[9] || '',
  status: row[10] || 'Planejado',
  pauseDuring: Number(row[11] || 0),
  occurrence: row[12] || '',
})

export function createPlanningRepository(token: string) {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/1MxuTek5kmQlXgDerypCeJ8IkY2k-PWBtGMsWw8kOOl8'
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    if (!response.ok) throw Object.assign(new Error(await response.text()), { status: response.status })
    return response.json()
  }
  const getPlans = async (): Promise<PrintPlan[]> => {
    const data = await request('/values/Planejamento!A5:M')
    return (data.values || []).map((row: string[], index: number) => mapPlanRow(row, index + 5))
  }

  const getPlanningSheetId = async () => {
    const data = await request('/?fields=sheets(properties(sheetId,title))')
    const sheet = data.sheets?.find((item: { properties: { title: string } }) => item.properties.title === 'Planejamento')
    if (!sheet) throw new Error('A aba Planejamento não foi encontrada.')
    return sheet.properties.sheetId as number
  }
  const getFormulaSourceRow = async () => findFormulaSourceRow(await request('/?includeGridData=true&ranges=Planejamento!I5:J&fields=sheets(data(startRow,rowData(values(userEnteredValue))))'))

  const writePlanInputs = async (plan: PrintPlan) => {
    const endFormula = plan.status.trim().toLowerCase() === 'planejado' ? [{ range: `Planejamento!I${plan.row}`, values: [[getEndFormula(plan.row!)]] }] : []
    await request('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `Planejamento!A${plan.row}:H${plan.row}`, values: [[plan.order, plan.piece, plan.quantity, plan.details, plan.hours, plan.minutes, plan.pause, plan.start]] },
          ...endFormula,
          { range: `Planejamento!K${plan.row}:M${plan.row}`, values: [[plan.status, plan.pauseDuring, plan.occurrence]] },
        ],
      }),
    })
  }

  const savePlan = async (plan: PrintPlan) => {
    if (plan.row) return writePlanInputs(plan)

    const current = await getPlans()
    const ordered = assignPlanningOrder(makeSequentialSchedule([...current, plan]))
    const inserted = ordered.find(item => !item.row)
    if (!inserted) throw new Error('Não foi possível preparar a nova impressão.')

    const insertAt = ordered.find((item, index) => index > ordered.indexOf(inserted) && item.row)?.row || (current.at(-1)?.row || 4) + 1
    const [sheetId, originalFormulaSourceRow] = await Promise.all([getPlanningSheetId(), getFormulaSourceRow()])
    const formulaSourceRow = originalFormulaSourceRow && originalFormulaSourceRow >= insertAt ? originalFormulaSourceRow + 1 : originalFormulaSourceRow
    const requests: object[] = [{ insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: insertAt - 1, endIndex: insertAt } } }]
    if (formulaSourceRow) {
      requests.push({ copyPaste: {
        source: { sheetId, startRowIndex: formulaSourceRow - 1, endRowIndex: formulaSourceRow, startColumnIndex: 8, endColumnIndex: 10 },
        destination: { sheetId, startRowIndex: insertAt - 1, endRowIndex: insertAt, startColumnIndex: 8, endColumnIndex: 10 },
        pasteType: 'PASTE_FORMULA', pasteOrientation: 'NORMAL',
      } })
    }
    await request('/:batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) })

    const insertedWithRow = { ...inserted, row: insertAt }
    await writePlanInputs(insertedWithRow)

    const originalByRow = new Map(current.map(item => [item.row, item]))
    const data = ordered.flatMap(item => {
      if (!item.row || item.status.trim().toLowerCase() !== 'planejado') return []
      const original = originalByRow.get(item.row)
      if (!original) return []
      const row = item.row >= insertAt ? item.row + 1 : item.row
      const updates = []
      if (original.order !== item.order) updates.push({ range: `Planejamento!A${row}`, values: [[item.order]] })
      if (original.start !== item.start) updates.push({ range: `Planejamento!H${row}`, values: [[item.start]] })
      return updates
    })
    if (data.length) await request('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) })
  }
  const deletePlan = async (row: number) => {
    const sheetId = await getPlanningSheetId()
    await request('/:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }] }),
    })
  }
  const synchronizeSchedule = async (plans: PrintPlan[]) => {
    const ordered = assignPlanningOrder(makeSequentialSchedule(plans))
    const originalByRow = new Map(plans.map(plan => [plan.row, plan]))
    const data = ordered.filter(plan => plan.row && plan.status === 'Planejado').flatMap(plan => {
      const row = plan.row
      if (!row) return []
      const original = originalByRow.get(row)
      const updates = []
      if (original?.order !== plan.order) updates.push({ range: `Planejamento!A${row}`, values: [[plan.order]] })
      if (original?.start !== plan.start) updates.push({ range: `Planejamento!H${row}`, values: [[plan.start]] })
      if (original?.end !== plan.end) updates.push({ range: `Planejamento!I${row}`, values: [[getEndFormula(row)]] })
      return updates
    })
    if (!data.length) return false
    await request('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) })
    return true
  }
  return { getPlans, savePlan, deletePlan, synchronizeSchedule }
}
