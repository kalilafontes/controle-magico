import { describe, expect, it } from 'vitest'
import { getPrintProgress } from './printProgress'

describe('getPrintProgress', () => {
  it('calcula percentual e tempo restante entre início e término', () => {
    const progress = getPrintProgress('28/09/2026 10:00', '28/09/2026 12:00', new Date(2026, 8, 28, 11, 0))

    expect(progress).toEqual({ percent: 50, remaining: '~ 1h 0min' })
  })

  it('calcula o fim a partir da duração quando a planilha ainda não o preencheu', () => {
    const progress = getPrintProgress('28/09/2026 10:00', '', new Date(2026, 8, 28, 11, 0), 2, 10)

    expect(progress).toEqual({ percent: 46, remaining: '~ 1h 10min' })
  })

  it('ignora uma previsão anterior ao início e usa a duração da impressão', () => {
    const progress = getPrintProgress('28/09/2026 19:20', '28/09/2026 17:30', new Date(2026, 8, 28, 20, 20), 2, 45)

    expect(progress).toEqual({ percent: 36, remaining: '~ 1h 45min' })
  })
})
