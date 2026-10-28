import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCommissionRepository } from './commissionRepository'
import type { CommissionEntry } from '../domain/commission'

const entry: CommissionEntry = { id: 'com-1', quoteId: 'orc-1', client: 'Kalila', itemId: 'item-1', itemDescription: 'Vaso', quantity: 2, saleUnitPrice: 30, baseUnitPrice: 12, saleTotal: 60, costTotal: 24, profit: 36, commission: 9, status: 'Não pago', createdAt: '2026-10-15T12:00:00.000Z' }
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response

describe('createCommissionRepository', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lista os lançamentos de comissão pelo Web App', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: [entry] }))
    await expect(createCommissionRepository('https://script/exec', 'sessão').getEntries()).resolves.toEqual([entry])
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'commissions.list', token: 'sessão' })
  })

  it('salva um lançamento e atualiza o status pelo Web App', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: entry }))
    const repository = createCommissionRepository('https://script/exec', 'sessão')
    await repository.saveEntry(entry)
    await repository.updateStatus(entry.id, 'Pago')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'commissions.save', payload: { entry } })
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ action: 'commissions.status', payload: { id: entry.id, status: 'Pago' } })
  })

  it('remove um lançamento pelo Web App', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ok: true, data: true }))
    await createCommissionRepository('https://script/exec', 'sessão').deleteEntry(entry.id)

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'commissions.delete', payload: { id: entry.id } })
  })
})
