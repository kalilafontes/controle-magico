import { useEffect, useMemo, useRef, useState } from 'react'
import { createPlanningRepository, type PrintPlan } from '../data/planningRepository'
import { reorderPlannedStarts } from '../data/planningSchedule'
import bambuA1 from '../assets/bambu-a1.png'

type Tab = 'andamento' | 'proximas' | 'pausadas' | 'concluidas'
type PrinterFilter = 'Todas' | 'Bambu A1' | 'Bambu A1 2'
const printers = ['Bambu A1', 'Bambu A1 2'] as const

const empty = (): PrintPlan => ({
  order: '', piece: '', quantity: 1, details: '', hours: 0, minutes: 0, pause: 0,
  start: '', end: '', duration: '', status: 'Planejado', pauseDuring: 0, occurrence: '', printer: 'Bambu A1',
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
  if (tab === 'concluidas') return [...filtered].sort((a, b) => dateValue(b.end) - dateValue(a.end))
  if (tab === 'proximas') return [...filtered].sort((a, b) => dateValue(a.start) - dateValue(b.start))
  return filtered
}

export const sortPlansForDesktop = (plans: PrintPlan[]) => {
  const priority: Record<string, number> = { 'em impressão': 0, imprimindo: 0, planejado: 1, pausado: 2, concluído: 3, cancelado: 3 }
  return [...plans].sort((a, b) => {
    const aPriority = priority[a.status.trim().toLowerCase()] ?? 4
    const bPriority = priority[b.status.trim().toLowerCase()] ?? 4
    if (aPriority !== bPriority) return aPriority - bPriority
    if (aPriority === 3) return dateValue(b.end) - dateValue(a.end)
    return dateValue(a.start) - dateValue(b.start)
  })
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

export const getPlanDurationLabel = (plan: Pick<PrintPlan, 'hours' | 'minutes' | 'pauseDuring'>) => {
  const totalMinutes = plan.hours * 60 + plan.minutes + plan.pauseDuring
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes}min`
  return minutes ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`
}

const duplicateStart = (plan: PrintPlan) => {
  const fullDate = plan.start.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  const timeOnly = plan.start.match(/^(\d{2}):(\d{2})$/)
  if (!fullDate && !timeOnly) return plan.start
  const date = (() => {
    if (fullDate) {
      const [, day, month, year, hour, minute] = fullDate
      return new Date(+year, +month - 1, +day, +hour, +minute)
    }
    const [, hour, minute] = timeOnly!
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), +hour, +minute)
  })()
  date.setMinutes(date.getMinutes() + plan.hours * 60 + plan.minutes + plan.pauseDuring + plan.pause)
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
  const [printerFilter, setPrinterFilter] = useState<PrinterFilter>('Todas')
  const [draft, setDraft] = useState<PrintPlan | null>(null)
  const [planToDelete, setPlanToDelete] = useState<PrintPlan | null>(null)
  const draggedRowRef = useRef<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ row: number; placement: 'before' | 'after' } | null>(null)
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

  const visible = useMemo(() => sortPlansForTab(plans, tab).filter(plan => printerFilter === 'Todas' || plan.printer === printerFilter), [plans, tab, printerFilter])
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
  const duplicatePlan = (plan: PrintPlan) => setDraft({ ...plan, row: undefined, order: '', start: duplicateStart(plan), end: '', duration: '', status: 'Planejado' })
  const completePlan = async (plan: PrintPlan) => {
    if (!plan.row) return
    try {
      await repo.savePlan({ ...plan, status: 'Concluído', end: estimateEnd(plan) || plan.end })
      await repo.synchronizeSchedule(await repo.getPlans())
      setDraft(current => current?.row === plan.row ? null : current)
      await load()
      onUpdated?.()
    } catch (e) {
      handleError('Não foi possível concluir o planejamento', e)
    }
  }
  const movePlan = async (target: PrintPlan, placement: 'before' | 'after') => {
    const dragged = draggedRowRef.current
    if (!dragged || !target.row) return
    const source = plans.find(plan => plan.row === dragged)
    if (!source || (source.printer || 'Bambu A1') !== (target.printer || 'Bambu A1')) return
    const reordered = reorderPlannedStarts(plans, dragged, target.row, placement)
    draggedRowRef.current = null
    setDropTarget(null)
    try {
      await repo.synchronizeSchedule(reordered, plans)
      await load()
      onUpdated?.()
    } catch (e) {
      handleError('Não foi possível reordenar o planejamento', e)
    }
  }
  const renderPlanList = (items: PrintPlan[], listTab?: Tab) => <PlanList plans={items} selectedRow={draft?.row} onSelect={selectPlan} onDelete={setPlanToDelete} onDuplicate={duplicatePlan} onComplete={completePlan} onDragStart={row => { draggedRowRef.current = row }} onDragEnd={() => { draggedRowRef.current = null; setDropTarget(null) }} onDragOverPlan={setDropTarget} onDropPlan={movePlan} dropTarget={dropTarget} tab={listTab} />

  const printerCount = (printer: string) => plans.filter(plan => (plan.printer || 'Bambu A1') === printer && !['Concluído', 'Cancelado'].includes(plan.status)).length
  const printerCards = <div className="printer-summary">{printers.map(printer => { const running = plans.find(plan => (plan.printer || 'Bambu A1') === printer && statusMap.andamento.includes(plan.status)); const queued = printerCount(printer); return <button key={printer} type="button" className={`printer-card ${printerFilter === printer ? 'selected' : ''}`} aria-label={printer} onClick={() => setPrinterFilter(printer)}><span className="printer-icon"><img src={bambuA1} alt="" /></span><span><b>{printer}</b><em className={running ? 'printing' : ''}>{running ? 'Em impressão' : `${queued} item${queued === 1 ? '' : 's'} na fila`}</em><small>◷ {running ? `Próxima troca às ${getPlanEndLabel(running) || '—'}` : queued ? 'Fila aguardando' : 'Disponível agora'}</small></span></button> })}</div>
  const printerTabs = <div className="plan-tabs printer-tabs">{(['Todas', ...printers] as PrinterFilter[]).map(printer => <button key={printer} className={printerFilter === printer ? 'selected' : ''} onClick={() => setPrinterFilter(printer)}>{printer}{printer !== 'Todas' ? ` (${printerCount(printer)})` : ` (${plans.length})`}</button>)}</div>
  return <><section className="planning-screen">
    {!desktop && (draft ? <><button className="back" onClick={() => setDraft(null)}>← Voltar para planejamentos</button><h1>Detalhes do planejamento</h1>{error && <p className="message">{error}</p>}<PlanningEditor draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} onDelete={() => setPlanToDelete(draft)} /></> : <><div className="planning-mobile-header"><button className="back" onClick={onBack}>← Voltar para orçamentos</button><h1>Planejamento de impressão</h1>{error && <p className="message">{error}</p>}{active && <button className="print-now" onClick={() => selectPlan(active)}><small>IMPRIMINDO AGORA</small><b>{active.quantity > 1 ? `${active.quantity}x ` : ''}{active.piece}</b><span>{active.details} · termina {active.end || estimateEnd(active) || '—'}</span></button>}<button onClick={() => setDraft(empty())}>＋ Nova impressão</button><div className="plan-tabs">{tabs.map(([id, label]) => <button className={tab === id ? 'selected' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}</div>{printerTabs}</div><div className="planning-mobile-list">{renderPlanList(visible, tab)}</div></>)}
    {desktop && <><div className="planning-desktop-header"><div><h1>Produção</h1><p>Planeje e acompanhe suas impressões.</p></div><button className="new-quote" onClick={() => setDraft(empty())}>＋ <span>Novo planejamento</span></button></div>{error && <p className="message planning-desktop-error">{error}</p>}{printerCards}{printerTabs}<div className={getPlanningWorkspaceClass(Boolean(draft))}><div className="planning-list-panel-flat"><div className="planning-desktop-list">{renderPlanList(sortPlansForDesktop(plans).filter(plan => printerFilter === 'Todas' || plan.printer === printerFilter))}</div></div>{draft && <section className="planning-details-panel"><PlanningEditor draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} onDelete={() => setPlanToDelete(draft)} /></section>}</div></>}
  </section>{deletionDialog}</>
}

function PlanList({ plans, selectedRow, onSelect, onDelete, onDuplicate, onComplete, onDragStart, onDragEnd, onDragOverPlan, onDropPlan, dropTarget, tab }: { plans: PrintPlan[]; selectedRow?: number; onSelect: (plan: PrintPlan) => void; onDelete: (plan: PrintPlan) => void; onDuplicate: (plan: PrintPlan) => void; onComplete: (plan: PrintPlan) => void; onDragStart: (row: number) => void; onDragEnd: () => void; onDragOverPlan: (target: { row: number; placement: 'before' | 'after' }) => void; onDropPlan: (plan: PrintPlan, placement: 'before' | 'after') => void; dropTarget: { row: number; placement: 'before' | 'after' } | null; tab?: Tab }) {
  return plans.length ? <>{plans.map(plan => {
    const movable = plan.status === 'Planejado' && Boolean(plan.row)
    const placement = (event: { currentTarget: { getBoundingClientRect: () => DOMRect }; clientY: number }) => { const bounds = event.currentTarget.getBoundingClientRect(); return event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before' as const }
    const dropClass = dropTarget && dropTarget.row === plan.row ? `drop-${dropTarget.placement}` : ''
    const canComplete = !['concluído', 'cancelado'].includes(plan.status.trim().toLowerCase())
    return <article className={`plan-item ${selectedRow === plan.row ? 'selected' : ''} ${dropClass}`} key={plan.row}><button className={`quote plan-card ${tab || ''}`} aria-current={selectedRow === plan.row || undefined} draggable={movable} onDragStart={event => { if (!movable) return; event.dataTransfer?.setData('text/plain', String(plan.row)); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'; onDragStart(plan.row!) }} onDragEnd={onDragEnd} onDragOver={movable ? event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; onDragOverPlan({ row: plan.row!, placement: placement(event) }) } : undefined} onDrop={movable ? event => { event.preventDefault(); onDropPlan(plan, placement(event)) } : undefined} onClick={() => onSelect(plan)}><b>{plan.quantity > 1 ? `${plan.quantity}x ` : ''}{plan.piece}</b><span><em className={`plan-status ${getPlanStatusClass(plan.status)}`}>{plan.status}</em><em className="printer-tag">▣ {plan.printer || 'Bambu A1'}</em></span><small>▣ Início: {plan.start || '—'}{getPlanEndLabel(plan) ? ` · Previsão: ${getPlanEndLabel(plan)}` : ''} · Duração: {getPlanDurationLabel(plan)}</small></button>{plan.row && <>{canComplete && <button className="plan-complete" aria-label={`Concluir ${plan.piece}`} onClick={() => onComplete(plan)}><CheckIcon /></button>}<button className="plan-copy" aria-label={`Duplicar ${plan.piece}`} onClick={() => onDuplicate(plan)}><CopyIcon /></button><button className="plan-delete" aria-label={`Apagar ${plan.piece}`} onClick={() => onDelete(plan)}><TrashIcon /></button></>}</article>
  })}</> : <p className="empty">Nenhuma impressão nesta etapa.</p>
}

function PlanningEditor({ draft, onChange, onSave, onCancel, onDelete }: { draft: PrintPlan; onChange: (plan: PrintPlan) => void; onSave: () => void; onCancel: () => void; onDelete: () => void }) {
  const predictedEnd = estimateEnd(draft)
  const numberChange = (field: 'quantity' | 'hours' | 'minutes' | 'pause' | 'pauseDuring') => (value: string) => onChange({ ...draft, [field]: Number(value.replace(/\D/g, '')) || 0 })
  return <><div className="planning-editor-heading"><h2>Detalhes do planejamento</h2><button type="button" className="planning-close" aria-label="Fechar planejamento" onClick={onCancel}>×</button></div><section className="form planning-editor-form"><p className="estimate">A ordem será definida automaticamente pelo horário de início.</p><label>Impressora<select value={draft.printer || 'Bambu A1'} onChange={e => onChange({ ...draft, printer: e.target.value })}>{printers.map(printer => <option key={printer}>{printer}</option>)}</select></label><label>Peça / lote<input value={draft.piece} onChange={e => onChange({ ...draft, piece: e.target.value })} /></label><label>Quantidade de objetos<input inputMode="numeric" pattern="[0-9]*" value={draft.quantity || ''} onChange={e => numberChange('quantity')(e.target.value)} /></label><label>Detalhes / cor<input value={draft.details} onChange={e => onChange({ ...draft, details: e.target.value })} /></label><div className="planning-duration-fields"><label>Horas<input inputMode="numeric" pattern="[0-9]*" value={draft.hours || ''} onChange={e => numberChange('hours')(e.target.value)} /></label><label>Minutos<input inputMode="numeric" pattern="[0-9]*" value={draft.minutes || ''} onChange={e => numberChange('minutes')(e.target.value)} /></label><label>Pausa antes (min)<input inputMode="numeric" pattern="[0-9]*" value={draft.pause || ''} onChange={e => numberChange('pause')(e.target.value)} /></label><label>Pausa durante (min)<input inputMode="numeric" pattern="[0-9]*" value={draft.pauseDuring || ''} onChange={e => numberChange('pauseDuring')(e.target.value)} /></label></div>{predictedEnd && <p className="estimate">Previsão de término: <strong>{predictedEnd}</strong></p>}<label>Ocorrência / motivo<input value={draft.occurrence} placeholder="Ex.: troca de filamento" onChange={e => onChange({ ...draft, occurrence: e.target.value })} /></label><div className="planning-footer-fields"><label>Início<input value={draft.start} onChange={e => onChange({ ...draft, start: e.target.value })} /></label><label>Status<select value={draft.status} onChange={e => onChange({ ...draft, status: e.target.value })}>{['Planejado', 'Em impressão', 'Pausado', 'Concluído', 'Cancelado'].map(status => <option key={status}>{status}</option>)}</select></label></div><div className="planning-editor-actions">{draft.row && <button type="button" className="delete-cancel" onClick={onDelete}>Apagar planejamento</button>}<button type="button" className="delete-cancel" onClick={onCancel}>Cancelar</button><button type="button" onClick={onSave}>Salvar planejamento</button></div></section></>
}

function TrashIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 13h10l1-13" /></svg> }
function CopyIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="1" /><path d="M15 9V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" /></svg> }
function CheckIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg> }
