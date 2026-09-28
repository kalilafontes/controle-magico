import { assignPlanningOrder } from './planningOrder'
import { makeSequentialSchedule } from './planningSchedule'

export interface PrintPlan { row?: number; order: string; piece: string; quantity: number; details: string; hours: number; minutes: number; pause: number; start: string; end: string; duration: string; status: string; pauseDuring: number; occurrence: string }

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
  const id = '1MxuTek5kmQlXgDerypCeJ8IkY2k-PWBtGMsWw8kOOl8'
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  }
  const getPlans = async (): Promise<PrintPlan[]> => {
    const data = await request('/values/Planejamento!A5:M')
    return (data.values || []).map((row: string[], index: number) => mapPlanRow(row, index + 5))
  }
  const savePlan = async (plan: PrintPlan) => {
    const values = [[plan.order, plan.piece, plan.quantity, plan.details, plan.hours, plan.minutes, plan.pause, plan.start, plan.end, plan.duration, plan.status, plan.pauseDuring, plan.occurrence]]
    const path = plan.row ? `/values/Planejamento!A${plan.row}:M${plan.row}?valueInputOption=USER_ENTERED` : '/values/Planejamento!A:M:append?valueInputOption=USER_ENTERED'
    await request(path, { method: plan.row ? 'PUT' : 'POST', body: JSON.stringify({ values }) })
  }
  const synchronizeSchedule = async (plans: PrintPlan[]) => {
    const ordered = assignPlanningOrder(makeSequentialSchedule(plans))
    const data = ordered.filter(plan => plan.row).flatMap(plan => [
      { range: `Planejamento!A${plan.row}`, values: [[plan.order]] },
      { range: `Planejamento!H${plan.row}:I${plan.row}`, values: [[plan.start, plan.end]] },
    ])
    if (data.length) await request('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) })
  }
  return { getPlans, savePlan, synchronizeSchedule }
}
