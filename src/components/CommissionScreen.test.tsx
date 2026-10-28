import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommissionScreen } from './CommissionScreen'
import type { Quote } from '../domain/quote'

const quote: Quote = { id: 'orc-1', createdAt: '', updatedAt: '', client: 'Kalila', phone: '', status: 'Aprovado', validUntil: '', items: [{ id: 'item-1', description: 'Vaso', quantity: 2, unitPrice: 30 }], discount: 0, receivedAmount: 0, deliveryDate: '', notes: '' }
const entry = { id: 'com-1', quoteId: 'orc-1', client: 'Kalila', itemId: 'item-1', itemDescription: 'Vaso', quantity: 2, saleUnitPrice: 30, baseUnitPrice: 12, saleTotal: 60, costTotal: 24, profit: 12, commission: 20.4, status: 'Não pago' as const, createdAt: '' }
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response

describe('CommissionScreen', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('usa o preço do item do orçamento e mostra a comissão a pagar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: [entry] }))
    render(<CommissionScreen quotes={[quote]} appsScriptUrl="https://script/exec" token="sessão" onSessionExpired={() => undefined} />)

    await waitFor(() => expect(screen.getByText('A pagar: R$ 20,40')).toBeInTheDocument())
    expect(screen.getByLabelText('Valor de venda unitário')).toHaveValue(30)
    expect(screen.getByLabelText('Custo-base unitário')).toBeInTheDocument()
  })

  it('seleciona o primeiro item quando os orçamentos terminam de carregar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: [] }))
    const { rerender } = render(<CommissionScreen quotes={[]} appsScriptUrl="https://script/exec" token="sessão" onSessionExpired={() => undefined} />)

    rerender(<CommissionScreen quotes={[quote]} appsScriptUrl="https://script/exec" token="sessão" onSessionExpired={() => undefined} />)

    expect(screen.getByLabelText('Valor de venda unitário')).toHaveValue(30)
  })

  it('não oferece orçamentos entregues para adicionar comissão', () => {
    render(<CommissionScreen quotes={[quote, { ...quote, id: 'orc-2', client: 'Pedido entregue', status: 'Entregue' }]} appsScriptUrl="https://script/exec" token="sessão" onSessionExpired={() => undefined} />)

    expect(screen.getByRole('option', { name: 'Kalila' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Pedido entregue' })).not.toBeInTheDocument()
  })

  it('pede confirmação antes de apagar uma comissão', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: [entry] }))
    render(<CommissionScreen quotes={[quote]} appsScriptUrl="https://script/exec" token="sessão" onSessionExpired={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Apagar comissão de Kalila' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Apagar comissão de Kalila?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mostra as comissões pendentes antes das pagas e oferece marcá-las como pagas', async () => {
    const paidEntry = { ...entry, id: 'com-2', itemDescription: 'Peça paga', status: 'Pago' as const }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: [paidEntry, entry] }))
    render(<CommissionScreen quotes={[quote]} appsScriptUrl="https://script/exec" token="sessão" onSessionExpired={() => undefined} />)

    const cards = await screen.findAllByRole('article')
    expect(cards[0]).toHaveTextContent('Vaso')
    expect(cards[1]).toHaveTextContent('Peça paga')
    expect(screen.getByRole('button', { name: 'Marcar como pago' })).toBeInTheDocument()
  })

  it('mostra o carregamento enquanto apaga uma comissão', async () => {
    let finishDeletion: ((value: Response) => void) | undefined
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ ok: true, data: [entry] }))
      .mockImplementationOnce(() => new Promise(resolve => { finishDeletion = resolve }))
    render(<CommissionScreen quotes={[quote]} appsScriptUrl="https://script/exec" token="sessão" onSessionExpired={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Apagar comissão de Kalila' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apagar' }))

    expect(screen.getByRole('button', { name: 'Apagando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    finishDeletion?.(response({ ok: true, data: true }))
  })
})
