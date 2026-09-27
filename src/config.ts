export interface AppConfig {
  googleClientId: string
  spreadsheetId: string
}

type Environment = Record<string, string | undefined>

export function getAppConfig(env: Environment = import.meta.env): AppConfig {
  const googleClientId = env.VITE_GOOGLE_CLIENT_ID
  const spreadsheetId = env.VITE_GOOGLE_SPREADSHEET_ID

  if (!googleClientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID não configurada.')
  }

  if (!spreadsheetId) {
    throw new Error('VITE_GOOGLE_SPREADSHEET_ID não configurada.')
  }

  return { googleClientId, spreadsheetId }
}
