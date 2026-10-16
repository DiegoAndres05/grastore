import { CATEGORIES, COLORS } from './catalog'
import { defaultAccounts } from './money'
import type { BookOrigin, Product, Sale, State } from '../types'

export const BOOK_VERSION = 7
export const STORAGE_KEY = 'grastore.v7'
const LEGACY_KEY = 'grastore.v6'

const SEED_PRODUCT_IDS = new Set(Array.from({ length: 22 }, (_, index) => `p${String(index + 1).padStart(2, '0')}`))

export function emptyState(): State {
  return {
    products: [],
    customers: [],
    suppliers: [],
    sales: [],
    purchases: [],
    collections: [],
    accounts: defaultAccounts(),
    movements: [],
    expenses: [],
    payables: [],
    payablePayments: [],
    capitalEvents: [],
    loans: [],
    loanPayments: [],
    layaways: [],
    returns: [],
    adjustments: [],
    investments: [],
    openingPnl: null,
    settings: { salarySharePct: 25, categories: [...CATEGORIES], colors: [...COLORS] },
    seq: { sale: 1, purchase: 1, layaway: 1, expense: 1 },
    meta: { origin: 'empty', importedAt: null },
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function hydrate(raw: unknown, origin?: BookOrigin): State {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  const source = raw as Partial<State>
  const products = asArray<Product>(source.products).map((product) => ({
    ...product,
    reserved: product.reserved ?? 0,
    location: product.location ?? '',
    brand: product.brand ?? '',
    design: product.design ?? '',
  }))
  const sales = asArray<Sale>(source.sales).map((sale) => ({
    ...sale,
    kind: sale.kind ?? 'retail',
    voided: sale.voided ?? false,
    affectsStock: sale.affectsStock ?? sale.kind !== 'opening',
    cashIn: sale.cashIn ?? (sale.method === 'credito' ? sale.paid : sale.total),
    accountId: sale.accountId ?? null,
    dueDate: sale.dueDate ?? null,
    lines: sale.lines.map((line) => ({ ...line, returnedQty: line.returnedQty ?? 0 })),
  }))
  const categories = source.settings?.categories?.length ? source.settings.categories : base.settings.categories
  const colors = source.settings?.colors?.length ? source.settings.colors : base.settings.colors
  const accounts = asArray<State['accounts'][number]>(source.accounts)
  return {
    ...base,
    ...source,
    products,
    customers: asArray(source.customers),
    suppliers: asArray(source.suppliers),
    sales,
    purchases: asArray(source.purchases),
    collections: asArray(source.collections),
    accounts: accounts.length ? accounts : base.accounts,
    movements: asArray(source.movements),
    expenses: asArray(source.expenses),
    payables: asArray(source.payables),
    payablePayments: asArray(source.payablePayments),
    capitalEvents: asArray(source.capitalEvents),
    loans: asArray(source.loans),
    loanPayments: asArray(source.loanPayments),
    layaways: asArray(source.layaways),
    returns: asArray(source.returns),
    adjustments: asArray(source.adjustments),
    investments: asArray(source.investments),
    openingPnl: source.openingPnl ?? null,
    settings: {
      salarySharePct: source.settings?.salarySharePct ?? 25,
      categories: [...categories],
      colors: [...colors],
    },
    seq: { ...base.seq, ...source.seq },
    meta: {
      origin: origin ?? source.meta?.origin ?? 'restore',
      importedAt: source.meta?.importedAt ?? null,
    },
  }
}

export function isDemoBook(state: State) {
  if (state.meta.origin === 'import' || state.meta.origin === 'restore') return false
  if (state.products.length === 0) return false
  return state.products.every((product) => SEED_PRODUCT_IDS.has(product.id)) && state.sales.every((sale) => sale.id.startsWith('sale-'))
}

export function bookIsEmpty(state: State) {
  return (
    state.products.length === 0 &&
    state.customers.length === 0 &&
    state.sales.length === 0 &&
    state.purchases.length === 0 &&
    state.expenses.length === 0 &&
    state.payables.length === 0 &&
    state.investments.length === 0 &&
    state.layaways.length === 0 &&
    state.loans.length === 0 &&
    state.movements.length === 0 &&
    state.suppliers.length === 0
  )
}

export function bookHasRealData(state: State) {
  if (state.meta.origin === 'import' || state.meta.origin === 'restore') return true
  if (isDemoBook(state) || bookIsEmpty(state)) return false
  return true
}

export function loadLocal(): State {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) {
      const parsed = JSON.parse(current) as { version?: number; state?: unknown }
      if (parsed.version === BOOK_VERSION && parsed.state) {
        const state = hydrate(parsed.state)
        if (import.meta.env.PROD && isDemoBook(state)) return emptyState()
        return state
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as { version?: number; state?: unknown }
      if (parsed.state) {
        const state = hydrate(parsed.state, 'seed')
        if (import.meta.env.PROD && isDemoBook(state)) return emptyState()
        return state
      }
    }
  } catch {
    return emptyState()
  }
  return emptyState()
}

export function saveLocal(state: State) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: BOOK_VERSION, state }))
}

export function backupPayload(state: State) {
  return { version: BOOK_VERSION, exportedAt: new Date().toISOString(), app: 'grastore', state }
}

export function parseBackup(raw: string) {
  const parsed = JSON.parse(raw) as { version?: number; state?: unknown }
  const source = parsed && typeof parsed === 'object' && 'state' in parsed ? parsed.state : parsed
  if (!source || typeof source !== 'object' || !Array.isArray((source as { products?: unknown }).products)) {
    throw new Error('Ese archivo no es un respaldo de GraStore')
  }
  return hydrate(source, 'restore')
}
