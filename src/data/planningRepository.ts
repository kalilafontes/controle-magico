import { assignPlanningOrder } from './planningOrder'
import { makeSequentialSchedule } from './planningSchedule'
import { createAppsScriptClient } from './appsScriptClient'

export interface PrintPlan { row?: number; order: string; piece: string; quantity: number; details: string; hours: number; minutes: number; pause: number; start: string; end: string; duration: string; status: string; pauseDuring: number; occurrence: string; printer?: string }
export const getEndFormula = (row: number) => `=H${row}+E${row}/24+F${row}/1440+L${row}/1440`
type FormulaGrid = { startRow?: number; rowData?: { values?: { userEnteredValue?: { formulaValue?: string } }[] }[] }
type FormulaSheetResponse = { sheets?: { data?: FormulaGrid[] }[] }
export const findFormulaSourceRow = (data: unknown) => { const grids = (data as FormulaSheetResponse).sheets?.flatMap(sheet => sheet.data || []) || []; for (const grid of grids) { const rowIndex = grid.rowData?.findIndex(row => (row.values?.filter(value => value.userEnteredValue?.formulaValue).length || 0) >= 2) ?? -1; if (rowIndex >= 0) return (grid.startRow || 0) + rowIndex + 1 } return null }
export const mapPlanRow = (row: string[], sheetRow: number): PrintPlan => ({ row: sheetRow, order: row[0] || '', piece: row[1] || '', quantity: Number(row[2] || 1), details: row[3] || '', hours: Number(row[4] || 0), minutes: Number(row[5] || 0), pause: Number(row[6] || 0), start: row[7] || '', end: row[8] || '', duration: row[9] || '', status: row[10] || 'Planejado', pauseDuring: Number(row[11] || 0), occurrence: row[12] || '', printer: row[13] || 'Bambu A1' })

export function createPlanningRepository(appsScriptUrl: string, token: string) {
  const api = createAppsScriptClient(appsScriptUrl, () => token)
  const getPlans = () => api.request<PrintPlan[]>('plans.list')
  const synchronizeSchedule = async (plans: PrintPlan[], originalPlans: PrintPlan[] = plans) => {
    const ordered = assignPlanningOrder(makeSequentialSchedule(plans))
    const changed = ordered.some(plan => { const original = originalPlans.find(item => item.row === plan.row); return Boolean(plan.row && plan.status === 'Planejado' && (!original || original.order !== plan.order || original.start !== plan.start || original.end !== plan.end)) })
    if (!changed) return false
    await api.request<boolean>('plans.synchronize', { plans: ordered })
    return true
  }
  const savePlan = async (plan: PrintPlan) => {
    if (plan.row) return api.request<PrintPlan>('plans.save', { plan })
    const current = await getPlans()
    const ordered = assignPlanningOrder(makeSequentialSchedule([...current, plan]))
    const prepared = ordered.find(item => !item.row)
    if (!prepared) throw new Error('Não foi possível preparar a nova impressão.')
    const saved = await api.request<PrintPlan>('plans.save', { plan: prepared })
    await synchronizeSchedule(ordered.map(item => item === prepared ? saved : item), current)
    return saved
  }
  const deletePlan = (row: number) => api.request<boolean>('plans.delete', { row })
  return { getPlans, savePlan, deletePlan, synchronizeSchedule }
}
