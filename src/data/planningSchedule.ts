type SchedulablePlan = { start: string; end: string; hours: number; minutes: number; pause: number; pauseDuring: number }

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

export const makeSequentialSchedule = <T extends SchedulablePlan>(plans: T[]) => {
  const scheduled = plans.filter(plan => parseStart(plan.start)).sort((a, b) => parseStart(a.start)!.getTime() - parseStart(b.start)!.getTime())
  const unscheduled = plans.filter(plan => !parseStart(plan.start))
  let previousEnd: Date | null = null
  const adjusted = scheduled.map(plan => {
    const requestedStart = parseStart(plan.start)!
    const start = previousEnd && requestedStart < previousEnd ? previousEnd : requestedStart
    const end = new Date(start.getTime() + (plan.hours * 60 + plan.minutes + plan.pause + plan.pauseDuring) * 60000)
    previousEnd = end
    return { ...plan, start: format(start), end: format(end) }
  })
  return [...adjusted, ...unscheduled]
}
