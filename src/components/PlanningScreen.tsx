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

export const sortPlansForDesktop = (plans: PrintPlan[]) => {
  const priority: Record<string, number> = { 'em impressão': 0, imprimindo: 0, planejado: 1, pausado: 2, concluído: 3, cancelado: 3 }
  return [...plans].sort((a, b) => (priority[a.status.trim().toLowerCase()] ?? 4) - (priority[b.status.trim().toLowerCase()] ?? 4) || dateValue(a.start) - dateValue(b.start))
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
  date.setMinutes(date.getMinutes() + plan.hours * 60 + plan.minutes + plan.pauseDuring)
  return fullDate ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '') : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export const getPlanEndLabel = (plan: PrintPlan) => {
  if (plan.status?.trim().toLowerCase() === 'planejado') return estimateEnd(plan) || plan.end
  const startAt = dateValue(plan.start)
  const endAt = dateValue(plan.end)
  return plan.end && (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt > startAt) ? plan.end : estimateEnd(plan) || plan.end
}

export const getPlanningWorkspaceClass = (hasSelection: boolean) => hasSelection ? 'planning-workspace has-selection' : 'planning-workspace'
export const getPlanStatusClass = (status: string) => status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')

const useDesktopLayout = () => {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 900px)').matches)
  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 900px)')
    if (!query) return
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return desktop
}

export function PlanningScreen({ token, onBack, onUpdated, onSessionExpired }: { token: string; onBack: () => void; onUpdated?: () => void; onSessionExpired?: () => void }) {
  const repo = createPlanningRepository(token)
  const desktop = useDesktopLayout()
  const [plans, setPlans] = useState<PrintPlan[]>([])
  const [tab, setTab] = useState<Tab>('andamento')
  const [draft, setDraft] = useState<PrintPlan | null>(null)
  const [planToDelete, setPlanToDelete] = useState<PrintPlan | null>(null)
  const [error, setError] = useState('')
  const handleError = (prefix: string, e: unknown) => {
    if (e instanceof Error && (e as Error & { status?: number }).status === 401) return onSessionExpired?.()
    setError(`${prefix}: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
  }
  const load = async (synchronize = false) => {
    try {
      const current = await repo.getPlans()
      if (synchronize && await repo.synchronizeSchedule(current)) return load()
      setPlans(current)
    } catch (e) {
      handleError('Não foi possível acessar o planejamento', e)
    }
  }

  useEffect(() => { load(true) }, [])

  const visible = useMemo(() => sortPlansForTab(plans, tab), [plans, tab])
  const active = plans.find(p => statusMap.andamento.includes(p.status))
  const save = async () => {
    if (!draft?.piece) return
    try {
      await repo.savePlan({ ...draft, end: estimateEnd(draft) || draft.end })
      await repo.synchronizeSchedule(await repo.getPlans())
      setDraft(null)
      load()
      onUpdated?.()
    } catch (e) {
      handleError('Não foi possível salvar o planejamento', e)
    }
  }
  const remove = async () => {
    if (!planToDelete?.row) return
    try {
      await repo.deletePlan(planToDelete.row)
      await repo.synchronizeSchedule(await repo.getPlans())
      setPlanToDelete(null)
      setDraft(null)
      load()
      onUpdated?.()
    } catch (e) {
      handleError('Não foi possível apagar o planejamento', e)
    }
  }

  const deletionDialog = planToDelete && <div className="delete-dialog-backdrop"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
    <h2 id="delete-title">Apagar {planToDelete.piece}?</h2>
    <p>Essa impressão será removida do planejamento.</p>
    <div className="delete-dialog-actions"><button className="delete-cancel" onClick={() => setPlanToDelete(null)}>Cancelar</button><button className="delete-confirm" onClick={remove}>Apagar</button></div>
  </section></div>

  const tabs = [['andamento', 'Em andamento'], ['proximas', 'Próximas'], ['pausadas', 'Pausadas'], ['concluidas', 'Concluídas']] as [Tab, string][]
  const selectPlan = (plan: PrintPlan) => setDraft(plan)

  return <><section className="planning-screen">
    <div className="planning-mobile-header"><button className="back" onClick={onBack}>← Voltar para orçamentos</button><h1>Planejamento de impressão</h1>{error && <p className="message">{error}</p>}{active && <button className="print-now" onClick={() => selectPlan(active)}><small>IMPRIMINDO AGORA</small><b>{active.quantity > 1 ? `${active.quantity}x ` : ''}{active.piece}</b><span>{active.details} · termina {active.end || estimateEnd(active) || '—'}</span></button>}<button onClick={() => setDraft(empty())}>＋ Nova impressão</button><div className="plan-tabs">{tabs.map(([id, label]) => <button className={tab === id ? 'selected' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}</div></div>
    <div className="planning-desktop-header"><div><h1>Produção</h1><p>Planeje e acompanhe suas impressões.</p></div><button className="new-quote" onClick={() => setDraft(empty())}>＋ <span>Novo planejamento</span></button></div>{error && <p className="message planning-desktop-error">{error}</p>}
    <div className={getPlanningWorkspaceClass(Boolean(draft))}><section className="planning-list-panel"><h2>Planejamentos</h2>{desktop ? <div className="planning-desktop-list"><PlanList plans={sortPlansForDesktop(plans)} selectedRow={draft?.row} onSelect={selectPlan} onDelete={setPlanToDelete} /></div> : <div className="planning-mobile-list"><PlanList plans={visible} selectedRow={draft?.row} onSelect={selectPlan} onDelete={setPlanToDelete} tab={tab} /></div>}</section>{draft && <section className="planning-details-panel"><PlanningEditor draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} onDelete={() => setPlanToDelete(draft)} /></section>}</div>
  </section>{deletionDialog}</>
}

function PlanList({ plans, selectedRow, onSelect, onDelete, tab }: { plans: PrintPlan[]; selectedRow?: number; onSelect: (plan: PrintPlan) => void; onDelete: (plan: PrintPlan) => void; tab?: Tab }) {
  return plans.length ? <>{plans.map(plan => <article className={`plan-item ${selectedRow === plan.row ? 'selected' : ''}`} key={plan.row}><button className={`quote plan-card ${tab || ''}`} aria-current={selectedRow === plan.row || undefined} onClick={() => onSelect(plan)}><b>{plan.quantity > 1 ? `${plan.quantity}x ` : ''}{plan.piece}</b><span><em className={`plan-status ${getPlanStatusClass(plan.status)}`}>{plan.status}</em></span><small>▣ Início: {plan.start || '—'}{getPlanEndLabel(plan) ? ` · Previsão: ${getPlanEndLabel(plan)}` : ''}</small></button>{plan.row && <button className="plan-delete" aria-label={`Apagar ${plan.piece}`} onClick={() => onDelete(plan)}><TrashIcon /></button>}</article>)}</> : <p className="empty">Nenhuma impressão nesta etapa.</p>
}

function PlanningEditor({ draft, onChange, onSave, onCancel, onDelete }: { draft: PrintPlan; onChange: (plan: PrintPlan) => void; onSave: () => void; onCancel: () => void; onDelete: () => void }) {
  const predictedEnd = estimateEnd(draft)
  const numberChange = (field: 'quantity' | 'hours' | 'minutes' | 'pause' | 'pauseDuring') => (value: string) => onChange({ ...draft, [field]: Number(value.replace(/\D/g, '')) || 0 })
  return <><h2>Detalhes do planejamento</h2><section className="form planning-editor-form"><p className="estimate">A ordem será definida automaticamente pelo horário de início.</p><label>Peça / lote<input value={draft.piece} onChange={e => onChange({ ...draft, piece: e.target.value })} /></label><label>Quantidade de objetos<input inputMode="numeric" pattern="[0-9]*" value={draft.quantity || ''} onChange={e => numberChange('quantity')(e.target.value)} /></label><label>Detalhes / cor<input value={draft.details} onChange={e => onChange({ ...draft, details: e.target.value })} /></label><div className="planning-duration-fields"><label>Horas<input inputMode="numeric" pattern="[0-9]*" value={draft.hours || ''} onChange={e => numberChange('hours')(e.target.value)} /></label><label>Minutos<input inputMode="numeric" pattern="[0-9]*" value={draft.minutes || ''} onChange={e => numberChange('minutes')(e.target.value)} /></label><label>Pausa antes (min)<input inputMode="numeric" pattern="[0-9]*" value={draft.pause || ''} onChange={e => numberChange('pause')(e.target.value)} /></label><label>Pausa durante (min)<input inputMode="numeric" pattern="[0-9]*" value={draft.pauseDuring || ''} onChange={e => numberChange('pauseDuring')(e.target.value)} /></label></div>{predictedEnd && <p className="estimate">Previsão de término: <strong>{predictedEnd}</strong></p>}<label>Ocorrência / motivo<input value={draft.occurrence} placeholder="Ex.: troca de filamento" onChange={e => onChange({ ...draft, occurrence: e.target.value })} /></label><div className="planning-footer-fields"><label>Início<input value={draft.start} onChange={e => onChange({ ...draft, start: e.target.value })} /></label><label>Status<select value={draft.status} onChange={e => onChange({ ...draft, status: e.target.value })}>{['Planejado', 'Em impressão', 'Pausado', 'Concluído', 'Cancelado'].map(status => <option key={status}>{status}</option>)}</select></label></div><div className="planning-editor-actions">{draft.row && <button type="button" className="delete-cancel" onClick={onDelete}>Apagar planejamento</button>}<button type="button" className="delete-cancel" onClick={onCancel}>Cancelar</button><button type="button" onClick={onSave}>Salvar planejamento</button></div></section></>
}

function TrashIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 13h10l1-13" /></svg> }
