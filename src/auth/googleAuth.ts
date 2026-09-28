declare global {
  interface Window { google?: { accounts: { oauth2: { initTokenClient: (options: Record<string, unknown>) => { requestAccessToken: (options?: Record<string, unknown>) => void } } } } }
}

export function toAuthErrorMessage(status: number) {
  if (status === 401) return 'Sua sessão expirou. Entre novamente.'
  if (status === 403) return 'Esta conta não possui acesso à planilha. Peça ao administrador para liberar o acesso à planilha.'
  return 'Não foi possível entrar com Google. Tente novamente.'
}

export function getSavedToken() {
  const saved = localStorage.getItem('orcamentos-token') || sessionStorage.getItem('orcamentos-token')
  if (!saved) return null
  const token = JSON.parse(saved) as { value: string; expiresAt: number }
  if (token.expiresAt <= Date.now()) { localStorage.removeItem('orcamentos-token'); sessionStorage.removeItem('orcamentos-token'); return null }
  return token.value
}

export function signInWithGoogle(clientId: string, silent = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const begin = () => window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (response: { access_token?: string; expires_in?: number; error?: string }) => { if (!response.access_token) return reject(new Error(response.error || 'Login cancelado')); const saved = JSON.stringify({ value: response.access_token, expiresAt: Date.now() + (response.expires_in || 3600) * 1000 }); localStorage.setItem('orcamentos-token', saved); sessionStorage.setItem('orcamentos-token', saved); resolve(response.access_token) },
    }).requestAccessToken({ prompt: silent ? '' : 'consent' })
    if (window.google) return begin()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = begin
    script.onerror = () => reject(new Error('Não foi possível carregar o login Google.'))
    document.head.append(script)
  })
}
