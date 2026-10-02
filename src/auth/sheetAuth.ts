import { createAppsScriptClient } from '../data/appsScriptClient'

export type SheetSession = { token: string; name: string }
const sessionKey = 'controle-sheet-session'

export const getSavedSession = (): SheetSession | null => {
  const saved = localStorage.getItem(sessionKey)
  if (!saved) return null
  try {
    const session = JSON.parse(saved) as Partial<SheetSession>
    return typeof session.token === 'string' && typeof session.name === 'string' ? { token: session.token, name: session.name } : null
  } catch { return null }
}

export const saveSession = (session: SheetSession) => localStorage.setItem(sessionKey, JSON.stringify(session))
export const clearSavedSession = () => localStorage.removeItem(sessionKey)

export const loginWithSheet = async (url: string, email: string, password: string): Promise<SheetSession> => {
  const result = await createAppsScriptClient(url, () => null).request<Partial<SheetSession>>('login', { email, password })
  if (!result.token || !result.name) throw new Error('Não foi possível entrar. Tente novamente.')
  const session = { token: result.token, name: result.name }
  saveSession(session)
  return session
}

export const logoutWithSheet = async (url: string, token: string) => {
  try { await createAppsScriptClient(url, () => token).request<boolean>('logout') } finally { clearSavedSession() }
}
