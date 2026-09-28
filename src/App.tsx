import { useEffect, useState } from 'react'
import { getAppConfig } from './config'
import { getSavedToken, signInWithGoogle } from './auth/googleAuth'
import { localConfig } from './localConfig'
import { createSheetsRepository } from './data/sheetsRepository'
import { createPlanningRepository, type PrintPlan } from './data/planningRepository'
import { PlanningScreen } from './components/PlanningScreen'
import { calculatePaymentStatus, calculateQuoteTotals, createDraftQuote, type Quote } from './domain/quote'
import { getSavedScreen, saveScreen, type Screen } from './navigation'
import { getPrintProgress } from './printProgress'
import './styles.css'

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDate = (value: string) => value ? value.split('-').reverse().join('/') : ''
const isPrinting = (status: string) => ['em impressão', 'imprimindo', 'em andamento'].includes(status.trim().toLowerCase())

export default function App() {
  const [token, setToken] = useState(() => getSavedToken() || '')
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [plans, setPlans] = useState<PrintPlan[]>([])
  const [draft, setDraft] = useState<Quote>(createDraftQuote())
  const [message, setMessage] = useState('')
  const [newQuote, setNewQuote] = useState(false)
  const [screen, setScreen] = useState<Screen>(getSavedScreen)
  const config = getAppConfig({ ...localConfig, VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || localConfig.VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_SPREADSHEET_ID: import.meta.env.VITE_GOOGLE_SPREADSHEET_ID || localConfig.VITE_GOOGLE_SPREADSHEET_ID })
  const repository = token ? createSheetsRepository(config.spreadsheetId, token) : null
  const goTo = (nextScreen: Screen) => { saveScreen(nextScreen); setScreen(nextScreen) }
  const loadPlans = () => token && createPlanningRepository(token).getPlans().then(setPlans).catch(() => undefined)

  useEffect(() => {
    if (token) return
    signInWithGoogle(config.googleClientId, true).then(setToken).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!repository || !token) return
    repository.getQuotes().then(setQuotes).catch(() => setMessage('Não foi possível carregar os orçamentos. Entre novamente.'))
    loadPlans()
  }, [token])

  const login = async () => {
    try {
      const access = await signInWithGoogle(config.googleClientId)
      setToken(access)
      setQuotes(await createSheetsRepository(config.spreadsheetId, access).getQuotes())
      setPlans(await createPlanningRepository(access).getPlans())
    } catch (e) {
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
    } catch {
      setMessage('Não foi possível salvar. Confirme as abas e colunas da planilha.')
    }
  }

  if (!token) return <main className="app"><p className="brand">CONTROLE</p><h1>Controle simples, onde você estiver.</h1><button onClick={login}>Entrar com Google</button>{message && <p className="message">{message}</p>}</main>

  const latestQuotes = quotes.slice(0, 3)
  const activePrintsCount = plans.filter(plan => isPrinting(plan.status)).length
  const todayPrints = plans.filter(plan => isPrinting(plan.status) || plan.status === 'Planejado').sort((a, b) => Number(isPrinting(b.status)) - Number(isPrinting(a.status))).slice(0, 3)
  const nav = <nav className="bottom-nav"><button className={screen === 'home' ? 'active' : ''} onClick={() => { setNewQuote(false); goTo('home') }}><i><HomeIcon /></i><span>Início</span></button><button className={screen === 'quotes' ? 'active' : ''} onClick={() => { setNewQuote(false); goTo('quotes') }}><i><QuoteIcon /></i><span>Orçamentos</span></button><button className={screen === 'planning' ? 'active' : ''} onClick={() => { setNewQuote(false); goTo('planning') }}><i><PrintIcon /></i><span>Produção</span></button></nav>

  if (screen === 'planning') return <main className="app app-with-nav"><p className="brand">CONTROLE</p><PlanningScreen token={token} onBack={() => goTo('home')} onUpdated={loadPlans} />{nav}</main>

  if (newQuote) {
    const total = calculateQuoteTotals(draft.items, draft.discount).total
    return <main className="app app-with-nav"><p className="brand">CONTROLE</p><button className="back" onClick={() => setNewQuote(false)}>← Voltar para orçamentos</button><h1>Editar orçamento</h1>{message && <p className="message">{message}</p>}<section className="form">
      <label>Cliente<input value={draft.client} onChange={e => setDraft({ ...draft, client: e.target.value })} /></label>
      <label>Status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Quote['status'] })}>{['Rascunho', 'Enviado', 'Aguardando aprovação', 'Aprovado', 'Aguardando produção', 'Aguardando entrega', 'Entregue', 'Recusado'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Data de entrega<input type="date" value={draft.deliveryDate} onChange={e => setDraft({ ...draft, deliveryDate: e.target.value })} /></label>
      <label>Descrição do item<input value={draft.items[0]?.description || ''} onChange={e => setDraft({ ...draft, items: [{ id: '1', description: e.target.value, quantity: 1, unitPrice: draft.items[0]?.unitPrice || 0 }] })} /></label>
      <label>Valor total<input type="number" value={draft.items[0]?.unitPrice || 0} onChange={e => setDraft({ ...draft, items: [{ id: '1', description: draft.items[0]?.description || '', quantity: 1, unitPrice: Number(e.target.value) }] })} /></label>
      <label>Valor recebido<input type="number" value={draft.receivedAmount} onChange={e => setDraft({ ...draft, receivedAmount: Number(e.target.value) })} /></label>
      <strong>{money(draft.receivedAmount)} de {money(total)} · {calculatePaymentStatus(total, draft.receivedAmount)}</strong>
      <button onClick={save}>Salvar alterações</button>
    </section>{nav}</main>
  }

  if (screen === 'quotes') return <main className="app app-with-nav"><p className="brand">CONTROLE</p><h1>Orçamentos</h1>{message && <p className="message">{message}</p>}<button onClick={openNewQuote}>＋ Novo orçamento</button><section className="home-section"><div className="section-title"><strong>Todos os orçamentos</strong></div>{quotes.length ? quotes.map(quote => <QuoteCard key={quote.id} quote={quote} onClick={() => editQuote(quote)} />) : <p className="empty">Nenhum orçamento cadastrado.</p>}</section>{nav}</main>

  return <main className="app app-with-nav">
    <p className="brand">CONTROLE</p>
    <h1>Olá, Kalila <span className="heart">♡</span></h1>
    <p className="subtitle">Planejamento de impressão da sua loja ✨</p>
    {message && <p className="message">{message}</p>}
    <button className="new-quote" onClick={openNewQuote}>＋ <span>Novo orçamento</span> →</button>
    <section className="home-section"><div className="section-title"><strong>Orçamentos</strong><button onClick={() => goTo('quotes')}>Ver todos ›</button></div>{latestQuotes.length ? latestQuotes.map(quote => <QuoteCard key={quote.id} quote={quote} onClick={() => editQuote(quote)} />) : <p className="empty">Nenhum orçamento cadastrado.</p>}</section>
    <section className="home-section print-section"><div className="section-title"><strong>Impressões de hoje</strong>{activePrintsCount > 0 && <em className="production-count">{activePrintsCount} em produção</em>}<button onClick={() => goTo('planning')}>Ver todas ›</button></div>{todayPrints.length ? todayPrints.map(plan => <PrintCard key={plan.row} plan={plan} onClick={() => goTo('planning')} />) : <p className="empty">Nenhuma impressão em andamento.</p>}</section>
    {nav}
  </main>
}

function QuoteCard({ quote, onClick }: { quote: Quote; onClick: () => void }) {
  const payment = calculatePaymentStatus(quote.total || 0, quote.receivedAmount)
  return <button className="quote home-quote" onClick={onClick}><span className="quote-info"><b>{quote.client || 'Sem cliente'}</b><span><em className="chip">{quote.status}</em><em className="chip payment">{payment}</em></span><small>▣ Entrega {formatDate(quote.deliveryDate) || 'não definida'}</small></span><span className="arrow">›</span></button>
}

function PrintCard({ plan, onClick }: { plan: PrintPlan; onClick: () => void }) {
  const progress = getPrintProgress(plan.start, plan.end, new Date(), plan.hours, plan.minutes, plan.pause, plan.pauseDuring)
  const running = isPrinting(plan.status)
  return <button className="print-row" onClick={onClick}><span className="print-main"><b>{plan.quantity > 1 ? `${plan.quantity}x ` : ''}{plan.piece || 'Sem nome'}</b><span>{plan.details || 'Sem detalhes'}</span><span className="progress-track"><i style={{ width: `${running ? progress.percent : 0}%` }} /></span></span><span className="print-meta"><b>{running ? `${progress.percent}%` : 'Planejada'}</b><small>◷ {running ? progress.remaining : plan.start || 'Sem horário'}</small></span><span className="arrow">›</span></button>
}

function HomeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></svg> }
function QuoteIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg> }
function PrintIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7zM18 11h.01" /></svg> }
