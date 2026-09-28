export function formatMoneyInput(value: number) {
  return Math.max(0, value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace('\u00a0', ' ')
}

export function parseMoneyInput(value: string) {
  const raw = value.replace(/R\$|\s/g, '')
  if (!raw) return 0
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw
  return Number(normalized) || 0
}
