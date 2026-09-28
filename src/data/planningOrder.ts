type SchedulablePlan = { row?: number; start: string; order: string }

const startValue = (value: string) => {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  if (!match) return Number.POSITIVE_INFINITY
  const [, day, month, year, hour, minute] = match
  return new Date(+year, +month - 1, +day, +hour, +minute).getTime()
}

export const assignPlanningOrder = <T extends SchedulablePlan>(plans: T[]) => {
  const scheduled = [...plans].filter(plan => startValue(plan.start) !== Number.POSITIVE_INFINITY).sort((a, b) => startValue(a.start) - startValue(b.start))
  const unscheduled = plans.filter(plan => startValue(plan.start) === Number.POSITIVE_INFINITY)
  return [...scheduled.map((plan, index) => ({ ...plan, order: String(index + 1) })), ...unscheduled.map(plan => ({ ...plan, order: '' }))]
}
