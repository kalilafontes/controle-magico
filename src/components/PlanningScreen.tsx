import { useEffect, useMemo, useState } from 'react'
import { createPlanningRepository, type PrintPlan } from '../data/planningRepository'

type Tab = 'andamento' | 'proximas' | 'pausadas' | 'concluidas'

const empty = (): PrintPlan => ({
  order: '', piece: '', quantity: 1, details: '', hours: 0, minutes: 0, pause: 0,
  start: '', end: '', duration: '', status: 'Planejado', pauseDuring: 0, occurrence: '',
})

const statusMap: Record<Tab, string[]> = {
  andamento: ['Em impressão', 'Imprimindo'], proximas: ['Planejado'], pausadas: ['Pausado'], concluidas: ['Concluído', 'Cancelado'],
}

const dateValue = (value: string) => {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/) 
  if (!match) return Number.NEGATIVE_INFINITY
  const [, day, month, year, hour = '00', minute = '00'] = match
  return new Date(+year, +month - 1, +day, +hour, +minute).getTime()
}

export const sortPlansForTab = (plans: PrintPlan[], tab: Tab) => {
  const filtered = plans.filter(plan => statusMap[tab].includes(plan.status))
  return tab === 'concluidas' ? [...filtered].sort((a, b) => dateValue(b.end) - dateValue(a.end)) : filtered
}

const estimateEnd = (plan: PrintPlan) => {
  const fullDate = plan.start.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  const timeOnly = plan.start.match(/^(\d{2}):(\d{2})$/)
  if (!fullDate && !timeOnly) return ''
  const date = (() => {
    if (fullDate) {
      const [, day, month, year, hour, minute] = fullDate
      return new Date(+year, +month - 1, +day, +hour, +minute)
    }
    const [, hour, minute] = timeOnly!
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), +hour, +minute)
  })()
  date.setMinutes(date.getMinutes() + plan.hours * 60 + plan.minutes + plan.pause + plan.pauseDuring)
  return fullDate ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '') : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function PlanningScreen({ token, onBack, onUpdated }: { token: string; onBack: () => void; onUpdated?: () => void }) {
  const repo = createPlanningRepository(token)
  const [plans, setPlans] = useState<PrintPlan[]>([])
  const [tab, setTab] = useState<Tab>('andamento')
  const [draft, setDraft] = useState<PrintPlan | null>(null)
  const [error, setError] = useState('')
  const load = () => repo.getPlans().then(setPlans).catch((e: unknown) => setError(`Não foi possível acessar o planejamento: ${e instanceof Error ? e.message : 'erro desconhecido'}`))

  useEffect(() => { load() }, [])

  const visible = useMemo(() => sortPlansForTab(plans, tab), [plans, tab])
  const active = plans.find(p => statusMap.andamento.includes(p.status))
  const save = async () => {
    if (!draft?.piece) return
    await repo.savePlan({ ...draft, end: estimateEnd(draft) || draft.end })
    await repo.synchronizeSchedule(await repo.getPlans())
    setDraft(null)
    load()
    onUpdated?.()
  }

  if (draft) {
    const predictedEnd = estimateEnd(draft)
    return <section className="form">
      <button className="back" onClick={() => setDraft(null)}>← Voltar para planejamento</button>
      <h1>{draft.row ? 'Editar impressão' : 'Nova impressão'}</h1>
      <p className="estimate">A ordem será definida automaticamente pelo horário de início.</p>
      <label>Peça / lote<input value={draft.piece} onChange={e => setDraft({ ...draft, piece: e.target.value })} /></label>
      <label>Quantidade de objetos<input inputMode="numeric" pattern="[0-9]*" value={draft.quantity || ''} onChange={e => setDraft({ ...draft, quantity: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
      <label>Detalhes / cor<input value={draft.details} onChange={e => setDraft({ ...draft, details: e.target.value })} /></label>
      <label>Horas<input inputMode="numeric" pattern="[0-9]*" value={draft.hours || ''} onChange={e => setDraft({ ...draft, hours: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
      <label>Minutos<input inputMode="numeric" pattern="[0-9]*" value={draft.minutes || ''} onChange={e => setDraft({ ...draft, minutes: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
      <label>Pausa antes (min)<input inputMode="numeric" pattern="[0-9]*" value={draft.pause || ''} onChange={e => setDraft({ ...draft, pause: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
      <label>Pausa durante (min)<input inputMode="numeric" pattern="[0-9]*" value={draft.pauseDuring || ''} onChange={e => setDraft({ ...draft, pauseDuring: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
      {predictedEnd && <p className="estimate">Previsão de término: <strong>{predictedEnd}</strong></p>}
      <label>Ocorrência / motivo<input value={draft.occurrence} placeholder="Ex.: troca de filamento" onChange={e => setDraft({ ...draft, occurrence: e.target.value })} /></label>
      <label>Início<input value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></label>
      <label>Status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>{['Planejado', 'Em impressão', 'Pausado', 'Concluído', 'Cancelado'].map(x => <option key={x}>{x}</option>)}</select></label>
      <button onClick={save}>Salvar planejamento</button>
    </section>
  }

  return <section>
    <button className="back" onClick={onBack}>← Voltar para orçamentos</button>
    <h1>Planejamento de impressão</h1>
    {error && <p className="message">{error}</p>}
    {active && <button className="print-now" onClick={() => setDraft(active)}><small>IMPRIMINDO AGORA</small><b>{active.quantity > 1 ? `${active.quantity}x ` : ''}{active.piece}</b><span>{active.details} · termina {active.end || estimateEnd(active) || '—'}</span></button>}
    <button onClick={() => setDraft(empty())}>＋ Nova impressão</button>
    <div className="plan-tabs">{([['andamento', 'Em andamento'], ['proximas', 'Próximas'], ['pausadas', 'Pausadas'], ['concluidas', 'Concluídas']] as [Tab, string][]).map(([id, label]) => <button className={tab === id ? 'selected' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}</div>
    {visible.length ? visible.map(p => <button className={`quote plan-card ${tab}`} key={p.row} onClick={() => setDraft(p)}><b>{p.quantity > 1 ? `${p.quantity}x ` : ''}{p.piece}</b><span>{p.details} · início {p.start || '—'} · fim {p.end || estimateEnd(p) || '—'}</span><span>{p.duration || `${p.hours}h ${p.minutes}min`} · {p.status}</span></button>) : <p className="empty">Nenhuma impressão nesta etapa.</p>}
  </section>
}
