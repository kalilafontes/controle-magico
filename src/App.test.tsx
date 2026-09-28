import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MoneyInput, QuoteItemsEditor, QuoteSummary } from './App'
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
