import { isRetailSale } from './format'
import { accountBalance } from './money'
import type { State } from '../types'

export type Range = { from: string; to: string }

function dayStart(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000-05:00`).getTime()
}

function dayEnd(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999-05:00`).getTime()
}

function inRange(iso: string, range: Range) {
  const time = new Date(iso).getTime()
  return time >= dayStart(range.from) && time <= dayEnd(range.to)
}

export function inventoryValue(state: State) {
  const garments = state.products.reduce((sum, product) => sum + product.cost * product.stock, 0)
  const investments = state.investments.reduce((sum, item) => sum + Math.max(0, item.amount - item.allocated), 0)
  return { garments, investments, total: garments + investments }
}

export function receivables(state: State) {
  const credit = state.customers.reduce((sum, customer) => sum + customer.balance, 0)
  const layaways = state.layaways.filter((item) => item.status === 'abierto').reduce((sum, item) => sum + item.balance, 0)
  const loans = state.loans.reduce((sum, loan) => sum + loan.balance, 0)
  return { credit, layaways, loans, total: credit + layaways + loans }
}

export function payablesTotal(state: State) {
  return state.payables.reduce((sum, payable) => sum + payable.balance, 0)
}

export function balanceSheet(state: State) {
  const accounts = state.accounts
    .filter((account) => account.active)
    .map((account) => ({ id: account.id, name: account.name, balance: accountBalance(state, account.id) }))
  const cash = accounts.reduce((sum, account) => sum + account.balance, 0)
  const inventory = inventoryValue(state)
  const receivable = receivables(state)
  const liabilities = payablesTotal(state)
  const assets = cash + inventory.total + receivable.total
  return {
    accounts,
    cash,
    inventory,
    receivable,
    assets,
    liabilities,
    equity: assets - liabilities,
  }
}

function openingInRange(state: State, range: Range) {
  if (!state.openingPnl) return null
  return inRange(`${state.openingPnl.asOf}T12:00:00.000-05:00`, range) ? state.openingPnl : null
}

export function profitAndLoss(state: State, range: Range) {
  const sales = state.sales.filter((sale) => isRetailSale(sale) && inRange(sale.date, range))
  const returns = state.returns.filter((item) => inRange(item.date, range))
  const grossSales = sales.reduce((sum, sale) => sum + sale.total, 0)
  const returnSales = returns.reduce((sum, item) => sum + item.amount, 0)
  const cogs = sales.reduce((sum, sale) => sum + sale.lines.reduce((cost, line) => cost + line.cost * line.qty, 0), 0)
  const returnCost = returns.reduce((sum, item) => sum + item.lines.reduce((cost, line) => cost + line.cost * line.qty, 0), 0)
  const opening = openingInRange(state, range)
  const netSales = grossSales - returnSales + (opening?.sales ?? 0)
  const netCogs = cogs - returnCost + (opening?.cogs ?? 0)
  const expenses = state.expenses.filter((expense) => inRange(expense.date, range))
  const byCategory = new Map<string, number>()
  for (const expense of expenses) byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount)
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const grossProfit = netSales - netCogs
  const profit = grossProfit - expenseTotal
  const units =
    sales.reduce((sum, sale) => sum + sale.lines.reduce((qty, line) => qty + line.qty - (line.returnedQty ?? 0), 0), 0)
  return {
    grossSales,
    returnSales,
    openingSales: opening?.sales ?? 0,
    openingCogs: opening?.cogs ?? 0,
    netSales,
    cogs: netCogs,
    grossProfit,
    expenses: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    expenseTotal,
    profit,
    units,
    margin: netSales > 0 ? profit / netSales : 0,
  }
}

export function monthlyClose(state: State, year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const last = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  const report = profitAndLoss(state, { from, to })
  const share = Math.min(100, Math.max(0, state.settings.salarySharePct))
  return {
    ...report,
    from,
    to,
    salarySharePct: share,
    salaryShare: Math.round(report.profit * (share / 100)),
  }
}

export function dailyReport(state: State, range: Range) {
  const cursor = new Date(`${range.from}T12:00:00.000-05:00`)
  const end = new Date(`${range.to}T12:00:00.000-05:00`)
  const rows: { date: string; sales: number; cogs: number; expenses: number; profit: number; units: number }[] = []
  while (cursor.getTime() <= end.getTime()) {
    const date = cursor.toISOString().slice(0, 10)
    const report = profitAndLoss(state, { from: date, to: date })
    rows.push({ date, sales: report.netSales, cogs: report.cogs, expenses: report.expenseTotal, profit: report.profit, units: report.units })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return rows
}

export type CutoffRow = { label: string; amount: number; count: number }

export function cutoffSummary(state: State): CutoffRow[] {
  const groups = new Map<string, CutoffRow>()
  const add = (label: string, amount: number) => {
    const current = groups.get(label) ?? { label, amount: 0, count: 0 }
    current.amount += amount
    current.count += 1
    groups.set(label, current)
  }
  for (const sale of state.sales) {
    if (sale.voided || sale.balance <= 0) continue
    add(sale.dueDate ? `Corte ${sale.dueDate}` : 'Sin fecha', sale.balance)
  }
  for (const layaway of state.layaways) {
    if (layaway.status !== 'abierto' || layaway.balance <= 0) continue
    add('Plan separe', layaway.balance)
  }
  for (const loan of state.loans) {
    if (loan.balance <= 0) continue
    add('Préstamo', loan.balance)
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))
}
