import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getPlans = vi.fn().mockResolvedValue([])
const deletePlan = vi.fn().mockResolvedValue(undefined)
const synchronizeSchedule = vi.fn().mockResolvedValue(false)

vi.mock('../data/planningRepository', () => ({
  createPlanningRepository: () => ({ getPlans, savePlan: vi.fn(), deletePlan, synchronizeSchedule }),
}))

import { PlanningScreen, sortPlansForTab } from './PlanningScreen'

describe('PlanningScreen', () => {
  const planned = { row: 6, order: '1', piece: 'Dumplin', quantity: 1, details: '', hours: 1, minutes: 0, pause: 0, start: '28/09/2026 10:00', end: '', duration: '', status: 'Planejado', pauseDuring: 0, occurrence: '' }

  beforeEach(() => {
    getPlans.mockReset()
    getPlans.mockResolvedValue([])
    deletePlan.mockClear()
    synchronizeSchedule.mockClear()
  })
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

  it('encerra a sessão quando o planejamento retorna 401', async () => {
    getPlans.mockRejectedValue(Object.assign(new Error('token expirado'), { status: 401 }))
    const onSessionExpired = vi.fn()

    render(<PlanningScreen token="token" onBack={vi.fn()} onSessionExpired={onSessionExpired} />)

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledOnce())
    expect(screen.queryByText(/token expirado/)).not.toBeInTheDocument()
  })

  it('cancela a exclusão aberta pela lixeira da lista', async () => {
    getPlans.mockResolvedValue([planned])
    render(<PlanningScreen token="token" onBack={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Próximas' }))
    const trash = await screen.findByRole('button', { name: 'Apagar Dumplin' })
    expect(trash.querySelector('svg')).not.toBeNull()
    fireEvent.click(trash)
    expect(screen.getByRole('dialog')).toHaveTextContent('Apagar Dumplin?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(deletePlan).not.toHaveBeenCalled()
  })

  it('apaga após confirmar o diálogo aberto pela lixeira da lista', async () => {
    getPlans.mockResolvedValue([planned])
    render(<PlanningScreen token="token" onBack={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Próximas' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar Dumplin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apagar' }))

    await waitFor(() => expect(deletePlan).toHaveBeenCalledWith(6))
  })
})
