import type {
  CashMethod,
  Collection,
  Customer,
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
  paid: number
  tendered: number
  note: string
}

export type CollectionInput = {
  customerId: string
  amount: number
  method: CashMethod
  note: string
  saleId?: string
}

export type PurchaseInput = {
  supplierId: string
  note: string
  lines: { productId: string; qty: number; cost: number }[]
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

function fail(error: string): Result<never> {
  return { ok: false, error }
}

function moneyOf(value: number) {
  return Math.max(0, Math.round(value))
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
    paid,
    balance,
    tendered,
    note: input.note.trim(),
  }

  return {
    ok: true,
    data: {
      sale,
      state: {
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
      },
    },
  }
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
    .filter((sale) => sale.customerId === customer.id && sale.balance > 0)
    .sort((a, b) => {
      if (input.saleId) {
        if (a.id === input.saleId) return -1
        if (b.id === input.saleId) return 1
      }
      return a.date.localeCompare(b.date)
    })

  let remaining = amount
  const updates = new Map<string, Sale>()
  for (const sale of open) {
    if (remaining <= 0) break
    const applied = Math.min(sale.balance, remaining)
    updates.set(sale.id, { ...sale, balance: sale.balance - applied, paid: sale.paid + applied })
    remaining -= applied
  }
  if (remaining > 0) return fail('No hay ventas abiertas para aplicar este abono')

  const collection: Collection = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    customerId: customer.id,
    customerName: customer.name,
    amount,
    method: input.method,
    note: input.note.trim(),
    saleId: input.saleId ?? null,
  }

  return {
    ok: true,
    data: {
      collection,
      state: {
        ...state,
        collections: [collection, ...state.collections],
        sales: state.sales.map((sale) => updates.get(sale.id) ?? sale),
        customers: state.customers.map((item) =>
          item.id === customer.id ? { ...item, balance: item.balance - amount } : item,
        ),
      },
    },
  }
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

  const purchase: Purchase = {
    id: crypto.randomUUID(),
    number: `C-${String(state.seq.purchase).padStart(4, '0')}`,
    date: new Date().toISOString(),
    supplierId: supplier.id,
    supplierName: supplier.name,
    lines,
    total: lines.reduce((sum, line) => sum + line.cost * line.qty, 0),
    note: input.note.trim(),
  }

  return {
    ok: true,
    data: {
      purchase,
      state: {
        ...state,
        products,
        purchases: [purchase, ...state.purchases],
        seq: { ...state.seq, purchase: state.seq.purchase + 1 },
      },
    },
  }
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
  const product: Product = { ...current, sku, name, category: input.category, color, size, cost, price, stock, minStock }
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
  return { ok: true, data: { state: { ...state, suppliers: state.suppliers.filter((item) => item.id !== id) } } }
}
