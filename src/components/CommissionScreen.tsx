import { useEffect, useMemo, useState } from 'react'
import './commission.css'
import type { Quote, QuoteItem } from '../domain/quote'
import { calculateCommissionValues, type CommissionEntry, type CommissionStatus } from '../domain/commission'
import { createCommissionRepository } from '../data/commissionRepository'
import { SessionExpiredError } from '../data/appsScriptClient'
import { formatMoneyInput } from '../domain/money'

export function CommissionScreen({ quotes, appsScriptUrl, token, onSessionExpired }: { quotes: Quote[]; appsScriptUrl: string; token: string; onSessionExpired: () => void }) {
  const availableQuotes = quotes.filter(quote => quote.status !== 'Entregue')
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [selectedQuoteId, setSelectedQuoteId] = useState(() => availableQuotes[0]?.id || '')
  const [selectedItemId, setSelectedItemId] = useState(() => availableQuotes[0]?.items[0]?.id || '')
  const [baseUnitPrice, setBaseUnitPrice] = useState(0)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<CommissionEntry | null>(null)
  const repository = useMemo(() => createCommissionRepository(appsScriptUrl, token), [appsScriptUrl, token])
  const selectedQuote = availableQuotes.find(quote => quote.id === selectedQuoteId)
  const selectedItem = selectedQuote?.items.find(item => item.id === selectedItemId)
  const values = selectedItem ? calculateCommissionValues(selectedItem.quantity, selectedItem.unitPrice, baseUnitPrice) : null
  const pendingTotal = entries.filter(entry => entry.status === 'Não pago').reduce((total, entry) => total + entry.commission, 0)
  const paidTotal = entries.filter(entry => entry.status === 'Pago').reduce((total, entry) => total + entry.commission, 0)

  useEffect(() => {
    repository.getEntries().then(setEntries).catch(error => {
      if (error instanceof SessionExpiredError) onSessionExpired()
      else setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as comissões.')
    })
  }, [repository, onSessionExpired])

  useEffect(() => {
    const quote = availableQuotes.find(item => item.id === selectedQuoteId) || availableQuotes[0]
    if (!quote) return
    if (quote.id !== selectedQuoteId) setSelectedQuoteId(quote.id)
    if (!quote.items.some(item => item.id === selectedItemId)) setSelectedItemId(quote.items[0]?.id || '')
  }, [availableQuotes, selectedQuoteId, selectedItemId])

  const chooseQuote = (quoteId: string) => {
    const quote = availableQuotes.find(item => item.id === quoteId)
    setSelectedQuoteId(quoteId)
    setSelectedItemId(quote?.items[0]?.id || '')
  }

  const save = async () => {
    if (!selectedQuote || !selectedItem || baseUnitPrice < 0) return
    setSaving(true)
    setMessage('')
    try {
      const calculated = calculateCommissionValues(selectedItem.quantity, selectedItem.unitPrice, baseUnitPrice)
      const saved = await repository.saveEntry({ id: crypto.randomUUID(), quoteId: selectedQuote.id, client: selectedQuote.client, itemId: selectedItem.id, itemDescription: selectedItem.description, quantity: selectedItem.quantity, saleUnitPrice: selectedItem.unitPrice, baseUnitPrice, ...calculated, status: 'Não pago', createdAt: new Date().toISOString() })
      setEntries(current => [saved, ...current])
      setBaseUnitPrice(0)
      setMessage('Comissão adicionada.')
    } catch (error) {
      if (error instanceof SessionExpiredError) onSessionExpired()
      else setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a comissão.')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (entry: CommissionEntry) => {
    const status: CommissionStatus = entry.status === 'Pago' ? 'Não pago' : 'Pago'
    try {
      const updated = await repository.updateStatus(entry.id, status)
      setEntries(current => current.map(item => item.id === updated.id ? updated : item))
    } catch (error) {
      if (error instanceof SessionExpiredError) onSessionExpired()
      else setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o status.')
    }
  }

  const remove = async () => {
    if (!entryToDelete) return
    setSaving(true)
    try {
      await repository.deleteEntry(entryToDelete.id)
      setEntries(current => current.filter(entry => entry.id !== entryToDelete.id))
      setEntryToDelete(null)
      setMessage('Comissão apagada.')
    } catch (error) {
      if (error instanceof SessionExpiredError) onSessionExpired()
      else setMessage(error instanceof Error ? error.message : 'Não foi possível apagar a comissão.')
    } finally {
      setSaving(false)
    }
  }

  const deletionDialog = entryToDelete && <div className="delete-dialog-backdrop"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-commission-title"><h2 id="delete-commission-title">Apagar comissão de {entryToDelete.client || 'cliente'}?</h2><p>Esse lançamento será removido da planilha.</p><div className="delete-dialog-actions"><button className="delete-cancel" disabled={saving} onClick={() => setEntryToDelete(null)}>Cancelar</button><button className="delete-confirm" disabled={saving} onClick={() => void remove()}>Apagar</button></div></section></div>

  return <><header className="commission-header"><div><h1>Comissão</h1><p>Registre o custo-base por unidade e acompanhe o pagamento da vendedora.</p></div></header><div className="commission-totals"><strong>A pagar: {formatMoneyInput(pendingTotal)}</strong><strong>Pago: {formatMoneyInput(paidTotal)}</strong></div><section className="commission-form"><h2>Adicionar comissão</h2><label>Orçamento<select aria-label="Orçamento" value={selectedQuoteId} onChange={event => chooseQuote(event.target.value)}><option value="">Selecione um orçamento</option>{availableQuotes.map(quote => <option key={quote.id} value={quote.id}>{quote.client || 'Sem cliente'}</option>)}</select></label><label>Produto<select aria-label="Produto" value={selectedItemId} onChange={event => setSelectedItemId(event.target.value)} disabled={!selectedQuote}><option value="">Selecione um produto</option>{selectedQuote?.items.map(item => <option key={item.id} value={item.id}>{item.description || 'Sem nome'} · {item.quantity} un.</option>)}</select></label>{selectedItem && <><label>Valor de venda unitário<input aria-label="Valor de venda unitário" type="number" value={selectedItem.unitPrice} readOnly /></label><label>Custo-base unitário<input aria-label="Custo-base unitário" type="number" min="0" step="0.01" value={baseUnitPrice} onChange={event => setBaseUnitPrice(Number(event.target.value))} /></label><div className="commission-preview"><span>Venda: {formatMoneyInput(values?.saleTotal || 0)}</span><span>Custo: {formatMoneyInput(values?.costTotal || 0)}</span><span>Lucro: {formatMoneyInput(values?.profit || 0)}</span><strong>Comissão: {formatMoneyInput(values?.commission || 0)}</strong></div><button type="button" disabled={saving} onClick={save}>{saving ? 'Salvando…' : 'Adicionar comissão'}</button></>}{message && <p className="message" role="status">{message}</p>}</section><section className="commission-list"><div className="commission-list-heading"><strong>Lançamentos</strong><span>{entries.length} registrado{entries.length === 1 ? '' : 's'}</span></div>{entries.length ? entries.map(entry => <article key={entry.id} className="commission-item"><div><b>{entry.client || 'Sem cliente'} · {entry.itemDescription || 'Sem produto'}</b><small>{entry.quantity} un. · Venda unitária {formatMoneyInput(entry.saleUnitPrice)} · Custo unitário {formatMoneyInput(entry.baseUnitPrice)}</small></div><dl><div><dt>Lucro</dt><dd>{formatMoneyInput(entry.profit)}</dd></div><div className="commission-value"><dt>Comissão</dt><dd>{formatMoneyInput(entry.commission)}</dd></div></dl><div style={{ display: 'flex', gap: 8 }}><button type="button" className={`commission-status ${entry.status === 'Pago' ? 'paid' : ''}`} onClick={() => void changeStatus(entry)}>{entry.status}</button><button type="button" aria-label={`Apagar comissão de ${entry.client || 'cliente'}`} style={{ width: 'auto', margin: 0, padding: '8px 12px', border: '1px solid #f2c5d8', borderRadius: 999, background: '#fff', color: '#b2215a', fontSize: 13 }} onClick={() => setEntryToDelete(entry)}>Apagar</button></div></article>) : <p className="empty">Nenhuma comissão registrada.</p>}</section>{deletionDialog}</>
}
