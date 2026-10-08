import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { filterAndSortQuotes, getHomePlans, getHomeQuotes, getQuoteWorkspaceClass, getSaveMessage, LoginScreen, MoneyInput, Navigation, QuoteEditor, QuoteItemsEditor, QuoteList, QuoteSavingOverlay, QuoteSummary } from './App'
import type { Quote, QuoteItem } from './domain/quote'
import type { PrintPlan } from './data/planningRepository'

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

describe('QuoteSavingOverlay', () => {
  it('bloqueia a tela e informa que o orçamento está sendo salvo', () => {
    render(<QuoteSavingOverlay />)

    expect(screen.getByRole('status', { name: 'Salvando orçamento…' })).toBeInTheDocument()
  })
})

describe('QuoteEditor', () => {
  it('permite marcar um orçamento que já está em produção', () => {
    render(<ShareEditorHarness />)

    expect(screen.getByRole('option', { name: 'Em produção' })).toBeInTheDocument()
  })

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
  it('agrupa os pedidos pela prioridade de produção, entrega e pagamento', () => {
    const quotes = [
      { id: '1', client: 'Rafaela', status: 'Entregue', total: 35, receivedAmount: 35, deliveryDate: '2026-10-04' },
      { id: '2', client: 'Juliana', status: 'Aguardando aprovação', total: 260, receivedAmount: 0 },
      { id: '3', client: 'Gaby', status: 'Entregue', total: 75, receivedAmount: 75, deliveryDate: '2026-10-05' },
      { id: '4', client: 'Letícia', status: 'Rascunho', total: 75, receivedAmount: 0 },
      { id: '5', client: 'Em produção pago', status: 'Em produção', total: 100, receivedAmount: 100 },
      { id: '6', client: 'Entrega pendente', status: 'Entregue', total: 100, receivedAmount: 0 },
      { id: '7', client: 'Recusado pago', status: 'Recusado', total: 100, receivedAmount: 100 },
    ] as Quote[]

    expect(filterAndSortQuotes(quotes, 'Todos', 'Todos').map(quote => quote.client)).toEqual(['Em produção pago', 'Juliana', 'Letícia', 'Gaby', 'Rafaela', 'Entrega pendente', 'Recusado pago'])
    expect(filterAndSortQuotes(quotes, 'Em produção', 'Pago').map(quote => quote.client)).toEqual(['Em produção pago'])
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

describe('home', () => {
  it('mostra os orçamentos prioritários na mesma ordem da lista completa', () => {
    const quotes = [
      { id: '1', client: 'Entregue', status: 'Entregue', total: 50, receivedAmount: 50, deliveryDate: '2026-10-04' },
      { id: '2', client: 'Em produção', status: 'Em produção', total: 50, receivedAmount: 50 },
      { id: '3', client: 'Aguardando', status: 'Aguardando produção', total: 50, receivedAmount: 0 },
      { id: '4', client: 'Recusado', status: 'Recusado', total: 50, receivedAmount: 50 },
    ] as Quote[]

    expect(getHomeQuotes(quotes).map(quote => quote.client)).toEqual(['Em produção', 'Aguardando', 'Entregue'])
  })

  it('mostra a impressão ativa antes das próximas em ordem de início', () => {
    const plans = [
      { piece: 'Próxima tarde', status: 'Planejado', start: '08/10/2026 14:00' },
      { piece: 'Imprimindo', status: 'Em impressão', start: '08/10/2026 08:00' },
      { piece: 'Próxima manhã', status: 'Planejado', start: '08/10/2026 10:00' },
      { piece: 'Concluída', status: 'Concluído', start: '08/10/2026 06:00' },
    ] as PrintPlan[]

    expect(getHomePlans(plans).map(plan => plan.piece)).toEqual(['Imprimindo', 'Próxima manhã', 'Próxima tarde'])
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
  it('apresenta e envia credenciais para o login da planilha', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginScreen onLogin={onLogin} message="" />)

    expect(screen.getByRole('heading', { name: /Controle simples,.*onde você estiver\./ })).toBeInTheDocument()
    await user.type(screen.getByLabelText('E-mail'), 'kalila.fontes@gmail.com')
    await user.type(screen.getByLabelText('Senha'), 'magica1')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onLogin).toHaveBeenCalledWith('kalila.fontes@gmail.com', 'magica1')
    expect(screen.getByRole('img', { name: 'Impressora e documentos' })).toBeInTheDocument()
  })

  it('usa uma ilustração própria na composição de celular', () => {
    const { container } = render(<LoginScreen onLogin={async () => undefined} message="" />)

    expect(container.querySelector('picture.login-illustration source[media="(max-width: 899px)"]')).toBeInTheDocument()
    expect(container.querySelector('.login-hint-mobile')).toHaveTextContent('Acesso restrito à equipe.')
  })

  it('indica que está entrando enquanto carrega os dados', async () => {
    const user = userEvent.setup()
    let finishLogin: (() => void) | undefined
    render(<LoginScreen onLogin={() => new Promise<void>(resolve => { finishLogin = resolve })} message="" />)

    await user.type(screen.getByLabelText('E-mail'), 'kalila.fontes@gmail.com')
    await user.type(screen.getByLabelText('Senha'), 'magica1')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    finishLogin?.()
  })
})
