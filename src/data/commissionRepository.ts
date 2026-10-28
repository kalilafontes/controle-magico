import type { CommissionEntry, CommissionStatus } from '../domain/commission'
import { createAppsScriptClient } from './appsScriptClient'

export function createCommissionRepository(appsScriptUrl: string, token: string) {
  const api = createAppsScriptClient(appsScriptUrl, () => token)
  const getEntries = () => api.request<CommissionEntry[]>('commissions.list')
  const saveEntry = (entry: CommissionEntry) => api.request<CommissionEntry>('commissions.save', { entry })
  const updateStatus = (id: string, status: CommissionStatus) => api.request<CommissionEntry>('commissions.status', { id, status })
  const deleteEntry = (id: string) => api.request<boolean>('commissions.delete', { id })
  return { getEntries, saveEntry, updateStatus, deleteEntry }
}
