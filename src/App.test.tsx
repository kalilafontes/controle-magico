import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { filterAndSortQuotes, getQuoteWorkspaceClass, getSaveMessage, LoginScreen, MoneyInput, Navigation, QuoteEditor, QuoteItemsEditor, QuoteList, QuoteSummary } from './App'
import type { Quote, QuoteItem } from './domain/quote'

afterEach(() => cleanup())

function EditorHarness() {
  const [items, setItems] = useState<QuoteItem[]>([{ id: 'base', description: 'Base', quantity: 2, unitPrice: 25 }])
  return <QuoteItemsEditor items={items} onChange={setItems} />
}

function MoneyHarness() {
  const [value, setValue] = useState(0)
  return <><MoneyInput label="Desconto" value={value} onChange={setValue} /><output>{value}</output></>
}

function ShareEditorHarness({ items = [{ id: 'item-1', description: 'Vaso', quantity: 1, unitPrice: 35 }] }: { items?: QuoteItem[] }) {
  const [quote, setQuote] = useState<Quote>({
    id: 'orc-1', createdAt: '', updatedAt: '', client: 'Ana', phone: '', status: 'Rascunho', validUntil: '2026-10-15',
    items, discount: 0, receivedAmount: 0, deliveryDate: '', notes: '',
  })
  return <QuoteEditor draft={quote} onChange={setQuote} onSave={() => undefined} onCancel={() => undefined} />
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

describe('QuoteEditor', () => {
  it('abre o compartilhamento padrão sem mudar o status do orçamento', async () => {
    const user = userEvent.setup()
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    render(<ShareEditorHarness />)

    await user.click(screen.getByRole('button', { name: 'Compartilhar orçamento' }))

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Orçamento', text: expect.stringContaining('Total: R$ 35,00') }))
    expect(screen.getByLabelText('Status')).toHaveValue('Rascunho')
  })

  it('impede o compartilhamento de um orçamento sem produtos válidos', async () => {
    const user = userEvent.setup()
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    render(<ShareEditorHarness items={[{ id: 'item-1', description: '', quantity: 1, unitPrice: 0 }]} />)

    await user.click(screen.getByRole('button', { name: 'Compartilhar orçamento' }))

    expect(share).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Adicione pelo menos um produto válido antes de compartilhar.')
  })
})

describe('getSaveMessage', () => {
  it('mostra o motivo devolvido pela planilha ao salvar', () => {
    expect(getSaveMessage(new Error('Unable to parse range: Itens do Orçamento!A:E'))).toBe('Não foi possível salvar: Unable to parse range: Itens do Orçamento!A:E')
  })
})

describe('QuoteList', () => {
  it('filtra por status e pagamento, priorizando pagos aguardando produção', () => {
    const quotes = [
      { id: '1', client: 'Não pago', status: 'Aguardando produção', total: 100, receivedAmount: 0 },
      { id: '2', client: 'Prioridade', status: 'Aguardando produção', total: 100, receivedAmount: 100 },
      { id: '3', client: 'Pago entregue', status: 'Entregue', total: 100, receivedAmount: 100 },
    ] as Quote[]

    expect(filterAndSortQuotes(quotes, 'Todos', 'Todos').map(quote => quote.client)).toEqual(['Prioridade', 'Não pago', 'Pago entregue'])
    expect(filterAndSortQuotes(quotes, 'Aguardando produção', 'Pago').map(quote => quote.client)).toEqual(['Prioridade'])
  })

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

describe('LoginScreen', () => {
  it('apresenta o acesso Google e a ilustração da impressora', () => {
    render(<LoginScreen onLogin={() => undefined} message="" />)

    expect(screen.getByRole('heading', { name: /Controle simples,.*onde você estiver\./ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Impressora e documentos' })).toBeInTheDocument()
  })

  it('usa uma ilustração própria na composição de celular', () => {
    const { container } = render(<LoginScreen onLogin={() => undefined} message="" />)

    expect(container.querySelector('picture.login-illustration source[media="(max-width: 899px)"]')).toBeInTheDocument()
    expect(container.querySelector('.login-hint-mobile')).toHaveTextContent('Seus dados ficam seguros com o Google.')
  })
})
