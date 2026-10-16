import type { Account, Actor, Movement, MovementKind, PayMethod, Product, State } from '../types'

export function moneyOf(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

export function uid() {
  return crypto.randomUUID()
}

export function stamp(actor?: Actor | null) {
  return { createdBy: actor?.id ?? null, createdByName: actor?.name ?? null }
}

export function coerceWhen(input?: string | null, fallback = new Date()) {
  if (!input) return fallback.toISOString()
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return `${input}T12:00:00.000-05:00`
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return fallback.toISOString()
  return parsed.toISOString()
}

export function availableUnits(product: Product) {
  return product.stock - (product.reserved ?? 0)
}

export function accountBalance(state: State, accountId: string) {
  const account = state.accounts.find((item) => item.id === accountId)
  if (!account) return 0
  return state.movements
    .filter((movement) => movement.accountId === accountId)
    .reduce((sum, movement) => sum + (movement.direction === 'in' ? movement.amount : -movement.amount), account.openingBalance)
}

export function accountForMethod(state: State, method: PayMethod) {
  const wanted = method === 'efectivo' ? 'efectivo' : method === 'nequi' || method === 'transferencia' ? 'nequi' : method === 'bancolombia' ? 'bancolombia' : null
  if (!wanted) return null
  return state.accounts.find((account) => account.active && account.name.trim().toLowerCase() === wanted) ?? null
}

export function withMovement(
  state: State,
  input: {
    date: string
    accountId: string
    kind: MovementKind
    direction: 'in' | 'out'
    amount: number
    counterparty: string
    note: string
    refId: string | null
    actor?: Actor | null
  },
): State {
  const amount = moneyOf(input.amount)
  if (amount <= 0) return state
  const movement: Movement = {
    id: uid(),
    date: input.date,
    accountId: input.accountId,
    kind: input.kind,
    direction: input.direction,
    amount,
    counterparty: input.counterparty,
    note: input.note,
    refId: input.refId,
    ...stamp(input.actor),
  }
  return { ...state, movements: [movement, ...state.movements] }
}

export function ledgerRows(state: State, accountId: string) {
  const account = state.accounts.find((item) => item.id === accountId)
  const opening = account?.openingBalance ?? 0
  const ordered = state.movements
    .filter((movement) => movement.accountId === accountId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  let balance = opening
  return ordered.map((movement) => {
    balance += movement.direction === 'in' ? movement.amount : -movement.amount
    return { ...movement, balance }
  })
}

export function cashTotal(state: State) {
  return state.accounts.filter((account) => account.active).reduce((sum, account) => sum + accountBalance(state, account.id), 0)
}

export function defaultAccounts(): Account[] {
  return [
    { id: 'acct-efectivo', name: 'Efectivo', kind: 'cash', openingBalance: 0, active: true },
    { id: 'acct-nequi', name: 'Nequi', kind: 'wallet', openingBalance: 0, active: true },
    { id: 'acct-bancolombia', name: 'Bancolombia', kind: 'bank', openingBalance: 0, active: true },
  ]
}
