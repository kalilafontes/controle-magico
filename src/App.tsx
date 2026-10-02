import { useEffect, useState, type ComponentType, type FormEvent } from 'react'
import { getAppConfig } from './config'
import { clearSavedSession, getSavedSession, loginWithSheet, logoutWithSheet } from './auth/sheetAuth'
import { localConfig } from './localConfig'
import { createSheetsRepository } from './data/sheetsRepository'
import { createPlanningRepository, type PrintPlan } from './data/planningRepository'
import { SessionExpiredError } from './data/appsScriptClient'
import { PlanningScreen } from './components/PlanningScreen'
import { buildQuoteShareText, calculatePaymentStatus, calculateQuoteTotals, createDraftQuote, getPaymentStatusClass, getQuoteStatusClass, type Quote, type QuoteItem } from './domain/quote'
import { formatMoneyInput, parseMoneyInput } from './domain/money'
import { getSavedScreen, saveScreen, type Screen } from './navigation'
import { getPrintProgress } from './printProgress'
import { shareText } from './share'
import './styles.css'
import './desktopNav.css'
import loginPrinter from './assets/pinter-3d.png'

const formatDate = (value: string) => value ? value.split('-').reverse().join('/') : ''
const isPrinting = (status: string) => ['em impressão', 'imprimindo', 'em andamento'].includes(status.trim().toLowerCase())
const quoteStatuses: Quote['status'][] = ['Rascunho', 'Enviado', 'Aguardando aprovação', 'Aprovado', 'Aguardando produção', 'Aguardando entrega', 'Entregue', 'Recusado']
const paymentStatuses = ['Não pago', 'Parcialmente pago', 'Pago'] as const
type QuoteStatusFilter = Quote['status'] | 'Todos'
type PaymentStatusFilter = typeof paymentStatuses[number] | 'Todos'
export const getSaveMessage = (error: unknown) => error instanceof Error && error.message ? `Não foi possível salvar: ${error.message}` : 'Não foi possível salvar. Tente novamente.'
export const getQuoteWorkspaceClass = (hasSelection: boolean) => hasSelection ? 'quotes-workspace has-selection' : 'quotes-workspace'
export const filterAndSortQuotes = (quotes: Quote[], status: QuoteStatusFilter, payment: PaymentStatusFilter) => quotes
  .filter(quote => (status === 'Todos' || quote.status === status) && (payment === 'Todos' || calculatePaymentStatus(quote.total || 0, quote.receivedAmount) === payment))
  .sort((a, b) => Number(b.status === 'Aguardando produção' && calculatePaymentStatus(b.total || 0, b.receivedAmount) === 'Pago') - Number(a.status === 'Aguardando produção' && calculatePaymentStatus(a.total || 0, a.receivedAmount) === 'Pago'))

export default function App() {
  const [token, setToken] = useState(() => getSavedSession()?.token || '')
  const [profileName, setProfileName] = useState(() => getSavedSession()?.name || '')
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [plans, setPlans] = useState<PrintPlan[]>([])
  const [draft, setDraft] = useState<Quote>(createDraftQuote())
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null)
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<QuoteStatusFilter>('Todos')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('Todos')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [message, setMessage] = useState('')
  const [newQuote, setNewQuote] = useState(false)
  const [screen, setScreen] = useState<Screen>(getSavedScreen)
  const config = getAppConfig({ ...localConfig, VITE_APPS_SCRIPT_URL: import.meta.env.VITE_APPS_SCRIPT_URL || localConfig.VITE_APPS_SCRIPT_URL })
  const repository = token ? createSheetsRepository(config.appsScriptUrl, token) : null
  const goTo = (nextScreen: Screen) => { saveScreen(nextScreen); setScreen(nextScreen) }
  const expireSession = () => { clearSavedSession(); setToken(''); setProfileName(''); setQuotes([]); setPlans([]); setMessage('') }
  const logout = async () => { if (token) await logoutWithSheet(config.appsScriptUrl, token); expireSession() }
  const loadPlans = () => token && createPlanningRepository(config.appsScriptUrl, token).getPlans().then(setPlans).catch(error => { if (error instanceof SessionExpiredError) expireSession() })

  useEffect(() => {
    if (!repository || !token) return
    repository.getQuotes().then(setQuotes).catch(error => { if (error instanceof SessionExpiredError) expireSession(); else setMessage(getSaveMessage(error)) })
    loadPlans()
  }, [token])

  const login = async (email: string, password: string) => {
    try {
      const session = await loginWithSheet(config.appsScriptUrl, email, password)
      setToken(session.token)
      setProfileName(session.name)
      setQuotes(await createSheetsRepository(config.appsScriptUrl, session.token).getQuotes())
      setPlans(await createPlanningRepository(config.appsScriptUrl, session.token).getPlans())
    } catch (e) {
      if (e instanceof SessionExpiredError) return expireSession()
      setMessage(e instanceof Error ? e.message : 'Tente novamente.')
    }
  }

  const openNewQuote = () => { setDraft(createDraftQuote()); setNewQuote(true); goTo('quotes') }
  const editQuote = (quote: Quote) => { setDraft(quote); setNewQuote(true); goTo('quotes') }
  const save = async () => {
    try {
      await repository?.saveQuote(draft)
      setQuotes(current => current.some(item => item.id === draft.id) ? current.map(item => item.id === draft.id ? draft : item) : [draft, ...current])
      setDraft(createDraftQuote())
      setNewQuote(false)
      setMessage('Orçamento salvo na planilha.')
    } catch (error) {
      if (error instanceof SessionExpiredError) return expireSession()
      setMessage(getSaveMessage(error))
    }
  }
  const removeQuote = async () => {
    if (!repository || !quoteToDelete) return
    try {
      await repository.deleteQuote(quoteToDelete.id)
      setQuotes(current => current.filter(quote => quote.id !== quoteToDelete.id))
      setQuoteToDelete(null)
      setMessage('Orçamento apagado da planilha.')
    } catch (error) {
      if (error instanceof SessionExpiredError) return expireSession()
      setMessage(getSaveMessage(error))
    }
  }

  if (!token) return <LoginScreen onLogin={login} message={message} />

  const latestQuotes = quotes.slice(0, 3)
  const filteredQuotes = filterAndSortQuotes(quotes, quoteStatusFilter, paymentStatusFilter)
  const activePrintsCount = plans.filter(plan => isPrinting(plan.status)).length
  const todayPrints = plans.filter(plan => isPrinting(plan.status) || plan.status === 'Planejado').sort((a, b) => Number(isPrinting(b.status)) - Number(isPrinting(a.status))).slice(0, 3)
  const nav = <Navigation screen={screen} onNavigate={next => { setNewQuote(false); goTo(next) }} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
  const quoteFilters = <QuoteFilters status={quoteStatusFilter} payment={paymentStatusFilter} onStatusChange={setQuoteStatusFilter} onPaymentChange={setPaymentStatusFilter} />
  const deletionDialog = quoteToDelete && <div className="delete-dialog-backdrop"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-quote-title"><h2 id="delete-quote-title">Apagar orçamento de {quoteToDelete.client || 'cliente'}?</h2><p>O orçamento e todos os seus produtos serão removidos da planilha.</p><div className="delete-dialog-actions"><button className="delete-cancel" onClick={() => setQuoteToDelete(null)}>Cancelar</button><button className="delete-confirm" onClick={removeQuote}>Apagar</button></div></section></div>

  if (screen === 'planning') return <main className="app app-with-nav"><p className="brand">CONTROLE</p><PlanningScreen token={token} appsScriptUrl={config.appsScriptUrl} onBack={() => goTo('home')} onUpdated={loadPlans} onSessionExpired={expireSession} />{nav}</main>

  if (screen === 'quotes') return <main className="app app-with-nav quotes-page"><p className="brand">CONTROLE</p>
    <div className="quotes-mobile-view">{newQuote ? <><button className="back" onClick={() => setNewQuote(false)}>← Voltar para orçamentos</button><h1>Editar orçamento</h1>{message && <p className="message">{message}</p>}<QuoteEditor draft={draft} onChange={setDraft} onSave={save} onCancel={() => setNewQuote(false)} /></> : <><h1>Orçamentos</h1>{message && <p className="message">{message}</p>}<button onClick={openNewQuote}>＋ Novo orçamento</button><section className="home-section"><div className="section-title"><strong>Todos os orçamentos</strong></div>{quoteFilters}<QuoteList quotes={filteredQuotes} onEdit={editQuote} onDelete={setQuoteToDelete} /></section></>}</div>
    <div className="quotes-desktop-view"><header className="quotes-header"><div><h1>Orçamentos</h1><p>Gerencie seus pedidos e pagamentos.</p></div><button className="new-quote" onClick={openNewQuote}>＋ <span>Novo orçamento</span></button></header>{message && <p className="message">{message}</p>}<div className={getQuoteWorkspaceClass(newQuote)}><section className="quote-list-panel"><div className="section-title"><strong>Todos os orçamentos</strong></div>{quoteFilters}<QuoteList quotes={filteredQuotes} onEdit={editQuote} onDelete={setQuoteToDelete} selectedId={newQuote ? draft.id : undefined} showTotal /></section>{newQuote && <section className="quote-details-panel"><QuoteEditor draft={draft} onChange={setDraft} onSave={save} onCancel={() => setNewQuote(false)} /></section>}</div></div>{deletionDialog}{nav}</main>

  return <main className="app app-with-nav home-dashboard">
    <p className="brand">CONTROLE</p>
    <header className="home-header"><div><h1>Olá{profileName ? `, ${profileName}` : ''} <span className="heart">♡</span></h1><p className="subtitle">Planejamento de impressão da sua loja ✨</p></div><div className="home-header-actions"><button className="logout" onClick={() => void logout()}>Sair</button><button className="new-quote" onClick={openNewQuote}>＋ <span>Novo orçamento</span> →</button></div></header>
    {message && <p className="message">{message}</p>}
    <div className="dashboard-grid"><section className="home-section"><div className="section-title"><strong>Orçamentos</strong><button onClick={() => goTo('quotes')}>Ver todos ›</button></div><QuoteList quotes={latestQuotes} onEdit={editQuote} onDelete={setQuoteToDelete} /></section>
    <section className="home-section print-section"><div className="section-title"><strong>Impressões de hoje</strong>{activePrintsCount > 0 && <em className="production-count">{activePrintsCount} em produção</em>}<button onClick={() => goTo('planning')}>Ver todas ›</button></div>{todayPrints.length ? todayPrints.map(plan => <PrintCard key={plan.row} plan={plan} onClick={() => goTo('planning')} />) : <p className="empty">Nenhuma impressão em andamento.</p>}</section></div>
    {deletionDialog}{nav}
  </main>
}

function QuoteFilters({ status, payment, onStatusChange, onPaymentChange }: { status: QuoteStatusFilter; payment: PaymentStatusFilter; onStatusChange: (status: QuoteStatusFilter) => void; onPaymentChange: (payment: PaymentStatusFilter) => void }) {
  return <div className="quote-filters"><label>Status<select aria-label="Filtrar por status" value={status} onChange={event => onStatusChange(event.target.value as QuoteStatusFilter)}><option>Todos</option>{quoteStatuses.map(item => <option key={item}>{item}</option>)}</select></label><label>Pagamento<select aria-label="Filtrar por pagamento" value={payment} onChange={event => onPaymentChange(event.target.value as PaymentStatusFilter)}><option>Todos</option>{paymentStatuses.map(item => <option key={item}>{item}</option>)}</select></label></div>
}

export function QuoteList({ quotes, onEdit, onDelete, selectedId, showTotal = false }: { quotes: Quote[]; onEdit: (quote: Quote) => void; onDelete: (quote: Quote) => void; selectedId?: string; showTotal?: boolean }) {
  return quotes.length ? <>{quotes.map(quote => <article className={`quote-item ${selectedId === quote.id ? 'selected' : ''}`} key={quote.id}><QuoteCard quote={quote} onClick={() => onEdit(quote)} selected={selectedId === quote.id} showTotal={showTotal} /><button className="quote-delete" aria-label={`Apagar orçamento de ${quote.client || 'cliente'}`} onClick={() => onDelete(quote)}><TrashIcon /></button></article>)}</> : <p className="empty">Nenhum orçamento cadastrado.</p>
}

export function Navigation({ screen, onNavigate, collapsed, onCollapsedChange }: { screen: Screen; onNavigate: (screen: Screen) => void; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void }) {
  const items: [Screen, string, ComponentType][] = [['home', 'Início', HomeIcon], ['quotes', 'Orçamentos', QuoteIcon], ['planning', 'Produção', PrintIcon]]
  return <nav className={`bottom-nav ${collapsed ? 'collapsed' : ''}`}><button type="button" className="sidebar-toggle" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => onCollapsedChange(!collapsed)}><i><MenuIcon /></i><span>{collapsed ? 'Expandir' : 'Recolher'}</span></button>{items.map(([id, label, Icon]) => <button key={id} type="button" className={screen === id ? 'active' : ''} title={label} onClick={() => onNavigate(id)}><i><Icon /></i><span>{label}</span></button>)}</nav>
}

export function LoginScreen({ onLogin, message }: { onLogin: (email: string, password: string) => Promise<void>; message: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setLoading(true); try { await onLogin(email, password) } finally { setLoading(false) } }
  return <main className="app login-screen"><section className="login-card"><picture className="login-illustration"><source media="(max-width: 899px)" srcSet={loginPrinter} /><img src={loginPrinter} alt="Impressora e documentos" /></picture><div className="login-content"><p className="brand">CONTROLE</p><span className="login-brand-line" /><h1>Controle simples,<br />onde você estiver.</h1><p className="login-subtitle">Acesse seus orçamentos e planejamentos de impressão com praticidade.</p><form className="login-form" onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} disabled={loading} required /></label><label>Senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} disabled={loading} required /></label><button className="login-google" type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button></form><p className="login-hint"><span className="login-hint-desktop">Use seu acesso cadastrado para continuar</span><span className="login-hint-mobile">🔒 Acesso restrito à equipe.</span></p>{message && <p className="message">{message}</p>}</div></section></main>
}

function QuoteCard({ quote, onClick, selected = false, showTotal = false }: { quote: Quote; onClick: () => void; selected?: boolean; showTotal?: boolean }) {
  const payment = calculatePaymentStatus(quote.total || 0, quote.receivedAmount)
  return <button className="quote home-quote" aria-current={selected || undefined} onClick={onClick}><span className="quote-info"><b>{quote.client || 'Sem cliente'}</b><span><em className={`chip ${getQuoteStatusClass(quote.status)}`}>{quote.status}</em><em className={`chip payment ${getPaymentStatusClass(payment)}`}>{payment}</em></span><small>▣ Entrega {formatDate(quote.deliveryDate) || 'não definida'}</small></span>{showTotal && <strong className="quote-total">{formatMoneyInput(quote.total || 0)}</strong>}<span className="arrow">›</span></button>
}

function TrashIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 13h10l1-13" /></svg> }

function PrintCard({ plan, onClick }: { plan: PrintPlan; onClick: () => void }) {
  const progress = getPrintProgress(plan.start, plan.end, new Date(), plan.hours, plan.minutes, plan.pause, plan.pauseDuring)
  const running = isPrinting(plan.status)
  return <button className="print-row" onClick={onClick}><span className="print-main"><b>{plan.quantity > 1 ? `${plan.quantity}x ` : ''}{plan.piece || 'Sem nome'}</b><span>{plan.details || 'Sem detalhes'}</span><span className="progress-track"><i style={{ width: `${running ? progress.percent : 0}%` }} /></span></span><span className="print-meta"><b>{running ? `${progress.percent}%` : 'Planejada'}</b><small>◷ {running ? progress.remaining : plan.start || 'Sem horário'}</small></span><span className="arrow">›</span></button>
}

const emptyItem = (): QuoteItem => ({ id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 })

export function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [editingValue, setEditingValue] = useState<string | null>(null)
  return <label>{label}<input aria-label={label} type="text" inputMode="decimal" value={editingValue ?? formatMoneyInput(value)} onFocus={() => setEditingValue(String(value).replace('.', ','))} onChange={event => setEditingValue(event.target.value)} onBlur={event => { onChange(parseMoneyInput(event.target.value)); setEditingValue(null) }} /></label>
}

export function QuoteSummary({ items, discount }: { items: QuoteItem[]; discount: number }) {
  const totals = calculateQuoteTotals(items, discount)
  return <section className="quote-summary" aria-label="Resumo do orçamento"><span>Subtotal: {formatMoneyInput(totals.subtotal)}</span><span>Desconto: {formatMoneyInput(discount)}</span><strong>Total: {formatMoneyInput(totals.total)}</strong></section>
}

export function QuoteEditor({ draft, onChange, onSave, onCancel }: { draft: Quote; onChange: (quote: Quote) => void; onSave: () => void; onCancel: () => void }) {
  const total = calculateQuoteTotals(draft.items, draft.discount).total
  const [shareMessage, setShareMessage] = useState('')
  const shareQuote = async () => {
    if (!draft.items.length || draft.items.some(item => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0)) {
      setShareMessage('Adicione pelo menos um produto válido antes de compartilhar.')
      return
    }
    try {
      const result = await shareText(buildQuoteShareText(draft))
      setShareMessage(result === 'copied' ? 'Texto do orçamento copiado. Cole onde quiser compartilhar.' : '')
    } catch {
      setShareMessage('Não foi possível compartilhar o orçamento. Tente novamente.')
    }
  }
  return <><h2 className="quote-details-title">Detalhes do orçamento</h2><section className="form quote-editor-form">
    <div className="quote-main-fields"><label>Cliente<input value={draft.client} onChange={e => onChange({ ...draft, client: e.target.value })} /></label><label>Status<select value={draft.status} onChange={e => onChange({ ...draft, status: e.target.value as Quote['status'] })}>{['Rascunho', 'Enviado', 'Aguardando aprovação', 'Aprovado', 'Aguardando produção', 'Aguardando entrega', 'Entregue', 'Recusado'].map(status => <option key={status}>{status}</option>)}</select></label><label>Data de entrega<input type="date" value={draft.deliveryDate} onChange={e => onChange({ ...draft, deliveryDate: e.target.value })} /></label></div>
    <QuoteItemsEditor items={draft.items} onChange={items => onChange({ ...draft, items })} />
    <div className="quote-payment-fields"><MoneyInput label="Desconto" value={draft.discount} onChange={discount => onChange({ ...draft, discount })} /><QuoteSummary items={draft.items} discount={draft.discount} /><MoneyInput label="Valor recebido" value={draft.receivedAmount} onChange={receivedAmount => onChange({ ...draft, receivedAmount })} /><strong className="payment-status">{formatMoneyInput(draft.receivedAmount)} de {formatMoneyInput(total)} · {calculatePaymentStatus(total, draft.receivedAmount)}</strong></div>
    {shareMessage && <p className="message" role="status">{shareMessage}</p>}
    <div className="quote-editor-actions"><button type="button" className="delete-cancel" onClick={onCancel}>Cancelar</button><button type="button" className="share-quote" onClick={shareQuote}>Compartilhar orçamento</button><button type="button" onClick={onSave}>Salvar orçamento</button></div>
  </section></>
}

export function QuoteItemsEditor({ items, onChange }: { items: QuoteItem[]; onChange: (items: QuoteItem[]) => void }) {
  const visibleItems = items.length ? items : [emptyItem()]
  const updateItem = (index: number, update: Partial<QuoteItem>) => onChange(visibleItems.map((item, current) => current === index ? { ...item, ...update } : item))
  const removeItem = (index: number) => { if (visibleItems.length > 1) onChange(visibleItems.filter((_, current) => current !== index)) }

  return <section className="product-list" aria-label="Produtos">
    <div className="section-title"><strong>Produtos</strong></div>
    {visibleItems.map((item, index) => <article className="product-item" key={item.id}>
      <div className="product-item-heading"><b>Produto {index + 1}</b>{visibleItems.length > 1 && <button type="button" className="product-remove" aria-label={`Remover produto ${item.description || index + 1}`} onClick={() => removeItem(index)}>Remover</button>}</div>
      <label>Descrição do produto<input aria-label="Descrição do produto" value={item.description} onChange={event => updateItem(index, { description: event.target.value })} /></label>
      <div className="product-values">
        <label>Quantidade<input type="number" min="1" value={item.quantity} onChange={event => updateItem(index, { quantity: Number(event.target.value) })} /></label>
        <MoneyInput label={`Valor unitário de ${item.description || 'produto'}`} value={item.unitPrice} onChange={unitPrice => updateItem(index, { unitPrice })} />
      </div>
      <strong className="item-subtotal">Subtotal: {formatMoneyInput(item.quantity * item.unitPrice)}</strong>
    </article>)}
    <button type="button" className="add-product" onClick={() => onChange([...visibleItems, emptyItem()])}>＋ Adicionar produto</button>
  </section>
}

function HomeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></svg> }
function QuoteIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg> }
function PrintIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7zM18 11h.01" /></svg> }
function MenuIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg> }
