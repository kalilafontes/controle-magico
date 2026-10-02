export interface AppConfig {
  appsScriptUrl: string
}

type Environment = Record<string, string | undefined>

export function getAppConfig(env: Environment = import.meta.env): AppConfig {
  const appsScriptUrl = env.VITE_APPS_SCRIPT_URL

  if (!appsScriptUrl) {
    throw new Error('VITE_APPS_SCRIPT_URL não configurada.')
  }

  return { appsScriptUrl }
}
