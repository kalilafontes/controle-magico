import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getPlans = vi.fn().mockResolvedValue([])
const savePlan = vi.fn().mockResolvedValue(undefined)
const deletePlan = vi.fn().mockResolvedValue(undefined)
const synchronizeSchedule = vi.fn().mockResolvedValue(false)

vi.mock('../data/planningRepository', () => ({
  createPlanningRepository: () => ({ getPlans, savePlan, deletePlan, synchronizeSchedule }),
}))

import { getPlanEndLabel, getPlanStatusClass, getPlanningWorkspaceClass, PlanningScreen, sortPlansForDesktop, sortPlansForTab } from './PlanningScreen'

describe('PlanningScreen', () => {
  const planned = { row: 6, order: '1', piece: 'Dumplin', quantity: 1, details: '', hours: 1, minutes: 0, pause: 0, start: '28/09/2026 10:00', end: '', duration: '', status: 'Planejado', pauseDuring: 0, occurrence: '' }

  beforeEach(() => {
    getPlans.mockReset()
    getPlans.mockResolvedValue([])
    savePlan.mockClear()
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

  it('permite arrastar apenas cartões planejados', async () => {
    getPlans.mockResolvedValue([planned, { ...planned, row: 7, piece: 'Em andamento', status: 'Em impressão' }])
    render(<PlanningScreen token="token" onBack={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Próximas' }))

    expect(screen.getByRole('button', { name: /Início: 28\/09\/2026 10:00/ })).toHaveAttribute('draggable', 'true')
    expect(screen.getByRole('button', { name: /IMPRIMINDO AGORA/ })).not.toHaveAttribute('draggable', 'true')
  })

  it('abre os detalhes em uma tela móvel separada', async () => {
    getPlans.mockResolvedValue([planned])
    render(<PlanningScreen token="token" onBack={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Próximas' }))
    fireEvent.click(screen.getByRole('button', { name: /Início: 28\/09\/2026 10:00/ }))

    expect(screen.getByRole('button', { name: '← Voltar para planejamentos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Início: 28\/09\/2026 10:00/ })).not.toBeInTheDocument()
  })

  it('salva a nova ordem quando um planejamento é solto depois de outro', async () => {
    const first = { ...planned, start: '29/09/2026 10:00' }
    const second = { ...planned, row: 7, piece: 'Segundo', start: '29/09/2026 11:00' }
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    getPlans.mockResolvedValue([first, second])
    render(<PlanningScreen token="token" onBack={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Próximas' }))
    synchronizeSchedule.mockClear()
    fireEvent.dragStart(screen.getByRole('button', { name: /Início: 29\/09\/2026 11:00/ }), { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '7')
    const target = screen.getByRole('button', { name: /Início: 29\/09\/2026 10:00/ })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })

    await waitFor(() => expect(synchronizeSchedule).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ row: 6, start: '29/09/2026 11:00' }),
      expect.objectContaining({ row: 7, start: '29/09/2026 10:00' }),
    ]), expect.arrayContaining([
      expect.objectContaining({ row: 6, start: '29/09/2026 10:00' }),
      expect.objectContaining({ row: 7, start: '29/09/2026 11:00' }),
    ])))
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

  it('conclui a impressão pelo botão de confirmação da lista', async () => {
    getPlans.mockResolvedValue([planned])
    render(<PlanningScreen token="token" onBack={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Próximas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir Dumplin' }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledWith(expect.objectContaining({
      row: 6,
      piece: 'Dumplin',
      status: 'Concluído',
    })))
  })

  it('expande a lista no desktop quando não há planejamento selecionado', () => {
    expect(getPlanningWorkspaceClass(false)).toBe('planning-workspace')
    expect(getPlanningWorkspaceClass(true)).toBe('planning-workspace has-selection')
  })

  it('não envolve a lista em um painel com título próprio', async () => {
    render(<PlanningScreen token="token" onBack={vi.fn()} />)

    await screen.findByRole('button', { name: '＋ Nova impressão' })
    expect(screen.queryByRole('heading', { name: 'Planejamentos' })).not.toBeInTheDocument()
  })

  it('ordena a lista ampla por impressão, planejado, pausado e concluído', () => {
    const plans = [
      { row: 5, piece: 'Concluído', start: '28/09/2026 10:00', status: 'Concluído' },
      { row: 6, piece: 'Pausado', start: '28/09/2026 09:00', status: 'Pausado' },
      { row: 7, piece: 'Planejado', start: '28/09/2026 08:00', status: 'Planejado' },
      { row: 8, piece: 'Imprimindo', start: '28/09/2026 07:00', status: 'Imprimindo' },
    ] as never[]

    expect(sortPlansForDesktop(plans).map(plan => plan.piece)).toEqual(['Imprimindo', 'Planejado', 'Pausado', 'Concluído'])
  })

  it('mostra os concluídos mais recentes primeiro na lista ampla', () => {
    const plans = [
      { row: 5, piece: 'Concluído antigo', start: '28/09/2026 08:00', end: '28/09/2026 10:00', status: 'Concluído' },
      { row: 6, piece: 'Concluído recente', start: '28/09/2026 12:00', end: '28/09/2026 15:00', status: 'Concluído' },
    ] as never[]

    expect(sortPlansForDesktop(plans).map(plan => plan.piece)).toEqual(['Concluído recente', 'Concluído antigo'])
  })

  it('atribui uma classe de tag para cada status de produção', () => {
    expect(getPlanStatusClass('Em impressão')).toBe('em-impressao')
    expect(getPlanStatusClass('Planejado')).toBe('planejado')
    expect(getPlanStatusClass('Pausado')).toBe('pausado')
    expect(getPlanStatusClass('Concluído')).toBe('concluido')
    expect(getPlanStatusClass('Cancelado')).toBe('cancelado')
  })

  it('mostra a previsão calculada quando o fim salvo é anterior ao início', () => {
    const plan = { start: '28/09/2026 19:20', end: '28/09/2026 17:30', hours: 2, minutes: 55, pause: 45, pauseDuring: 0 } as never

    expect(getPlanEndLabel(plan)).toBe('28/09/2026 22:15')
  })

  it('calcula a previsão de um planejamento mesmo quando a planilha tem outro fim', () => {
    const plan = { start: '29/09/2026 07:30', end: '29/09/2026 09:00', hours: 2, minutes: 55, pause: 45, pauseDuring: 0, status: 'Planejado' } as never

    expect(getPlanEndLabel(plan)).toBe('29/09/2026 10:25')
  })

  it('duplica o planejamento a partir do fim original respeitando a pausa antes', async () => {
    getPlans.mockResolvedValue([{ ...planned, pause: 15, pauseDuring: 5 }])
    render(<PlanningScreen token="token" onBack={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Próximas' }))
    const duplicateButton = screen.getByRole('button', { name: 'Duplicar Dumplin' })
    expect(duplicateButton).toHaveAttribute('aria-label', 'Duplicar Dumplin')
    expect(duplicateButton.querySelector('svg')).not.toBeNull()
    fireEvent.click(duplicateButton)

    expect(screen.getByLabelText('Início')).toHaveValue('28/09/2026 11:20')
    expect(screen.getByLabelText('Status')).toHaveValue('Planejado')
    expect(screen.getByLabelText('Peça / lote')).toHaveValue('Dumplin')
  })
})
