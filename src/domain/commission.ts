export type CommissionStatus = 'Não pago' | 'Pago'

export interface CommissionEntry {
  id: string
  quoteId: string
  client: string
  itemId: string
  itemDescription: string
  quantity: number
  saleUnitPrice: number
  baseUnitPrice: number
  saleTotal: number
  costTotal: number
  profit: number
  commission: number
  status: CommissionStatus
  createdAt: string
}

export function calculateCommissionValues(quantity: number, saleUnitPrice: number, baseUnitPrice: number) {
  const validQuantity = Math.max(0, quantity)
  const validSaleUnitPrice = Math.max(0, saleUnitPrice)
  const validBaseUnitPrice = Math.max(0, baseUnitPrice)
  const saleTotal = validQuantity * validSaleUnitPrice
  const costTotal = validQuantity * validBaseUnitPrice
  const profit = costTotal * 0.5
  const commission = profit * 0.25 + (saleTotal - costTotal) * 0.5
  return { saleTotal, costTotal, profit, commission }
}
