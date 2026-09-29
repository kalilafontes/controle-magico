import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getQuoteWorkspaceClass, getSaveMessage, MoneyInput, Navigation, QuoteItemsEditor, QuoteList, QuoteSummary } from './App'
import type { QuoteItem } from './domain/quote'

function EditorHarness() {
  const [items, setItems] = useState<QuoteItem[]>([{ id: 'base', description: 'Base', quantity: 2, unitPrice: 25 }])
  return <QuoteItemsEditor items={items} onChange={setItems} />
}

function MoneyHarness() {
  const [value, setValue] = useState(0)
  return <><MoneyInput label="Desconto" value={value} onChange={setValue} /><output>{value}</output></>
}

describe('QuoteItemsEditor', () => {
  it('adiciona e remove produtos, mostrando o subtotal em reais', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    expect(screen.getByText('Subtotal: R$ 50,00')).toBeInTheDocument()
    expect(screen.getByLabelText('Valor unitário de Base')).toHaveAttribute('type', 'text')

    await user.clear(screen.getByLabelText('Valor unitário de Base'))
    await user.type(screen.getByLabelText('Valor unitário de Base'), '30')
    await user.tab()
    expect(screen.getByText('Subtotal: R$ 60,00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Adicionar produto/ }))
    expect(screen.getAllByLabelText('Descrição do produto')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Remover produto Base' }))
    expect(screen.getAllByLabelText('Descrição do produto')).toHaveLength(1)
  })
})

describe('MoneyInput', () => {
  it('aceita digitação normal e formata o valor ao sair do campo', async () => {
    const user = userEvent.setup()
    render(<MoneyHarness />)

    const input = screen.getByLabelText('Desconto')
    await user.clear(input)
    await user.type(input, '25,50')
    expect(input).toHaveValue('25,50')
    await user.tab()

    expect(screen.getByRole('status')).toHaveTextContent('25.5')
    expect(input).toHaveValue('R$ 25,50')
  })
})

describe('QuoteSummary', () => {
  it('mostra subtotal, desconto e total de todos os produtos', () => {
    render(<QuoteSummary items={[
      { id: 'base', description: 'Base', quantity: 2, unitPrice: 25 },
      { id: 'tampa', description: 'Tampa', quantity: 1, unitPrice: 15 },
    ]} discount={10} />)

    expect(screen.getByText('Subtotal: R$ 65,00')).toBeInTheDocument()
    expect(screen.getByText('Desconto: R$ 10,00')).toBeInTheDocument()
    expect(screen.getByText('Total: R$ 55,00')).toBeInTheDocument()
  })
})

describe('getSaveMessage', () => {
  it('mostra o motivo devolvido pela planilha ao salvar', () => {
    expect(getSaveMessage(new Error('Unable to parse range: Itens do Orçamento!A:E'))).toBe('Não foi possível salvar: Unable to parse range: Itens do Orçamento!A:E')
  })
})

describe('QuoteList', () => {
  it('oferece uma lixeira separada para pedir a exclusão do orçamento', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const { container } = render(<QuoteList quotes={[{
      id: 'orc-1', createdAt: '', updatedAt: '', client: 'Kalila', phone: '', status: 'Rascunho', validUntil: '', items: [], discount: 0, total: 0, receivedAmount: 0, deliveryDate: '', notes: '',
    }]} onEdit={() => undefined} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Apagar orçamento de Kalila' }))
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'orc-1' }))
  })

  it('marca o orçamento selecionado na lista do painel', () => {
    const { container } = render(<QuoteList quotes={[{
      id: 'orc-1', createdAt: '', updatedAt: '', client: 'Kalila', phone: '', status: 'Rascunho', validUntil: '', items: [], discount: 0, total: 0, receivedAmount: 0, deliveryDate: '', notes: '',
    }]} onEdit={() => undefined} onDelete={() => undefined} selectedId="orc-1" />)

    expect(container.querySelector('.quote.home-quote')).toHaveAttribute('aria-current', 'true')
  })
})

describe('Navigation', () => {
  it('permite recolher a sidebar pelo botão de menu', async () => {
    const user = userEvent.setup()
    const onCollapsedChange = vi.fn()
    render(<Navigation screen="home" onNavigate={() => undefined} collapsed={false} onCollapsedChange={onCollapsedChange} />)

    await user.click(screen.getByRole('button', { name: 'Recolher menu' }))
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
  })
})

describe('getQuoteWorkspaceClass', () => {
  it('expande a lista quando nenhum orçamento está selecionado', () => {
    expect(getQuoteWorkspaceClass(false)).toBe('quotes-workspace')
    expect(getQuoteWorkspaceClass(true)).toBe('quotes-workspace has-selection')
  })
})
