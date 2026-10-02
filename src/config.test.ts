import { describe, expect, it } from 'vitest'
import { getAppConfig } from './config'

describe('getAppConfig', () => {
  it('informa a variável ausente quando não há URL do Apps Script', () => {
    expect(() => getAppConfig({})).toThrow('VITE_APPS_SCRIPT_URL')
  })

  it('retorna a configuração fornecida', () => {
    expect(getAppConfig({ VITE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/abc/exec' })).toEqual({
      appsScriptUrl: 'https://script.google.com/macros/s/abc/exec',
    })
  })
})
