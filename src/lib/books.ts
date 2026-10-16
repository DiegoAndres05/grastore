import type {
  CashAccount,
  CashMethod,
  CashMovement,
  Collection,
  MovementKind,
  PayMethod,
  Payable,
  PayableKind,
  Product,
  Purchase,
  Sale,
  State,
} from '../types'

export const ACCOUNTS: CashAccount[] = ['efectivo', 'nequi', 'bancolombia', 'tarjeta']

export const ACCOUNT_LABEL: Record<CashAccount, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  bancolombia: 'Bancolombia',
  tarjeta: 'Tarjeta',
}

export const PAYABLE_LABEL: Record<PayableKind, string> = {
  mercancia: 'Mercancía',
  servicio: 'Servicio',
  sueldo: 'Sueldo',
  otro: 'Otro',
}

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  venta: 'Venta',
  abono: 'Abono',
  compra: 'Compra',
  pago: 'Pago',
  gasto: 'Gasto',
  retiro: 'Retiro',
  transferencia: 'Transferencia',
  devolucion: 'Devolución',
  apertura: 'Saldo inicial',
}

export function accountForMethod(method: PayMethod): CashAccount | null {
  if (method === 'efectivo') return 'efectivo'
  if (method === 'tarjeta') return 'tarjeta'
  if (method === 'transferencia') return 'nequi'
  return null
}

export function methodForAccount(account: CashAccount): CashMethod {
  if (account === 'tarjeta') return 'tarjeta'
  if (account === 'efectivo') return 'efectivo'
  return 'transferencia'
}

export function makeMovement(input: Omit<CashMovement, 'id'> & { id?: string }): CashMovement {
  return {
    id: input.id ?? crypto.randomUUID(),
    date: input.date,
    account: input.account,
    direction: input.direction,
    amount: input.amount,
    kind: input.kind,
    concept: input.concept,
    refId: input.refId,
  }
}

export function accountBalances(movements: CashMovement[]) {
  const balances: Record<CashAccount, number> = { efectivo: 0, nequi: 0, bancolombia: 0, tarjeta: 0 }
  for (const movement of movements) {
    balances[movement.account] += movement.direction === 'in' ? movement.amount : -movement.amount
  }
  return balances
}

export function cashTotal(movements: CashMovement[]) {
  return Object.values(accountBalances(movements)).reduce((sum, value) => sum + value, 0)
}

export function inventoryValue(products: Product[]) {
  return products.filter((product) => product.active).reduce((sum, product) => sum + product.stock * product.cost, 0)
}

export function receivableTotal(sales: Sale[]) {
  return sales.filter((sale) => sale.status !== 'devuelta').reduce((sum, sale) => sum + sale.balance, 0)
}

export function payableTotal(payables: Payable[]) {
  return payables.reduce((sum, payable) => sum + payable.balance, 0)
}

export function balanceSheet(state: State) {
  const accounts = accountBalances(state.movements)
  const cash = Object.values(accounts).reduce((sum, value) => sum + value, 0)
  const receivable = receivableTotal(state.sales)
  const inventory = inventoryValue(state.products)
  const payable = payableTotal(state.payables)
  const assets = cash + receivable + inventory
  return { accounts, cash, receivable, inventory, payable, assets, equity: assets - payable }
}

function inRange(iso: string, start: Date, end: Date) {
  const time = new Date(iso).getTime()
  return time >= start.getTime() && time < end.getTime()
}

function lineCost(sale: Sale) {
  return sale.lines.reduce((sum, line) => sum + line.cost * line.qty, 0)
}

export function periodResult(state: State, start: Date, end: Date) {
  const billed = state.sales.filter((sale) => inRange(sale.date, start, end))
  const reversed = state.sales.filter((sale) => sale.returnedAt && inRange(sale.returnedAt, start, end))
  const sales = billed.reduce((sum, sale) => sum + sale.total, 0) - reversed.reduce((sum, sale) => sum + sale.total, 0)
  const cost = billed.reduce((sum, sale) => sum + lineCost(sale), 0) - reversed.reduce((sum, sale) => sum + lineCost(sale), 0)
  const units = billed.reduce((sum, sale) => sum + sale.lines.reduce((qty, line) => qty + line.qty, 0), 0)
    - reversed.reduce((sum, sale) => sum + sale.lines.reduce((qty, line) => qty + line.qty, 0), 0)
  const cashExpenses = state.movements
    .filter((movement) => movement.kind === 'gasto' && movement.direction === 'out' && inRange(movement.date, start, end))
    .reduce((sum, movement) => sum + movement.amount, 0)
  const accrued = state.payables
    .filter((payable) => payable.kind !== 'mercancia' && inRange(payable.date, start, end))
    .reduce((sum, payable) => sum + payable.total, 0)
  const withdrawals = state.movements
    .filter((movement) => movement.kind === 'retiro' && movement.direction === 'out' && inRange(movement.date, start, end))
    .reduce((sum, movement) => sum + movement.amount, 0)
  const expenses = cashExpenses + accrued
  return {
    sales,
    cost,
    gross: sales - cost,
    expenses,
    net: sales - cost - expenses,
    withdrawals,
    units,
    tickets: billed.length,
  }
}

export function lineNets(sale: Sale) {
  const gross = sale.lines.map((line) => line.price * line.qty)
  const subtotal = gross.reduce((sum, value) => sum + value, 0)
  if (subtotal <= 0 || sale.discount <= 0) return gross
  let pending = sale.discount
  return gross.map((value, index) => {
    if (index === gross.length - 1) return value - pending
    const share = Math.round((sale.discount * value) / subtotal)
    pending -= share
    return value - share
  })
}

export function collectedByAccount(movements: CashMovement[], start: Date, end: Date) {
  const totals = new Map<CashAccount, number>()
  for (const movement of movements) {
    if (movement.direction !== 'in') continue
    if (movement.kind !== 'venta' && movement.kind !== 'abono') continue
    if (!inRange(movement.date, start, end)) continue
    totals.set(movement.account, (totals.get(movement.account) ?? 0) + movement.amount)
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])
}

type LooseSale = Partial<Sale> & Pick<Sale, 'id' | 'number' | 'date' | 'lines' | 'total' | 'method' | 'paid' | 'balance'>
type LoosePurchase = Partial<Purchase> & Pick<Purchase, 'id' | 'total'>
type LooseCollection = Partial<Collection> & Pick<Collection, 'id' | 'method' | 'amount'>

function saleAccount(sale: LooseSale): CashAccount | null {
  if (sale.account !== undefined) return sale.account
  if ((sale.downPaid ?? sale.paid) <= 0) return null
  if (sale.method === 'credito') return 'efectivo'
  return accountForMethod(sale.method)
}

export function normalizeState(raw: Partial<State> & { products: Product[]; sales: Sale[] }): State {
  const sales = (raw.sales as LooseSale[]).map((sale) => {
    const downPaid = sale.downPaid ?? sale.paid
    return {
      customerId: null,
      customerName: 'Mostrador',
      discount: 0,
      tendered: null,
      note: '',
      ...sale,
      account: saleAccount(sale),
      downPaid,
      status: sale.status ?? 'activa',
      returnedAt: sale.returnedAt ?? null,
    } as Sale
  })

  const collections = ((raw.collections ?? []) as LooseCollection[]).map((collection) => {
    const account = collection.account ?? (collection.method === 'tarjeta' ? 'tarjeta' : collection.method === 'transferencia' ? 'nequi' : 'efectivo')
    return {
      date: new Date().toISOString(),
      customerId: '',
      customerName: '',
      note: '',
      saleId: null,
      ...collection,
      account,
      applications: collection.applications ?? [],
    } as Collection
  })

  const purchases = ((raw.purchases ?? []) as LoosePurchase[]).map((purchase) => ({
    number: '',
    date: new Date().toISOString(),
    supplierId: '',
    supplierName: '',
    lines: [],
    note: '',
    ...purchase,
    paid: purchase.paid ?? purchase.total,
    balance: purchase.balance ?? 0,
    account: purchase.account === undefined ? null : purchase.account,
  })) as Purchase[]

  const movements = raw.movements ?? sales
    .filter((sale) => sale.downPaid > 0 && sale.account)
    .map((sale) => makeMovement({
      id: `mov-${sale.id}`,
      date: sale.date,
      account: sale.account as CashAccount,
      direction: 'in',
      amount: sale.downPaid,
      kind: 'venta',
      concept: `Venta ${sale.number}`,
      refId: sale.id,
    }))

  return {
    products: raw.products,
    customers: raw.customers ?? [],
    suppliers: raw.suppliers ?? [],
    sales,
    purchases,
    collections,
    movements,
    payables: raw.payables ?? [],
    seq: {
      sale: raw.seq?.sale ?? 1000 + sales.length,
      purchase: raw.seq?.purchase ?? 180 + purchases.length,
      payable: raw.seq?.payable ?? 1 + (raw.payables?.length ?? 0),
    },
  }
}
