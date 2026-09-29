import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareText } from './share'

describe('shareText', () => {
  afterEach(() => vi.restoreAllMocks())

  it('abre o menu nativo de compartilhamento quando o navegador oferece suporte', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })

    await shareText('Orçamento de teste')

    expect(share).toHaveBeenCalledWith({ title: 'Orçamento', text: 'Orçamento de teste' })
  })

  it('copia o texto quando o menu nativo não está disponível', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    await shareText('Orçamento de teste')

    expect(writeText).toHaveBeenCalledWith('Orçamento de teste')
  })

  it('copia o texto quando o menu nativo falha', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockRejectedValue(new Error('Indisponível')) })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    await expect(shareText('Orçamento de teste')).resolves.toBe('copied')

    expect(writeText).toHaveBeenCalledWith('Orçamento de teste')
  })
})
