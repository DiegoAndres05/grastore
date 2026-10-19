import type {
  Actor,
  Account,
  AccountKind,
  Adjustment,
  CapitalEvent,
  Expense,
  Investment,
  Layaway,
  Loan,
  LoanPayment,
  Payable,
  PayableKind,
  PayablePayment,
  Sale,
  SaleReturn,
  State,
} from '../types'
import { accountForMethod, availableUnits, coerceWhen, moneyOf, stamp, uid, withMovement } from './money'
import type { Result } from './logic'

function fail(error: string): Result<never> {
  return { ok: false, error }
}

export type TransferInput = {
  fromId: string
  toId: string
  amount: number
  date?: string
  note?: string
  actor?: Actor | null
}

export function applyTransfer(state: State, input: TransferInput): Result<{ state: State }> {
  if (input.fromId === input.toId) return fail('Elige dos cuentas distintas')
  const from = state.accounts.find((account) => account.id === input.fromId && account.active)
  const to = state.accounts.find((account) => account.id === input.toId && account.active)
  if (!from || !to) return fail('Elige las dos cuentas del traslado')
  const amount = moneyOf(input.amount)
  if (amount <= 0) return fail('Escribe el valor del traslado')
  const when = coerceWhen(input.date)
  const note = input.note?.trim() || `Pasaron a ${to.name}`
  let next = withMovement(state, {
    date: when,
    accountId: from.id,
    kind: 'transfer',
    direction: 'out',
    amount,
    counterparty: to.name,
    note,
    refId: to.id,
    actor: input.actor,
  })
  next = withMovement(next, {
    date: when,
    accountId: to.id,
    kind: 'transfer',
    direction: 'in',
    amount,
    counterparty: from.name,
    note,
    refId: from.id,
    actor: input.actor,
  })
  return { ok: true, data: { state: next } }
}

export type AccountInput = {
  name: string
  kind: AccountKind
  openingBalance: number
  actor?: Actor | null
}

export function applySaveAccount(state: State, input: AccountInput, id?: string): Result<{ state: State; account: Account }> {
  const name = input.name.trim()
  if (!name) return fail('Escribe el nombre de la cuenta')
  if (state.accounts.some((account) => account.name.toLowerCase() === name.toLowerCase() && account.id !== id)) {
    return fail('Ya existe una cuenta con ese nombre')
  }
  const openingBalance = Math.round(input.openingBalance)
  if (!id) {
    const account: Account = { id: uid(), name, kind: input.kind, openingBalance, active: true, ...stamp(input.actor) }
    return { ok: true, data: { account, state: { ...state, accounts: [...state.accounts, account] } } }
  }
  const current = state.accounts.find((account) => account.id === id)
  if (!current) return fail('Cuenta no encontrada')
  const account: Account = { ...current, name, kind: input.kind, openingBalance }
  return { ok: true, data: { account, state: { ...state, accounts: state.accounts.map((item) => (item.id === id ? account : item)) } } }
}

export function applyAccountActive(state: State, id: string, active: boolean): State {
  return { ...state, accounts: state.accounts.map((account) => (account.id === id ? { ...account, active } : account)) }
}

export type ExpenseInput = {
  category: string
  amount: number
  payee: string
  note: string
  date?: string
  accountId?: string | null
  onCredit?: boolean
  actor?: Actor | null
}

export function applyExpense(state: State, input: ExpenseInput): Result<{ state: State; expense: Expense }> {
  const category = input.category.trim()
  const amount = moneyOf(input.amount)
  if (!category) return fail('Elige una categoría')
  if (amount <= 0) return fail('Escribe el valor del gasto')
  const when = coerceWhen(input.date)
  const account = input.accountId ? state.accounts.find((item) => item.id === input.accountId) ?? null : null
  if (!input.onCredit && !account) return fail('Elige la cuenta o déjalo por pagar')
  let payableId: string | null = null
  let next = state
  if (input.onCredit) {
    payableId = uid()
    const payable: Payable = {
      id: payableId,
      date: when,
      creditor: input.payee.trim() || category,
      supplierId: null,
      concept: input.note.trim() || category,
      kind: category.toLowerCase().includes('sueldo') ? 'sueldo' : category.toLowerCase().includes('servicio') ? 'servicio' : 'otro',
      category,
      original: amount,
      balance: amount,
      note: '',
      ...stamp(input.actor),
    }
    next = { ...next, payables: [payable, ...next.payables] }
  }
  const expense: Expense = {
    id: uid(),
    number: `G-${String(state.seq.expense).padStart(4, '0')}`,
    date: when,
    category,
    amount,
    accountId: account?.id ?? null,
    payableId,
    payee: input.payee.trim(),
    note: input.note.trim(),
    ...stamp(input.actor),
  }
  next = { ...next, expenses: [expense, ...next.expenses], seq: { ...next.seq, expense: state.seq.expense + 1 } }
  if (account && !input.onCredit) {
    next = withMovement(next, {
      date: when,
      accountId: account.id,
      kind: 'expense',
      direction: 'out',
      amount,
      counterparty: expense.payee || category,
      note: expense.note || category,
      refId: expense.id,
      actor: input.actor,
    })
  }
  return { ok: true, data: { expense, state: next } }
}

export type PayableInput = {
  creditor: string
  concept: string
  kind: PayableKind
  amount: number
  category?: string
  supplierId?: string | null
  date?: string
  note?: string
  actor?: Actor | null
}

export function applyPayable(state: State, input: PayableInput): Result<{ state: State; payable: Payable }> {
  const creditor = input.creditor.trim()
  const amount = moneyOf(input.amount)
  if (!creditor) return fail('Escribe a quién se le debe')
  if (amount <= 0) return fail('Escribe el valor de la deuda')
  const payable: Payable = {
    id: uid(),
    date: coerceWhen(input.date),
    creditor,
    supplierId: input.supplierId ?? null,
    concept: input.concept.trim() || creditor,
    kind: input.kind,
    category: input.category?.trim() || 'Otros',
    original: amount,
    balance: amount,
    note: input.note?.trim() ?? '',
    ...stamp(input.actor),
  }
  return { ok: true, data: { payable, state: { ...state, payables: [payable, ...state.payables] } } }
}

export function applyPayPayable(
  state: State,
  input: { payableId: string; amount: number; accountId: string; date?: string; note?: string; actor?: Actor | null },
): Result<{ state: State; payment: PayablePayment }> {
  const payable = state.payables.find((item) => item.id === input.payableId)
  if (!payable) return fail('Deuda no encontrada')
  const account = state.accounts.find((item) => item.id === input.accountId)
  if (!account) return fail('Elige la cuenta del pago')
  const amount = moneyOf(input.amount)
  if (amount <= 0) return fail('Escribe el valor del pago')
  if (amount > payable.balance) return fail('El pago supera el saldo de la deuda')
  const when = coerceWhen(input.date)
  const payment: PayablePayment = {
    id: uid(),
    date: when,
    payableId: payable.id,
    amount,
    accountId: account.id,
    note: input.note?.trim() ?? '',
    ...stamp(input.actor),
  }
  let next: State = {
    ...state,
    payablePayments: [payment, ...state.payablePayments],
    payables: state.payables.map((item) => (item.id === payable.id ? { ...item, balance: item.balance - amount } : item)),
  }
  next = withMovement(next, {
    date: when,
    accountId: account.id,
    kind: 'payable',
    direction: 'out',
    amount,
    counterparty: payable.creditor,
    note: input.note?.trim() || payable.concept,
    refId: payment.id,
    actor: input.actor,
  })
  return { ok: true, data: { payment, state: next } }
}

export function applyCapital(
  state: State,
  input: { kind: 'aporte' | 'prestamo'; person: string; amount: number; accountId: string; date?: string; note?: string; actor?: Actor | null },
): Result<{ state: State; event: CapitalEvent }> {
  const person = input.person.trim()
  const amount = moneyOf(input.amount)
  const account = state.accounts.find((item) => item.id === input.accountId)
  if (!person) return fail('Escribe quién pone el dinero')
  if (amount <= 0) return fail('Escribe el valor')
  if (!account) return fail('Elige la cuenta que recibe el dinero')
  const when = coerceWhen(input.date)
  let payableId: string | null = null
  let next = state
  if (input.kind === 'prestamo') {
    payableId = uid()
    next = {
      ...next,
      payables: [
        {
          id: payableId,
          date: when,
          creditor: person,
          supplierId: null,
          concept: 'Préstamo de capital',
          kind: 'capital',
          category: 'Capital',
          original: amount,
          balance: amount,
          note: input.note?.trim() ?? '',
          ...stamp(input.actor),
        },
        ...next.payables,
      ],
    }
  }
  const event: CapitalEvent = {
    id: uid(),
    date: when,
    kind: input.kind,
    person,
    amount,
    accountId: account.id,
    payableId,
    note: input.note?.trim() ?? '',
    ...stamp(input.actor),
  }
  next = {
    ...next,
    capitalEvents: [event, ...next.capitalEvents],
  }
  next = withMovement(next, {
    date: when,
    accountId: account.id,
    kind: 'capital',
    direction: 'in',
    amount,
    counterparty: person,
    note: input.kind === 'aporte' ? 'Aporte de capital' : 'Préstamo recibido',
    refId: event.id,
    actor: input.actor,
  })
  return { ok: true, data: { event, state: next } }
}

export function applyLoan(
  state: State,
  input: { person: string; amount: number; accountId: string; customerId?: string | null; dueDate?: string | null; date?: string; note?: string; actor?: Actor | null },
): Result<{ state: State; loan: Loan }> {
  const person = input.person.trim()
  const amount = moneyOf(input.amount)
  const account = state.accounts.find((item) => item.id === input.accountId)
  if (!person) return fail('Escribe a quién se le presta')
  if (amount <= 0) return fail('Escribe el valor del préstamo')
  if (!account) return fail('Elige la cuenta de donde sale el dinero')
  const when = coerceWhen(input.date)
  const loan: Loan = {
    id: uid(),
    date: when,
    person,
    customerId: input.customerId ?? null,
    original: amount,
    balance: amount,
    dueDate: input.dueDate || null,
    note: input.note?.trim() ?? '',
    ...stamp(input.actor),
  }
  let next: State = { ...state, loans: [loan, ...state.loans] }
  next = withMovement(next, {
    date: when,
    accountId: account.id,
    kind: 'loan',
    direction: 'out',
    amount,
    counterparty: person,
    note: loan.note || 'Préstamo',
    refId: loan.id,
    actor: input.actor,
  })
  return { ok: true, data: { loan, state: next } }
}

export function applyLoanPayment(
  state: State,
  input: { loanId: string; amount: number; accountId: string; date?: string; note?: string; actor?: Actor | null },
): Result<{ state: State; payment: LoanPayment }> {
  const loan = state.loans.find((item) => item.id === input.loanId)
  if (!loan) return fail('Préstamo no encontrado')
  const account = state.accounts.find((item) => item.id === input.accountId)
  if (!account) return fail('Elige la cuenta que recibe el abono')
  const amount = moneyOf(input.amount)
  if (amount <= 0) return fail('Escribe el valor del abono')
  if (amount > loan.balance) return fail('El abono supera el saldo del préstamo')
  const when = coerceWhen(input.date)
  const payment: LoanPayment = { id: uid(), date: when, loanId: loan.id, amount, accountId: account.id, note: input.note?.trim() ?? '', ...stamp(input.actor) }
  let next: State = {
    ...state,
    loanPayments: [payment, ...state.loanPayments],
    loans: state.loans.map((item) => (item.id === loan.id ? { ...item, balance: item.balance - amount } : item)),
  }
  next = withMovement(next, {
    date: when,
    accountId: account.id,
    kind: 'loan_payment',
    direction: 'in',
    amount,
    counterparty: loan.person,
    note: payment.note || 'Abono de préstamo',
    refId: payment.id,
    actor: input.actor,
  })
  return { ok: true, data: { payment, state: next } }
}

export type LayawayInput = {
  customerId: string
  lines: { productId: string; qty: number; price?: number }[]
  deposit: number
  accountId?: string | null
  dueDate?: string | null
  date?: string
  note?: string
  actor?: Actor | null
}

export function applyLayaway(state: State, input: LayawayInput): Result<{ state: State; layaway: Layaway }> {
  const customer = state.customers.find((item) => item.id === input.customerId)
  if (!customer) return fail('El apartado necesita un cliente')
  if (input.lines.length === 0) return fail('Agrega prendas al apartado')
  const qtyById = new Map<string, { qty: number; price?: number }>()
  for (const line of input.lines) {
    const qty = Math.round(line.qty)
    if (qty < 1) return fail('La cantidad debe ser mayor a cero')
    const current = qtyById.get(line.productId)
    qtyById.set(line.productId, { qty: (current?.qty ?? 0) + qty, price: line.price ?? current?.price })
  }
  const lines: Layaway['lines'] = []
  for (const [productId, draft] of qtyById) {
    const product = state.products.find((item) => item.id === productId && item.active)
    if (!product) return fail('Hay una prenda que ya no está en el piso')
    if (draft.qty > availableUnits(product)) return fail(`Sin stock suficiente de ${product.name}`)
    const price = draft.price == null ? product.price : moneyOf(draft.price)
    if (price <= 0) return fail(`El precio de ${product.name} debe ser mayor a cero`)
    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      color: product.color,
      size: product.size,
      qty: draft.qty,
      price,
      cost: product.cost,
      returnedQty: 0,
    })
  }
  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
  const deposit = moneyOf(input.deposit)
  if (deposit < 0 || deposit >= total) return fail('El abono del apartado tiene que ser menor que el total')
  const account = deposit > 0 ? (input.accountId ? state.accounts.find((item) => item.id === input.accountId) : accountForMethod(state, 'efectivo')) : null
  if (deposit > 0 && !account) return fail('Elige la cuenta del abono')
  const when = coerceWhen(input.date)
  const layaway: Layaway = {
    id: uid(),
    number: `S-${String(state.seq.layaway).padStart(4, '0')}`,
    date: when,
    dueDate: input.dueDate || null,
    customerId: customer.id,
    customerName: customer.name,
    lines,
    total,
    deposited: deposit,
    balance: total - deposit,
    status: 'abierto',
    note: input.note?.trim() ?? '',
    ...stamp(input.actor),
  }
  let next: State = {
    ...state,
    seq: { ...state.seq, layaway: state.seq.layaway + 1 },
    layaways: [layaway, ...state.layaways],
    products: state.products.map((product) => {
      const qty = qtyById.get(product.id)?.qty
      return qty ? { ...product, reserved: (product.reserved ?? 0) + qty } : product
    }),
  }
  if (account && deposit > 0) {
    next = withMovement(next, {
      date: when,
      accountId: account.id,
      kind: 'layaway',
      direction: 'in',
      amount: deposit,
      counterparty: customer.name,
      note: layaway.number,
      refId: layaway.id,
      actor: input.actor,
    })
  }
  return { ok: true, data: { layaway, state: next } }
}

export function applyLayawayDeposit(
  state: State,
  input: { layawayId: string; amount: number; accountId: string; date?: string; note?: string; actor?: Actor | null },
): Result<{ state: State; layaway: Layaway }> {
  const current = state.layaways.find((item) => item.id === input.layawayId)
  if (!current || current.status !== 'abierto') return fail('Ese apartado no está abierto')
  const account = state.accounts.find((item) => item.id === input.accountId)
  if (!account) return fail('Elige la cuenta del abono')
  const amount = moneyOf(input.amount)
  if (amount <= 0) return fail('Escribe el valor del abono')
  if (amount > current.balance) return fail('El abono supera el saldo del apartado')
  const when = coerceWhen(input.date)
  const layaway: Layaway = { ...current, deposited: current.deposited + amount, balance: current.balance - amount }
  let next: State = { ...state, layaways: state.layaways.map((item) => (item.id === layaway.id ? layaway : item)) }
  next = withMovement(next, {
    date: when,
    accountId: account.id,
    kind: 'layaway',
    direction: 'in',
    amount,
    counterparty: current.customerName,
    note: input.note?.trim() || current.number,
    refId: current.id,
    actor: input.actor,
  })
  return { ok: true, data: { layaway, state: next } }
}

export function applyCompleteLayaway(
  state: State,
  input: { layawayId: string; date?: string; actor?: Actor | null },
): Result<{ state: State; sale: Sale }> {
  const layaway = state.layaways.find((item) => item.id === input.layawayId)
  if (!layaway || layaway.status !== 'abierto') return fail('Ese apartado no está abierto')
  if (layaway.balance > 0) return fail('Todavía falta saldo para entregar el apartado')
  const when = coerceWhen(input.date)
  const sale: Sale = {
    id: uid(),
    number: `V-${state.seq.sale}`,
    date: when,
    customerId: layaway.customerId,
    customerName: layaway.customerName,
    lines: layaway.lines,
    discount: 0,
    total: layaway.total,
    method: 'efectivo',
    paid: layaway.total,
    balance: 0,
    tendered: null,
    note: `Plan separe ${layaway.number}`,
    accountId: null,
    cashIn: 0,
    dueDate: null,
    kind: 'retail',
    voided: false,
    affectsStock: true,
    layawayId: layaway.id,
    ...stamp(input.actor),
  }
  const qtyById = new Map(layaway.lines.map((line) => [line.productId, line.qty]))
  const next: State = {
    ...state,
    seq: { ...state.seq, sale: state.seq.sale + 1 },
    sales: [sale, ...state.sales],
    layaways: state.layaways.map((item) => (item.id === layaway.id ? { ...item, status: 'entregado', balance: 0 } : item)),
    products: state.products.map((product) => {
      const qty = qtyById.get(product.id)
      if (!qty) return product
      return { ...product, reserved: Math.max(0, (product.reserved ?? 0) - qty), stock: product.stock - qty }
    }),
  }
  return { ok: true, data: { sale, state: next } }
}

export function applyCancelLayaway(
  state: State,
  input: { layawayId: string; accountId?: string | null; date?: string; actor?: Actor | null },
): Result<{ state: State }> {
  const layaway = state.layaways.find((item) => item.id === input.layawayId)
  if (!layaway || layaway.status !== 'abierto') return fail('Ese apartado no está abierto')
  const account = layaway.deposited > 0 ? state.accounts.find((item) => item.id === input.accountId) ?? null : null
  if (layaway.deposited > 0 && !account) return fail('Elige la cuenta donde se devuelve el abono')
  const when = coerceWhen(input.date)
  const qtyById = new Map(layaway.lines.map((line) => [line.productId, line.qty]))
  let next: State = {
    ...state,
    layaways: state.layaways.map((item) => (item.id === layaway.id ? { ...item, status: 'cancelado', balance: 0 } : item)),
    products: state.products.map((product) => {
      const qty = qtyById.get(product.id)
      return qty ? { ...product, reserved: Math.max(0, (product.reserved ?? 0) - qty) } : product
    }),
  }
  if (account && layaway.deposited > 0) {
    next = withMovement(next, {
      date: when,
      accountId: account.id,
      kind: 'layaway',
      direction: 'out',
      amount: layaway.deposited,
      counterparty: layaway.customerName,
      note: `Cancelación ${layaway.number}`,
      refId: layaway.id,
      actor: input.actor,
    })
  }
  return { ok: true, data: { state: next } }
}

export function applyVoidSale(state: State, input: { saleId: string; date?: string; actor?: Actor | null }): Result<{ state: State }> {
  const sale = state.sales.find((item) => item.id === input.saleId)
  if (!sale) return fail('Venta no encontrada')
  if (sale.voided) return fail('Esa venta ya está anulada')
  const cashIn = sale.cashIn ?? (sale.method === 'credito' ? sale.paid : sale.total)
  if ((sale.kind ?? 'retail') !== 'opening' && sale.paid > cashIn) return fail('Esta venta ya tiene abonos. Registra una devolución.')
  const when = coerceWhen(input.date)
  const qtyById = new Map(sale.lines.map((line) => [line.productId, line.qty - (line.returnedQty ?? 0)]))
  let next: State = {
    ...state,
    sales: state.sales.map((item) =>
      item.id === sale.id
        ? { ...item, voided: true, balance: 0, voidedBy: input.actor?.id ?? null, voidedByName: input.actor?.name ?? null }
        : item,
    ),
    products:
      sale.affectsStock === false
        ? state.products
        : state.products.map((product) => {
            const qty = qtyById.get(product.id)
            return qty ? { ...product, stock: product.stock + qty } : product
          }),
    customers:
      sale.customerId && sale.balance > 0
        ? state.customers.map((customer) =>
            customer.id === sale.customerId ? { ...customer, balance: Math.max(0, customer.balance - sale.balance) } : customer,
          )
        : state.customers,
  }
  const accountId = sale.accountId || accountForMethod(state, sale.method)?.id || null
  if (sale.payments && sale.payments.length > 0) {
    for (const part of sale.payments) {
      if (!part.accountId || part.amount <= 0) continue
      next = withMovement(next, {
        date: when,
        accountId: part.accountId,
        kind: 'void',
        direction: 'out',
        amount: part.amount,
        counterparty: sale.customerName,
        note: `Anulación ${sale.number}`,
        refId: sale.id,
        actor: input.actor,
      })
    }
  } else if (cashIn > 0 && accountId) {
    next = withMovement(next, {
      date: when,
      accountId,
      kind: 'void',
      direction: 'out',
      amount: cashIn,
      counterparty: sale.customerName,
      note: `Anulación ${sale.number}`,
      refId: sale.id,
      actor: input.actor,
    })
  }
  return { ok: true, data: { state: next } }
}

export type SalePatch = {
  date?: string
  note?: string
  dueDate?: string | null
  discount?: number
  prices?: { index: number; price: number }[]
}

export function applyUpdateSale(state: State, saleId: string, patch: SalePatch): Result<{ state: State; sale: Sale }> {
  const sale = state.sales.find((item) => item.id === saleId)
  if (!sale) return fail('Venta no encontrada')
  if (sale.voided) return fail('No se puede editar una venta anulada')
  const lines = sale.lines.map((line) => ({ ...line }))
  for (const price of patch.prices ?? []) {
    const line = lines[price.index]
    if (!line) return fail('Línea no encontrada')
    const next = moneyOf(price.price)
    if (next <= 0) return fail('El precio debe ser mayor a cero')
    lines[price.index] = { ...line, price: next }
  }
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
  const discount = patch.discount == null ? sale.discount : moneyOf(patch.discount)
  if (discount > subtotal) return fail('El descuento supera el subtotal')
  const total = subtotal - discount
  if (total <= 0) return fail('El total debe ser mayor a cero')
  if (total < sale.paid) return fail('El nuevo total queda por debajo de lo ya pagado. Registra una devolución.')
  const delta = total - sale.total
  if ((sale.payments?.length ?? 0) > 1 && delta !== 0) return fail('Esta venta quedó en varias cuentas. El total no se mueve desde aquí.')
  const balance = sale.method === 'credito' ? sale.balance + delta : sale.balance
  const updated: Sale = {
    ...sale,
    lines,
    discount,
    total,
    balance,
    paid: sale.method === 'credito' ? sale.paid : total,
    cashIn: sale.method === 'credito' || sale.method === 'tarjeta' ? sale.cashIn : (sale.cashIn ?? sale.total) + delta,
    date: patch.date ? coerceWhen(patch.date) : sale.date,
    note: patch.note == null ? sale.note : patch.note.trim(),
    dueDate: patch.dueDate === undefined ? sale.dueDate : patch.dueDate,
  }
  let next: State = {
    ...state,
    sales: state.sales.map((item) => (item.id === sale.id ? updated : item)),
    customers:
      sale.customerId && sale.method === 'credito'
        ? state.customers.map((customer) =>
            customer.id === sale.customerId ? { ...customer, balance: customer.balance + delta } : customer,
          )
        : state.customers,
  }
  if (delta !== 0 && sale.method !== 'credito' && sale.method !== 'tarjeta') {
    const accountId = sale.accountId || accountForMethod(state, sale.method)?.id
    if (accountId) {
      next = withMovement(next, {
        date: updated.date,
        accountId,
        kind: 'adjustment',
        direction: delta > 0 ? 'in' : 'out',
        amount: Math.abs(delta),
        counterparty: sale.customerName,
        note: `Ajuste ${sale.number}`,
        refId: sale.id,
      })
    }
  }
  return { ok: true, data: { sale: updated, state: next } }
}

export function applyReturn(
  state: State,
  input: { saleId: string; lines: { index: number; qty: number }[]; accountId?: string | null; date?: string; note?: string; actor?: Actor | null },
): Result<{ state: State; saleReturn: SaleReturn }> {
  const sale = state.sales.find((item) => item.id === input.saleId)
  if (!sale || sale.voided) return fail('Esa venta no se puede devolver')
  if ((sale.kind ?? 'retail') === 'opening') return fail('El saldo inicial se abona o se anula, no se devuelve como prenda')
  const picked: SaleReturn['lines'] = []
  const indexes: { index: number; qty: number }[] = []
  for (const line of input.lines) {
    const source = sale.lines[line.index]
    if (!source) return fail('Línea no encontrada')
    const qty = Math.round(line.qty)
    if (qty < 1 || qty > source.qty - (source.returnedQty ?? 0)) return fail(`La cantidad a devolver de ${source.name} no es válida`)
    picked.push({ productId: source.productId, qty, price: source.price, cost: source.cost })
    indexes.push({ index: line.index, qty })
  }
  if (picked.length === 0) return fail('Elige prendas para devolver')
  const gross = picked.reduce((sum, line) => sum + line.price * line.qty, 0)
  const already = state.returns.filter((item) => item.saleId === sale.id).reduce((sum, item) => sum + item.amount, 0)
  const refund = Math.min(gross, sale.total - already)
  if (refund <= 0) return fail('Esa venta ya no tiene valor por devolver')
  const balanceCut = Math.min(sale.balance, refund)
  const cashRefund = refund - balanceCut
  const account = cashRefund > 0 ? state.accounts.find((item) => item.id === (input.accountId || sale.accountId || accountForMethod(state, sale.method)?.id)) ?? null : null
  if (cashRefund > 0 && sale.method !== 'tarjeta' && !account) return fail('Elige la cuenta del reembolso')
  const when = coerceWhen(input.date)
  const saleReturn: SaleReturn = {
    id: uid(),
    date: when,
    saleId: sale.id,
    saleNumber: sale.number,
    lines: picked,
    amount: refund,
    accountId: account?.id ?? null,
    note: input.note?.trim() ?? '',
    ...stamp(input.actor),
  }
  const qtyByIndex = new Map(indexes.map((line) => [line.index, line.qty]))
  let next: State = {
    ...state,
    returns: [saleReturn, ...state.returns],
    sales: state.sales.map((item) =>
      item.id === sale.id
        ? {
            ...item,
            balance: item.balance - balanceCut,
            paid: Math.max(0, item.paid - cashRefund),
            lines: item.lines.map((line, index) => ({ ...line, returnedQty: (line.returnedQty ?? 0) + (qtyByIndex.get(index) ?? 0) })),
          }
        : item,
    ),
    products:
      sale.affectsStock === false
        ? state.products
        : state.products.map((product) => {
            const qty = picked.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.qty, 0)
            return qty ? { ...product, stock: product.stock + qty } : product
          }),
    customers:
      sale.customerId && balanceCut > 0
        ? state.customers.map((customer) =>
            customer.id === sale.customerId ? { ...customer, balance: Math.max(0, customer.balance - balanceCut) } : customer,
          )
        : state.customers,
  }
  if (account && cashRefund > 0) {
    next = withMovement(next, {
      date: when,
      accountId: account.id,
      kind: 'return',
      direction: 'out',
      amount: cashRefund,
      counterparty: sale.customerName,
      note: `Devolución ${sale.number}`,
      refId: saleReturn.id,
      actor: input.actor,
    })
  }
  return { ok: true, data: { saleReturn, state: next } }
}

export function applyAdjustment(
  state: State,
  input: { productId: string; qtyDelta: number; reason: string; date?: string; actor?: Actor | null },
): Result<{ state: State; adjustment: Adjustment }> {
  const product = state.products.find((item) => item.id === input.productId)
  if (!product) return fail('Prenda no encontrada')
  const qtyDelta = Math.round(input.qtyDelta)
  const reason = input.reason.trim()
  if (!reason) return fail('Escribe el motivo del ajuste')
  if (qtyDelta === 0) return fail('La cantidad no puede ser cero')
  if (product.stock + qtyDelta < (product.reserved ?? 0)) return fail('El ajuste dejaría el stock por debajo de lo apartado')
  if (product.stock + qtyDelta < 0) return fail('El stock no puede quedar negativo')
  const adjustment: Adjustment = {
    id: uid(),
    date: coerceWhen(input.date),
    productId: product.id,
    sku: product.sku,
    name: product.name,
    qtyDelta,
    reason,
    ...stamp(input.actor),
  }
  return {
    ok: true,
    data: {
      adjustment,
      state: {
        ...state,
        adjustments: [adjustment, ...state.adjustments],
        products: state.products.map((item) => (item.id === product.id ? { ...item, stock: item.stock + qtyDelta } : item)),
      },
    },
  }
}

export function applyInvestment(
  state: State,
  input: {
    supplierId: string
    amount: number
    note?: string
    date?: string
    accountId?: string | null
    onCredit?: boolean
    location?: string
    actor?: Actor | null
  },
): Result<{ state: State; investment: Investment }> {
  const supplier = state.suppliers.find((item) => item.id === input.supplierId)
  if (!supplier) return fail('Elige un proveedor')
  const amount = moneyOf(input.amount)
  if (amount <= 0) return fail('Escribe el valor de la inversión')
  const when = coerceWhen(input.date)
  const account = input.accountId ? state.accounts.find((item) => item.id === input.accountId) ?? null : null
  if (!input.onCredit && input.accountId && !account) return fail('Elige la cuenta del pago')
  let payableId: string | null = null
  let next = state
  if (input.onCredit) {
    payableId = uid()
    next = {
      ...next,
      payables: [
        {
          id: payableId,
          date: when,
          creditor: supplier.name,
          supplierId: supplier.id,
          concept: input.note?.trim() || 'Inversión en mercancía',
          kind: 'proveedor',
          category: 'Mercancía',
          original: amount,
          balance: amount,
          note: '',
          ...stamp(input.actor),
        },
        ...next.payables,
      ],
    }
  }
  const investment: Investment = {
    id: uid(),
    date: when,
    supplierId: supplier.id,
    supplierName: supplier.name,
    amount,
    allocated: 0,
    accountId: account?.id ?? null,
    payableId,
    note: input.note?.trim() ?? '',
    location: input.location?.trim() ?? '',
    ...stamp(input.actor),
  }
  next = { ...next, investments: [investment, ...next.investments] }
  if (account && !input.onCredit) {
    next = withMovement(next, {
      date: when,
      accountId: account.id,
      kind: 'purchase',
      direction: 'out',
      amount,
      counterparty: supplier.name,
      note: investment.note || 'Inversión',
      refId: investment.id,
      actor: input.actor,
    })
  }
  return { ok: true, data: { investment, state: next } }
}

export function applySettleInvestment(state: State, id: string): Result<{ state: State }> {
  const investment = state.investments.find((item) => item.id === id)
  if (!investment) return fail('Inversión no encontrada')
  return {
    ok: true,
    data: {
      state: {
        ...state,
        investments: state.investments.map((item) => (item.id === id ? { ...item, allocated: item.amount } : item)),
      },
    },
  }
}

export function applySalaryShare(state: State, percent: number): Result<{ state: State }> {
  if (percent < 0 || percent > 100) return fail('El porcentaje va de 0 a 100')
  return { ok: true, data: { state: { ...state, settings: { ...state.settings, salarySharePct: percent } } } }
}

export function applyAddCategory(state: State, name: string): Result<{ state: State }> {
  const category = name.trim()
  if (!category) return fail('Escribe la categoría')
  if (state.settings.categories.some((item) => item.toLowerCase() === category.toLowerCase())) return fail('Esa categoría ya existe')
  return { ok: true, data: { state: { ...state, settings: { ...state.settings, categories: [...state.settings.categories, category] } } } }
}

export function applyRenameCategory(state: State, from: string, to: string): Result<{ state: State }> {
  const next = to.trim()
  if (!next) return fail('Escribe el nombre nuevo')
  if (!state.settings.categories.includes(from)) return fail('Categoría no encontrada')
  return {
    ok: true,
    data: {
      state: {
        ...state,
        settings: { ...state.settings, categories: state.settings.categories.map((item) => (item === from ? next : item)) },
        products: state.products.map((product) => (product.category === from ? { ...product, category: next } : product)),
      },
    },
  }
}

export function applyAddColor(state: State, name: string): Result<{ state: State }> {
  const color = name.trim()
  if (!color) return fail('Escribe el color')
  if (state.settings.colors.some((item) => item.toLowerCase() === color.toLowerCase())) return fail('Ese color ya existe')
  return { ok: true, data: { state: { ...state, settings: { ...state.settings, colors: [...state.settings.colors, color] } } } }
}
