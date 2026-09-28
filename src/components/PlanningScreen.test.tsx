import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getPlans = vi.fn().mockResolvedValue([])

vi.mock('../data/planningRepository', () => ({
  createPlanningRepository: () => ({ getPlans, savePlan: vi.fn() }),
}))

import { PlanningScreen, sortPlansForTab } from './PlanningScreen'

describe('PlanningScreen', () => {
  beforeEach(() => getPlans.mockClear())
  afterEach(cleanup)

  it('mostra a nova previsão de término ao incluir uma pausa', async () => {
    render(<PlanningScreen token="token" onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Nova impressão' }))

    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '22/09/2026 23:00' } })
    fireEvent.change(screen.getByLabelText('Horas'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Pausa durante (min)'), { target: { value: '5' } })

    expect(screen.getByText(/Previsão de término:/)).toHaveTextContent('23/09/2026 01:05')
  })

  it('coloca os concluídos mais recentes primeiro', () => {
    const plans = [
      { row: 5, piece: 'Mais antigo', end: '22/09/2026 11:00', status: 'Concluído' },
      { row: 6, piece: 'Mais recente', end: '23/09/2026 08:00', status: 'Concluído' },
    ] as never[]

    expect(sortPlansForTab(plans, 'concluidas').map(plan => plan.piece)).toEqual(['Mais recente', 'Mais antigo'])
  })

  it('inclui o status Imprimindo na aba Em andamento', () => {
    const plans = [{ row: 5, piece: 'Caixinha', status: 'Imprimindo' }] as never[]

    expect(sortPlansForTab(plans, 'andamento').map(plan => plan.piece)).toEqual(['Caixinha'])
  })

  it('calcula o fim quando o início está só com horário', async () => {
    render(<PlanningScreen token="token" onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Nova impressão' }))

    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '09:58' } })
    fireEvent.change(screen.getByLabelText('Horas'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '10' } })

    expect(screen.getByText(/Previsão de término:/)).toHaveTextContent('12:08')
  })
})
