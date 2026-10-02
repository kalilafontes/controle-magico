export class SessionExpiredError extends Error {
  constructor(message = 'Sua sessão não é mais válida. Entre novamente.') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; code?: string; message?: string }

export function createAppsScriptClient(url: string, getSession: () => string | null) {
  const request = async <T>(action: string, payload: object = {}): Promise<T> => {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: getSession() || undefined, payload }),
      })
    } catch {
      throw new Error('Não foi possível conectar à planilha. Tente novamente.')
    }
    if (!response.ok) throw new Error('Não foi possível conectar à planilha. Tente novamente.')
    const body = await response.json() as ApiEnvelope<T>
    if (body.ok) return body.data
    if (body.code === 'UNAUTHORIZED' || body.code === 'INACTIVE') throw new SessionExpiredError(body.message)
    throw new Error(body.message || 'Não foi possível concluir a operação na planilha.')
  }
  return { request }
}
