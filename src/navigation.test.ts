import { describe, expect, it } from 'vitest'
import { getSavedScreen, saveScreen } from './navigation'

describe('navigation', () => {
  it('restaura a última tela selecionada', () => {
    saveScreen('home')
    expect(getSavedScreen()).toBe('home')
  })
})
