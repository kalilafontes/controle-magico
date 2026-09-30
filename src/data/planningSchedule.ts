type SchedulablePlan = { start: string; end: string; hours: number; minutes: number; pause: number; pauseDuring: number; status?: string; printer?: string }
type ReorderablePlan = { row?: number; start: string; status?: string }

const isRunning = (status = '') => ['em impressão', 'imprimindo', 'em andamento'].includes(status.trim().toLowerCase())
const isPlanned = (status = '') => !status.trim() || status.trim().toLowerCase() === 'planejado'

const parseStart = (value: string) => {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  if (match) {
    const [, day, month, year, hour, minute] = match
    return new Date(+year, +month - 1, +day, +hour, +minute)
  }
  const time = value.match(/^(\d{2}):(\d{2})$/)
  if (!time) return null
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), +time[1], +time[2])
}

const format = (date: Date) => date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')

const endFor = (plan: SchedulablePlan, start: Date) => new Date(start.getTime() + (plan.hours * 60 + plan.minutes + plan.pauseDuring) * 60000)

export const makeSequentialSchedule = <T extends SchedulablePlan>(plans: T[], now = new Date()) => {
  const byPrinter = new Map<string, T[]>()
  plans.forEach(plan => {
    const printer = plan.printer || 'Bambu A1'
    byPrinter.set(printer, [...(byPrinter.get(printer) || []), plan])
  })
  return [...byPrinter.values()].flatMap(printerPlans => {
    const scheduled = printerPlans.filter(plan => parseStart(plan.start)).sort((a, b) => {
      const runningDifference = Number(isRunning(b.status)) - Number(isRunning(a.status))
      if (runningDifference) return runningDifference
      return parseStart(a.start)!.getTime() - parseStart(b.start)!.getTime()
    })
    const unscheduled = printerPlans.filter(plan => !parseStart(plan.start))
    const queued = [...scheduled, ...unscheduled.filter(plan => isPlanned(plan.status))]
    const unchanged = unscheduled.filter(plan => !isPlanned(plan.status))
    let previousEnd: Date | null = null
    const adjusted = queued.map(plan => {
      const requestedStart = parseStart(plan.start)
      if (isRunning(plan.status)) {
        if (!requestedStart) return { ...plan }
        previousEnd = parseStart(plan.end) || endFor(plan, requestedStart)
        return { ...plan }
      }
      if (!isPlanned(plan.status)) return { ...plan }
      const availableAt = previousEnd && new Date(previousEnd.getTime() + plan.pause * 60000)
      const start = availableAt || new Date(Math.max(requestedStart?.getTime() ?? Number.NEGATIVE_INFINITY, now.getTime()))
      const end = endFor(plan, start)
      previousEnd = end
      return { ...plan, start: format(start), end: format(end) }
    })
    return [...adjusted, ...unchanged]
  })
}

export const reorderPlannedStarts = <T extends ReorderablePlan>(plans: T[], draggedRow: number, targetRow: number, placement: 'before' | 'after') => {
  const planned = plans.filter(plan => isPlanned(plan.status)).sort((a, b) => (parseStart(a.start)?.getTime() ?? Number.POSITIVE_INFINITY) - (parseStart(b.start)?.getTime() ?? Number.POSITIVE_INFINITY))
  const draggedIndex = planned.findIndex(plan => plan.row === draggedRow)
  const targetIndex = planned.findIndex(plan => plan.row === targetRow)
  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return plans

  const reordered = [...planned]
  const [dragged] = reordered.splice(draggedIndex, 1)
  let insertionIndex = targetIndex + (placement === 'after' ? 1 : 0)
  if (draggedIndex < insertionIndex) insertionIndex -= 1
  reordered.splice(insertionIndex, 0, dragged)

  const startByRow = new Map(reordered.map((plan, index) => [plan.row, planned[index].start]))
  return plans.map(plan => startByRow.has(plan.row) ? { ...plan, start: startByRow.get(plan.row)! } : plan)
}
