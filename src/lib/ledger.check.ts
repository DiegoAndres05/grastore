import { balanceSheet, cashTotal, periodResult } from './books'
import { applyCheckout, applyCollection, applyExpense, applyPayable, applyPayablePayment, applyPurchase, applyReturn, applyTransfer } from './logic'
import type { Customer, Product, State, Supplier } from '../types'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const product: Product = {
  id: 'p1', sku: 'GR-1', name: 'Camiseta', category: 'Camisetas', color: 'Negro', size: 'M',
  cost: 60_000, price: 100_000, stock: 5, minStock: 1, active: true,
}
const customer: Customer = {
  id: 'c1', name: 'Cliente', phone: '', email: '', city: 'Cartagena', creditLimit: 500_000, balance: 0, since: new Date().toISOString(),
}
const supplier: Supplier = { id: 's1', name: 'Proveedor', contact: '', phone: '', city: '', specialty: '' }

function blank(): State {
  return {
    products: [{ ...product }],
    customers: [{ ...customer }],
    suppliers: [{ ...supplier }],
    sales: [],
    purchases: [],
    collections: [],
    movements: [],
    payables: [],
    seq: { sale: 1000, purchase: 1, payable: 1 },
  }
}

const start = new Date(0)
const end = new Date('2100-01-01')

let state = blank()
const cashSale = applyCheckout(state, {
  lines: [{ productId: 'p1', qty: 1 }],
  customerId: null,
  discount: 0,
  method: 'efectivo',
  account: 'efectivo',
  paid: 100_000,
  tendered: 100_000,
  note: '',
})
assert(cashSale.ok, 'venta de contado')
if (!cashSale.ok) throw new Error('venta')
state = cashSale.data.state
assert(state.sales.length === 1 && state.sales[0].total === 100_000, 'una venta de 100000')
assert(state.products[0].stock === 4, 'stock baja una unidad')
assert(cashTotal(state.movements) === 100_000, 'efectivo entra 100000')
const cashResult = periodResult(state, start, end)
assert(cashResult.sales === 100_000 && cashResult.cost === 60_000 && cashResult.gross === 40_000, 'margen bruto 40000')

const credit = applyCheckout(state, {
  lines: [{ productId: 'p1', qty: 1 }],
  customerId: 'c1',
  discount: 0,
  method: 'credito',
  account: 'nequi',
  paid: 40_000,
  tendered: 0,
  note: '',
})
assert(credit.ok, 'venta a crédito')
if (!credit.ok) throw new Error('credito')
state = credit.data.state
assert(state.sales.length === 2, 'el abono no crea otra venta')
assert(state.sales[0].total === 100_000 && state.sales[0].balance === 60_000, 'saldo 60000')
assert(state.customers[0].balance === 60_000, 'cartera del cliente')
assert(state.products[0].stock === 3, 'stock de la segunda venta')
const nequi = state.movements.find((movement) => movement.account === 'nequi' && movement.kind === 'venta')
assert(nequi?.amount === 40_000, 'Nequi recibe el abono')
const creditResult = periodResult(state, start, end)
assert(creditResult.sales === 200_000 && creditResult.cost === 120_000 && creditResult.gross === 80_000, 'las dos ventas entran a resultados')

const abono = applyCollection(state, { customerId: 'c1', amount: 20_000, account: 'efectivo', note: '', saleId: state.sales[0].id })
assert(abono.ok, 'abono posterior')
if (!abono.ok) throw new Error('abono')
state = abono.data.state
assert(state.sales.length === 2, 'el abono sigue sin crear venta')
assert(state.sales[0].balance === 40_000, 'saldo baja a 40000')
assert(state.collections.length === 1, 'queda el historial del abono')
assert(state.movements.some((movement) => movement.kind === 'abono' && movement.amount === 20_000 && movement.account === 'efectivo'), 'el abono entra a efectivo')
assert(periodResult(state, start, end).sales === 200_000, 'el abono no suma otra venta')

const beforeBuy = state.products[0].stock
const buy = applyPurchase(state, {
  supplierId: 's1',
  note: '',
  lines: [{ productId: 'p1', qty: 2, cost: 50_000 }],
  paid: 40_000,
  account: 'efectivo',
})
assert(buy.ok, 'compra')
if (!buy.ok) throw new Error('compra')
state = buy.data.state
assert(state.products[0].stock === beforeBuy + 2, 'entran dos unidades')
assert(state.payables.length === 1 && state.payables[0].balance === 60_000 && state.payables[0].kind === 'mercancia', 'queda cuenta por pagar')
assert(state.movements.some((movement) => movement.kind === 'compra' && movement.amount === 40_000 && movement.direction === 'out'), 'sale el pago de la compra')

const payableBefore = state.payables[0].balance
const pay = applyPayablePayment(state, { payableId: state.payables[0].id, amount: 50_000, account: 'nequi' })
assert(pay.ok, 'pago a proveedor')
if (!pay.ok) throw new Error('pago')
state = pay.data.state
assert(state.payables[0].balance === payableBefore - 50_000, 'la deuda baja')
assert(state.purchases.length === 1, 'el pago no crea otra compra')
assert(periodResult(state, start, end).expenses === 0, 'pagar mercancía no es gasto')

const cashBefore = cashTotal(state.movements)
const move = applyTransfer(state, { from: 'nequi', to: 'efectivo', amount: 100_000, note: '' })
assert(move.ok, 'transferencia')
if (!move.ok) throw new Error('transferencia')
state = move.data.state
assert(cashTotal(state.movements) === cashBefore, 'el total de plata no cambia')

const expense = applyExpense(state, { kind: 'gasto', concept: 'Luz', amount: 30_000, account: 'efectivo' })
const draw = applyExpense(expense.ok ? expense.data.state : state, { kind: 'retiro', concept: 'Dueño', amount: 15_000, account: 'efectivo' })
assert(expense.ok && draw.ok, 'gasto y retiro')
if (!draw.ok) throw new Error('retiro')
state = draw.data.state
const after = periodResult(state, start, end)
assert(after.expenses === 30_000 && after.withdrawals === 15_000 && after.net === after.gross - 30_000, 'el retiro no es gasto')

const owed = applyPayable(state, { supplierId: null, name: 'Local', concept: 'Arriendo', kind: 'servicio', total: 80_000, note: '' })
assert(owed.ok, 'servicio fiado')
if (!owed.ok) throw new Error('servicio')
state = owed.data.state
assert(periodResult(state, start, end).expenses === 110_000, 'el servicio entra una sola vez a gastos')

const saleId = state.sales[0].id
const stockBeforeReturn = state.products[0].stock
const returned = applyReturn(state, saleId)
assert(returned.ok, 'devolución')
if (!returned.ok) throw new Error('devolucion')
state = returned.data.state
assert(state.sales.filter((sale) => sale.status === 'activa').length === 1, 'la venta devuelta sale de las activas')
assert(state.products[0].stock === stockBeforeReturn + 1, 'la unidad vuelve')
assert(state.customers[0].balance === 0, 'se cancela la deuda de esa venta')
assert(state.movements.some((movement) => movement.kind === 'devolucion'), 'sale el dinero cobrado')
const finalBooks = balanceSheet(state)
assert(finalBooks.assets === finalBooks.payable + finalBooks.equity, 'el balance cuadra')

console.log('ledger ok')
