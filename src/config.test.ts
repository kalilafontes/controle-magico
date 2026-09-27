import { describe, expect, it } from 'vitest'
import { getAppConfig } from './config'

describe('getAppConfig', () => {
  it('informa a variável ausente quando não há client ID', () => {
    expect(() => getAppConfig({})).toThrow('VITE_GOOGLE_CLIENT_ID')
  })

  it('retorna a configuração fornecida', () => {
    expect(getAppConfig({ VITE_GOOGLE_CLIENT_ID: 'id', VITE_GOOGLE_SPREADSHEET_ID: 'planilha' })).toEqual({
      googleClientId: 'id',
      spreadsheetId: 'planilha',
    })
  })
})
