import { describe, expect, it } from 'vitest'
import { balanceSheet, monthlyClose, profitAndLoss } from './accounting'
import { emptyState } from './book'
import {
  applyCapital,
  applyExpense,
  applyLayaway,
  applyLoan,
  applyPayable,
  applyPayPayable,
  applyReturn,
  applyTransfer,
  applyUpdateSale,
  applyVoidSale,
} from './books'
import { applyCheckout, applyCollection, applyCustomer, applyProduct } from './logic'
import { accountBalance } from './money'
import type { State } from '../types'

function book(): State {
  let state = emptyState()
  const product = applyProduct(state, {
    sku: 'GR-1',
    name: 'Sueter negro',
    category: 'Sueter',
    color: 'Negro',
    size: 'L',
    cost: 50_000,
    price: 90_000,
    stock: 4,
    minStock: 1,
  })
  if (!product.ok) throw new Error(product.error)
  state = product.data.state
  const customer = applyCustomer(state, { name: 'Ana', phone: '', email: '', city: '', creditLimit: 200_000 })
  if (!customer.ok) throw new Error(customer.error)
  state = customer.data.state
  return state
}

describe('ventas', () => {
  it('cobra por encima y por debajo del precio de lista y deja el dinero en la cuenta', () => {
    const state = book()
    const product = state.products[0]
    const above = applyCheckout(state, {
      lines: [{ productId: product.id, qty: 1, price: 120_000 }],
      customerId: null,
      discount: 0,
      method: 'nequi',
      paid: 120_000,
      tendered: 0,
      note: '',
    })
    expect(above.ok).toBe(true)
    if (!above.ok) return
    expect(above.data.sale.total).toBe(120_000)
    expect(accountBalance(above.data.state, 'acct-nequi')).toBe(120_000)

    const below = applyCheckout(above.data.state, {
      lines: [{ productId: product.id, qty: 1, price: 70_000 }],
      customerId: null,
      discount: 0,
      method: 'efectivo',
      paid: 70_000,
      tendered: 70_000,
      note: '',
    })
    expect(below.ok).toBe(true)
    if (!below.ok) return
    expect(below.data.sale.lines[0].price).toBe(70_000)
    expect(accountBalance(below.data.state, 'acct-efectivo')).toBe(70_000)
  })

  it('respeta el cupo y aplica abonos a la venta elegida', () => {
    const state = book()
    const product = state.products[0]
    const customer = state.customers[0]
    const sale = applyCheckout(state, {
      lines: [{ productId: product.id, qty: 2 }],
      customerId: customer.id,
      discount: 0,
      method: 'credito',
      paid: 40_000,
      tendered: 0,
      note: '',
      dueDate: '2026-10-30',
      accountId: 'acct-efectivo',
    })
    expect(sale.ok).toBe(true)
    if (!sale.ok) return
    expect(sale.data.sale.balance).toBe(140_000)
    expect(sale.data.sale.dueDate).toBe('2026-10-30')
    expect(accountBalance(sale.data.state, 'acct-efectivo')).toBe(40_000)
    const paid = applyCollection(sale.data.state, {
      customerId: customer.id,
      amount: 50_000,
      method: 'bancolombia',
      note: '',
      saleId: sale.data.sale.id,
    })
    expect(paid.ok).toBe(true)
    if (!paid.ok) return
    expect(paid.data.state.customers[0].balance).toBe(90_000)
    expect(accountBalance(paid.data.state, 'acct-bancolombia')).toBe(50_000)
  })

  it('anula una venta, edita el precio y registra una devolución', () => {
    let state = book()
    const product = state.products[0]
    const sold = applyCheckout(state, {
      lines: [{ productId: product.id, qty: 1, price: 80_000 }],
      customerId: null,
      discount: 0,
      method: 'efectivo',
      paid: 80_000,
      tendered: 100_000,
      note: '',
    })
    if (!sold.ok) throw new Error(sold.error)
    const edited = applyUpdateSale(sold.data.state, sold.data.sale.id, { prices: [{ index: 0, price: 100_000 }] })
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(accountBalance(edited.data.state, 'acct-efectivo')).toBe(100_000)

    const returned = applyReturn(edited.data.state, { saleId: sold.data.sale.id, lines: [{ index: 0, qty: 1 }] })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.data.state.products[0].stock).toBe(4)
    expect(accountBalance(returned.data.state, 'acct-efectivo')).toBe(0)

    const again = applyCheckout(returned.data.state, {
      lines: [{ productId: product.id, qty: 1 }],
      customerId: null,
      discount: 0,
      method: 'efectivo',
      paid: 90_000,
      tendered: 90_000,
      note: '',
    })
    if (!again.ok) throw new Error(again.error)
    state = again.data.state
    const voided = applyVoidSale(state, { saleId: again.data.sale.id })
    expect(voided.ok).toBe(true)
    if (!voided.ok) return
    expect(voided.data.state.products[0].stock).toBe(4)
    expect(accountBalance(voided.data.state, 'acct-efectivo')).toBe(0)
    const report = profitAndLoss(voided.data.state, { from: '2020-01-01', to: '2030-01-01' })
    expect(report.netSales).toBe(0)
  })
})

describe('caja, gastos y patrimonio', () => {
  it('traslada, gasta, presta y cuadra el balance', () => {
    let state = book()
    state = {
      ...state,
      accounts: state.accounts.map((account) => (account.id === 'acct-efectivo' ? { ...account, openingBalance: 500_000 } : account)),
    }
    const moved = applyTransfer(state, { fromId: 'acct-efectivo', toId: 'acct-nequi', amount: 100_000, note: 'Pasaron a Nequi' })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    state = moved.data.state
    expect(accountBalance(state, 'acct-efectivo')).toBe(400_000)
    expect(accountBalance(state, 'acct-nequi')).toBe(100_000)

    const expense = applyExpense(state, { category: 'Domicilios', amount: 20_000, payee: 'Mensajero', note: '', accountId: 'acct-efectivo' })
    expect(expense.ok).toBe(true)
    if (!expense.ok) return
    state = expense.data.state

    const capital = applyCapital(state, { kind: 'prestamo', person: 'Socio Ejemplo', amount: 300_000, accountId: 'acct-bancolombia' })
    expect(capital.ok).toBe(true)
    if (!capital.ok) return
    state = capital.data.state

    const loan = applyLoan(state, { person: 'Prestatario Ejemplo', amount: 50_000, accountId: 'acct-nequi' })
    expect(loan.ok).toBe(true)
    if (!loan.ok) return
    state = loan.data.state

    const debt = applyPayable(state, { creditor: 'Luz', concept: 'Servicio', kind: 'servicio', amount: 30_000 })
    expect(debt.ok).toBe(true)
    if (!debt.ok) return
    state = debt.data.state
    const payment = applyPayPayable(state, { payableId: debt.data.payable.id, amount: 10_000, accountId: 'acct-efectivo' })
    expect(payment.ok).toBe(true)
    if (!payment.ok) return
    state = payment.data.state

    const sheet = balanceSheet(state)
    const cash = 400_000 - 20_000 - 10_000 + 100_000 - 50_000 + 300_000
    expect(sheet.cash).toBe(cash)
    expect(sheet.receivable.loans).toBe(50_000)
    expect(sheet.inventory.garments).toBe(200_000)
    expect(sheet.liabilities).toBe(300_000 + 20_000)
    expect(sheet.equity).toBe(sheet.assets - sheet.liabilities)

    const close = monthlyClose(state, new Date().getFullYear(), new Date().getMonth() + 1)
    expect(close.salarySharePct).toBe(25)
    expect(close.expenseTotal).toBe(20_000)
    expect(close.salaryShare).toBe(Math.round(close.profit * 0.25))
  })

  it('aparta stock con un abono y no lo deja vender', () => {
    const state = book()
    const product = state.products[0]
    const customer = state.customers[0]
    const layaway = applyLayaway(state, {
      customerId: customer.id,
      lines: [{ productId: product.id, qty: 3, price: 90_000 }],
      deposit: 50_000,
      accountId: 'acct-efectivo',
    })
    expect(layaway.ok).toBe(true)
    if (!layaway.ok) return
    expect(layaway.data.state.products[0].stock).toBe(4)
    expect(layaway.data.state.products[0].reserved).toBe(3)
    const blocked = applyCheckout(layaway.data.state, {
      lines: [{ productId: product.id, qty: 2 }],
      customerId: null,
      discount: 0,
      method: 'efectivo',
      paid: 180_000,
      tendered: 180_000,
      note: '',
    })
    expect(blocked.ok).toBe(false)
  })
})
