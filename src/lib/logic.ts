import { makeMovement, methodForAccount } from './books'
import type {
  CashAccount,
  CashMovement,
  Collection,
  Customer,
  Payable,
  PayableKind,
  PayMethod,
  Product,
  Purchase,
  Sale,
  State,
  Supplier,
} from '../types'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type CheckoutInput = {
  lines: { productId: string; qty: number }[]
  customerId: string | null
  discount: number
  method: PayMethod
  account: CashAccount | null
  paid: number
  tendered: number
  note: string
}

export type CollectionInput = {
  customerId: string
  amount: number
  account: CashAccount
  note: string
  saleId?: string
}

export type PurchaseInput = {
  supplierId: string
  note: string
  lines: { productId: string; qty: number; cost: number }[]
  paid: number
  account: CashAccount | null
}

export type ProductInput = {
  sku: string
  name: string
  category: string
  color: string
  size: string
  cost: number
  price: number
  stock: number
  minStock: number
}

export type CustomerInput = {
  name: string
  phone: string
  email: string
  city: string
  creditLimit: number
}

export type SupplierInput = {
  name: string
  contact: string
  phone: string
  city: string
  specialty: string
}

export type ExpenseInput = {
  kind: 'gasto' | 'retiro'
  concept: string
  amount: number
  account: CashAccount
}

export type TransferInput = {
  from: CashAccount
  to: CashAccount
  amount: number
  note: string
}

export type OpeningInput = {
  account: CashAccount
  amount: number
  note: string
}

export type PayableInput = {
  supplierId: string | null
  name: string
  concept: string
  kind: Exclude<PayableKind, 'mercancia'>
  total: number
  note: string
}

export type PayablePaymentInput = {
  payableId: string
  amount: number
  account: CashAccount
}

function fail(error: string): Result<never> {
  return { ok: false, error }
}

function moneyOf(value: number) {
  return Math.max(0, Math.round(value))
}

function withMovement(state: State, movement: CashMovement): State {
  return { ...state, movements: [movement, ...state.movements] }
}

function checkoutAccount(method: PayMethod, account: CashAccount | null, paid: number): CashAccount | null | Result<never> {
  if (paid <= 0) return null
  if (method === 'efectivo') return 'efectivo'
  if (method === 'tarjeta') return 'tarjeta'
  if (method === 'transferencia') {
    if (account !== 'nequi' && account !== 'bancolombia') return fail('Elige Nequi o Bancolombia')
    return account
  }
  if (!account) return fail('Elige la cuenta del abono')
  return account
}

export function applyCheckout(state: State, input: CheckoutInput): Result<{ state: State; sale: Sale }> {
  if (input.lines.length === 0) return fail('Agrega prendas al ticket')

  const qtyById = new Map<string, number>()
  for (const line of input.lines) {
    const qty = Math.round(line.qty)
    if (qty < 1) return fail('La cantidad debe ser mayor a cero')
    qtyById.set(line.productId, (qtyById.get(line.productId) ?? 0) + qty)
  }

  const saleLines: Sale['lines'] = []
  for (const [productId, qty] of qtyById) {
    const product = state.products.find((item) => item.id === productId && item.active)
    if (!product) return fail('Hay una prenda que ya no está en el piso')
    if (qty > product.stock) {
      return fail(`Sin stock suficiente de ${product.name} · ${product.color} · ${product.size}`)
    }
    saleLines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      color: product.color,
      size: product.size,
      qty,
      price: product.price,
      cost: product.cost,
    })
  }

  const subtotal = saleLines.reduce((sum, line) => sum + line.price * line.qty, 0)
  const discount = moneyOf(input.discount)
  if (discount > subtotal) return fail('El descuento supera el subtotal')
  const total = subtotal - discount
  if (total <= 0) return fail('El total debe ser mayor a cero')

  const customer = input.customerId
    ? state.customers.find((item) => item.id === input.customerId) ?? null
    : null
  if (input.customerId && !customer) return fail('Cliente no encontrado')

  let paid = total
  let balance = 0
  let tendered: number | null = null

  if (input.method === 'credito') {
    if (!customer) return fail('El crédito de tienda necesita un cliente')
    paid = moneyOf(input.paid)
    if (paid > total) return fail('El abono no puede superar el total')
    balance = total - paid
    if (customer.balance + balance > customer.creditLimit) {
      return fail(`El saldo supera el cupo de ${customer.name}`)
    }
  }

  if (input.method === 'efectivo') {
    tendered = moneyOf(input.tendered)
    if (tendered < total) return fail('El efectivo recibido no cubre el total')
  }

  const accountResult = checkoutAccount(input.method, input.account, paid)
  if (accountResult && typeof accountResult === 'object' && 'ok' in accountResult) return accountResult
  const account = accountResult as CashAccount | null

  const sale: Sale = {
    id: crypto.randomUUID(),
    number: `V-${state.seq.sale}`,
    date: new Date().toISOString(),
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? 'Mostrador',
    lines: saleLines,
    discount,
    total,
    method: input.method,
    account,
    paid,
    downPaid: paid,
    balance,
    tendered,
    note: input.note.trim(),
    status: 'activa',
    returnedAt: null,
  }

  let next = {
    ...state,
    seq: { ...state.seq, sale: state.seq.sale + 1 },
    sales: [sale, ...state.sales],
    products: state.products.map((product) => {
      const qty = qtyById.get(product.id)
      return qty ? { ...product, stock: product.stock - qty } : product
    }),
    customers: state.customers.map((item) =>
      customer && item.id === customer.id && balance > 0
        ? { ...item, balance: item.balance + balance }
        : item,
    ),
  }
  if (paid > 0 && account) {
    next = withMovement(next, makeMovement({
      date: sale.date,
      account,
      direction: 'in',
      amount: paid,
      kind: 'venta',
      concept: `Venta ${sale.number}`,
      refId: sale.id,
    }))
  }

  return { ok: true, data: { sale, state: next } }
}

export function applyCollection(
  state: State,
  input: CollectionInput,
): Result<{ state: State; collection: Collection }> {
  const customer = state.customers.find((item) => item.id === input.customerId)
  if (!customer) return fail('Cliente no encontrado')
  const amount = moneyOf(input.amount)
  if (amount <= 0) return fail('Escribe el valor del abono')
  if (amount > customer.balance) return fail('El abono supera el saldo del cliente')

  const open = state.sales
    .filter((sale) => sale.status === 'activa' && sale.customerId === customer.id && sale.balance > 0)
    .sort((a, b) => {
      if (input.saleId) {
        if (a.id === input.saleId) return -1
        if (b.id === input.saleId) return 1
      }
      return a.date.localeCompare(b.date)
    })

  let remaining = amount
  const updates = new Map<string, Sale>()
  const applications: Collection['applications'] = []
  for (const sale of open) {
    if (remaining <= 0) break
    const applied = Math.min(sale.balance, remaining)
    updates.set(sale.id, { ...sale, balance: sale.balance - applied, paid: sale.paid + applied })
    applications.push({ saleId: sale.id, amount: applied })
    remaining -= applied
  }
  if (remaining > 0) return fail('No hay ventas abiertas para aplicar este abono')

  const collection: Collection = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    customerId: customer.id,
    customerName: customer.name,
    amount,
    method: methodForAccount(input.account),
    account: input.account,
    note: input.note.trim(),
    saleId: input.saleId ?? null,
    applications,
  }

  const next = withMovement({
    ...state,
    collections: [collection, ...state.collections],
    sales: state.sales.map((sale) => updates.get(sale.id) ?? sale),
    customers: state.customers.map((item) =>
      item.id === customer.id ? { ...item, balance: item.balance - amount } : item,
    ),
  }, makeMovement({
    date: collection.date,
    account: input.account,
    direction: 'in',
    amount,
    kind: 'abono',
    concept: `Abono ${customer.name}`,
    refId: collection.id,
  }))

  return { ok: true, data: { collection, state: next } }
}

export function applyPurchase(state: State, input: PurchaseInput): Result<{ state: State; purchase: Purchase }> {
  const supplier = state.suppliers.find((item) => item.id === input.supplierId)
  if (!supplier) return fail('Elige un proveedor')
  if (input.lines.length === 0) return fail('Agrega prendas a la compra')

  const lines: Purchase['lines'] = []
  for (const line of input.lines) {
    const product = state.products.find((item) => item.id === line.productId)
    if (!product || !product.active) return fail('Elige una prenda activa en cada línea')
    const qty = Math.round(line.qty)
    const cost = moneyOf(line.cost)
    if (qty < 1) return fail('La cantidad recibida debe ser mayor a cero')
    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      color: product.color,
      size: product.size,
      qty,
      cost,
    })
  }

  let products = state.products
  for (const line of lines) {
    products = products.map((product) => {
      if (product.id !== line.productId) return product
      const nextQty = product.stock + line.qty
      const nextCost = nextQty === 0 ? line.cost : Math.round((product.stock * product.cost + line.qty * line.cost) / nextQty)
      return { ...product, stock: nextQty, cost: nextCost }
    })
  }

  const total = lines.reduce((sum, line) => sum + line.cost * line.qty, 0)
  const paid = moneyOf(input.paid)
  if (paid > total) return fail('El pago no puede superar el total de la compra')
  if (paid > 0 && !input.account) return fail('Elige la cuenta del pago')
  const balance = total - paid
  const now = new Date().toISOString()

  const purchase: Purchase = {
    id: crypto.randomUUID(),
    number: `C-${String(state.seq.purchase).padStart(4, '0')}`,
    date: now,
    supplierId: supplier.id,
    supplierName: supplier.name,
    lines,
    total,
    paid,
    balance,
    account: paid > 0 ? input.account : null,
    note: input.note.trim(),
  }

  let next: State = {
    ...state,
    products,
    purchases: [purchase, ...state.purchases],
    seq: { ...state.seq, purchase: state.seq.purchase + 1 },
  }

  if (paid > 0 && input.account) {
    next = withMovement(next, makeMovement({
      date: now,
      account: input.account,
      direction: 'out',
      amount: paid,
      kind: 'compra',
      concept: `Compra ${purchase.number}`,
      refId: purchase.id,
    }))
  }

  if (balance > 0) {
    const payable: Payable = {
      id: crypto.randomUUID(),
      number: `P-${String(next.seq.payable).padStart(4, '0')}`,
      date: now,
      supplierId: supplier.id,
      name: supplier.name,
      concept: `Compra ${purchase.number}`,
      kind: 'mercancia',
      total: balance,
      paid: 0,
      balance,
      purchaseId: purchase.id,
      note: purchase.note,
    }
    next = { ...next, payables: [payable, ...next.payables], seq: { ...next.seq, payable: next.seq.payable + 1 } }
  }

  return { ok: true, data: { purchase, state: next } }
}

export function applyReturn(state: State, saleId: string): Result<{ state: State; sale: Sale }> {
  const sale = state.sales.find((item) => item.id === saleId)
  if (!sale) return fail('Venta no encontrada')
  if (sale.status === 'devuelta') return fail('Este ticket ya fue devuelto')

  let products = state.products
  for (const line of sale.lines) {
    const product = products.find((item) => item.id === line.productId)
    if (!product) return fail(`La prenda ${line.name} ya no está en el catálogo`)
    const nextQty = product.stock + line.qty
    const nextCost = Math.round((product.stock * product.cost + line.qty * line.cost) / nextQty)
    products = products.map((item) => (item.id === product.id ? { ...item, stock: nextQty, cost: nextCost } : item))
  }

  const now = new Date().toISOString()
  const returned: Sale = { ...sale, status: 'devuelta', returnedAt: now, balance: 0 }
  const chunks: { account: CashAccount; amount: number }[] = []
  if (sale.downPaid > 0 && sale.account) chunks.push({ account: sale.account, amount: sale.downPaid })
  for (const collection of state.collections) {
    for (const application of collection.applications) {
      if (application.saleId === sale.id && application.amount > 0) {
        chunks.push({ account: collection.account, amount: application.amount })
      }
    }
  }

  let next: State = {
    ...state,
    products,
    sales: state.sales.map((item) => (item.id === sale.id ? returned : item)),
    customers: state.customers.map((customer) =>
      customer.id === sale.customerId && sale.balance > 0
        ? { ...customer, balance: customer.balance - sale.balance }
        : customer,
    ),
  }
  for (const chunk of chunks) {
    next = withMovement(next, makeMovement({
      date: now,
      account: chunk.account,
      direction: 'out',
      amount: chunk.amount,
      kind: 'devolucion',
      concept: `Devolución ${sale.number}`,
      refId: sale.id,
    }))
  }

  return { ok: true, data: { sale: returned, state: next } }
}

export function applyOpening(state: State, input: OpeningInput): Result<{ state: State }> {
  const amount = moneyOf(input.amount)
  if (amount <= 0) return fail('Escribe el saldo inicial')
  const now = new Date().toISOString()
  return {
    ok: true,
    data: {
      state: withMovement(state, makeMovement({
        date: now,
        account: input.account,
        direction: 'in',
        amount,
        kind: 'apertura',
        concept: input.note.trim() || 'Saldo inicial',
        refId: null,
      })),
    },
  }
}

export function applyExpense(state: State, input: ExpenseInput): Result<{ state: State }> {
  const amount = moneyOf(input.amount)
  const concept = input.concept.trim()
  if (!concept) return fail('Escribe el concepto')
  if (amount <= 0) return fail('Escribe el valor')
  const now = new Date().toISOString()
  return {
    ok: true,
    data: {
      state: withMovement(state, makeMovement({
        date: now,
        account: input.account,
        direction: 'out',
        amount,
        kind: input.kind,
        concept,
        refId: null,
      })),
    },
  }
}

export function applyTransfer(state: State, input: TransferInput): Result<{ state: State }> {
  const amount = moneyOf(input.amount)
  if (amount <= 0) return fail('Escribe el valor a pasar')
  if (input.from === input.to) return fail('Elige dos cuentas distintas')
  const now = new Date().toISOString()
  const refId = crypto.randomUUID()
  const note = input.note.trim()
  const out = makeMovement({
    date: now,
    account: input.from,
    direction: 'out',
    amount,
    kind: 'transferencia',
    concept: note || `Pasaron a ${input.to}`,
    refId,
  })
  const into = makeMovement({
    date: now,
    account: input.to,
    direction: 'in',
    amount,
    kind: 'transferencia',
    concept: note || `Llegó de ${input.from}`,
    refId,
  })
  return { ok: true, data: { state: { ...state, movements: [into, out, ...state.movements] } } }
}

export function applyPayable(state: State, input: PayableInput): Result<{ state: State; payable: Payable }> {
  const name = input.name.trim()
  const concept = input.concept.trim()
  const total = moneyOf(input.total)
  if (!name) return fail('Escribe a quién se le debe')
  if (!concept) return fail('Escribe el concepto')
  if (total <= 0) return fail('El valor debe ser mayor a cero')
  const payable: Payable = {
    id: crypto.randomUUID(),
    number: `P-${String(state.seq.payable).padStart(4, '0')}`,
    date: new Date().toISOString(),
    supplierId: input.supplierId,
    name,
    concept,
    kind: input.kind,
    total,
    paid: 0,
    balance: total,
    purchaseId: null,
    note: input.note.trim(),
  }
  return {
    ok: true,
    data: {
      payable,
      state: {
        ...state,
        payables: [payable, ...state.payables],
        seq: { ...state.seq, payable: state.seq.payable + 1 },
      },
    },
  }
}

export function applyPayablePayment(state: State, input: PayablePaymentInput): Result<{ state: State }> {
  const payable = state.payables.find((item) => item.id === input.payableId)
  if (!payable) return fail('Obligación no encontrada')
  const amount = moneyOf(input.amount)
  if (amount <= 0) return fail('Escribe el valor del pago')
  if (amount > payable.balance) return fail('El pago supera el saldo de la obligación')
  const now = new Date().toISOString()
  const next = withMovement({
    ...state,
    payables: state.payables.map((item) => item.id === payable.id
      ? { ...item, paid: item.paid + amount, balance: item.balance - amount }
      : item),
  }, makeMovement({
    date: now,
    account: input.account,
    direction: 'out',
    amount,
    kind: 'pago',
    concept: `Pago ${payable.number} · ${payable.name}`,
    refId: payable.id,
  }))
  return { ok: true, data: { state: next } }
}

export function applyProduct(
  state: State,
  input: ProductInput,
  id?: string,
): Result<{ state: State; product: Product }> {
  const sku = input.sku.trim().toUpperCase()
  const name = input.name.trim()
  const color = input.color.trim()
  const size = input.size.trim()
  const price = moneyOf(input.price)
  const cost = moneyOf(input.cost)
  const stock = Math.round(input.stock)
  const minStock = Math.round(input.minStock)

  if (!sku) return fail('Escribe un SKU')
  if (state.products.some((product) => product.sku === sku && product.id !== id)) return fail('Ese SKU ya existe')
  if (!name) return fail('Escribe el nombre de la prenda')
  if (!input.category) return fail('Elige una categoría')
  if (!color || !size) return fail('Color y talla son obligatorios')
  if (price <= 0) return fail('El precio de venta debe ser mayor a cero')
  if (stock < 0 || minStock < 0) return fail('Las existencias no pueden ser negativas')

  if (!id) {
    const product: Product = {
      id: crypto.randomUUID(),
      sku,
      name,
      category: input.category,
      color,
      size,
      cost,
      price,
      stock,
      minStock,
      active: true,
    }
    return { ok: true, data: { product, state: { ...state, products: [product, ...state.products] } } }
  }

  const current = state.products.find((product) => product.id === id)
  if (!current) return fail('Prenda no encontrada')
  const product: Product = {
    ...current,
    sku,
    name,
    category: input.category,
    color,
    size,
    price,
    minStock,
  }
  return {
    ok: true,
    data: {
      product,
      state: { ...state, products: state.products.map((item) => (item.id === id ? product : item)) },
    },
  }
}

export function applyProductActive(state: State, id: string, active: boolean): State {
  return {
    ...state,
    products: state.products.map((product) => (product.id === id ? { ...product, active } : product)),
  }
}

export function applyCustomer(
  state: State,
  input: CustomerInput,
  id?: string,
): Result<{ state: State; customer: Customer }> {
  const name = input.name.trim()
  const email = input.email.trim()
  const creditLimit = moneyOf(input.creditLimit)
  if (!name) return fail('Escribe el nombre')
  if (email && !email.includes('@')) return fail('El correo no parece válido')

  if (!id) {
    const customer: Customer = {
      id: crypto.randomUUID(),
      name,
      phone: input.phone.trim(),
      email,
      city: input.city.trim(),
      creditLimit,
      balance: 0,
      since: new Date().toISOString(),
    }
    return { ok: true, data: { customer, state: { ...state, customers: [customer, ...state.customers] } } }
  }

  const current = state.customers.find((customer) => customer.id === id)
  if (!current) return fail('Cliente no encontrado')
  if (creditLimit < current.balance) return fail('El cupo no puede ser menor que el saldo')
  const customer: Customer = {
    ...current,
    name,
    phone: input.phone.trim(),
    email,
    city: input.city.trim(),
    creditLimit,
  }
  return {
    ok: true,
    data: {
      customer,
      state: {
        ...state,
        customers: state.customers.map((item) => (item.id === id ? customer : item)),
        sales: state.sales.map((sale) => (sale.customerId === id ? { ...sale, customerName: name } : sale)),
      },
    },
  }
}

export function applyRemoveCustomer(state: State, id: string): Result<{ state: State }> {
  const customer = state.customers.find((item) => item.id === id)
  if (!customer) return fail('Cliente no encontrado')
  if (customer.balance > 0) return fail('Este cliente todavía tiene saldo por cobrar')
  return { ok: true, data: { state: { ...state, customers: state.customers.filter((item) => item.id !== id) } } }
}

export function applySupplier(
  state: State,
  input: SupplierInput,
  id?: string,
): Result<{ state: State; supplier: Supplier }> {
  const name = input.name.trim()
  if (!name) return fail('Escribe el nombre del proveedor')
  const fields = {
    name,
    contact: input.contact.trim(),
    phone: input.phone.trim(),
    city: input.city.trim(),
    specialty: input.specialty.trim(),
  }
  if (!id) {
    const supplier: Supplier = { id: crypto.randomUUID(), ...fields }
    return { ok: true, data: { supplier, state: { ...state, suppliers: [supplier, ...state.suppliers] } } }
  }
  const current = state.suppliers.find((supplier) => supplier.id === id)
  if (!current) return fail('Proveedor no encontrado')
  const supplier: Supplier = { ...current, ...fields }
  return {
    ok: true,
    data: {
      supplier,
      state: { ...state, suppliers: state.suppliers.map((item) => (item.id === id ? supplier : item)) },
    },
  }
}

export function applyRemoveSupplier(state: State, id: string): Result<{ state: State }> {
  if (!state.suppliers.some((supplier) => supplier.id === id)) return fail('Proveedor no encontrado')
  if (state.payables.some((payable) => payable.supplierId === id && payable.balance > 0)) {
    return fail('Este proveedor todavía tiene saldo por pagar')
  }
  return { ok: true, data: { state: { ...state, suppliers: state.suppliers.filter((item) => item.id !== id) } } }
}
