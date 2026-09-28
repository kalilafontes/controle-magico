const parseDateTime = (value: string) => {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/) 
  if (match) {
    const [, day, month, year, hour = '00', minute = '00'] = match
    return new Date(+year, +month - 1, +day, +hour, +minute)
  }
  const time = value.match(/^(\d{2}):(\d{2})$/)
  if (!time) return null
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), +time[1], +time[2])
}

const remainingLabel = (minutes: number) => `~ ${Math.floor(minutes / 60)}h ${Math.max(0, Math.round(minutes % 60))}min`

export const getPrintProgress = (start: string, end: string, now = new Date(), hours = 0, minutes = 0, pause = 0, pauseDuring = 0) => {
  const startAt = parseDateTime(start)
  const endAt = parseDateTime(end) || (startAt ? new Date(startAt.getTime() + (hours * 60 + minutes + pause + pauseDuring) * 60000) : null)
  if (!startAt || !endAt || endAt <= startAt) return { percent: 0, remaining: 'Aguardando início' }
  const total = endAt.getTime() - startAt.getTime()
  const elapsed = now.getTime() - startAt.getTime()
  const percent = Math.max(0, Math.min(100, Math.round(elapsed / total * 100)))
  return { percent, remaining: remainingLabel(Math.max(0, (endAt.getTime() - now.getTime()) / 60000)) }
}
