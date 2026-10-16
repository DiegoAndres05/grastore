export type PayMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'credito'
export type CashMethod = Exclude<PayMethod, 'credito'>
export type CashAccount = 'efectivo' | 'nequi' | 'bancolombia' | 'tarjeta'
export type MovementKind = 'venta' | 'abono' | 'compra' | 'pago' | 'gasto' | 'retiro' | 'transferencia' | 'devolucion' | 'apertura'
export type PayableKind = 'mercancia' | 'servicio' | 'sueldo' | 'otro'
export type SaleStatus = 'activa' | 'devuelta'

export type Product = {
  id: string
  sku: string
  name: string
  category: string
  color: string
  size: string
  cost: number
  price: number
  stock: number
  minStock: number
  active: boolean
}

export type Customer = {
  id: string
  name: string
  phone: string
  email: string
  city: string
  creditLimit: number
  balance: number
  since: string
}

export type Supplier = {
  id: string
  name: string
  contact: string
  phone: string
  city: string
  specialty: string
}

export type SaleLine = {
  productId: string
  sku: string
  name: string
  color: string
  size: string
  qty: number
  price: number
  cost: number
}

export type Sale = {
  id: string
  number: string
  date: string
  customerId: string | null
  customerName: string
  lines: SaleLine[]
  discount: number
  total: number
  method: PayMethod
  account: CashAccount | null
  paid: number
  downPaid: number
  balance: number
  tendered: number | null
  note: string
  status: SaleStatus
  returnedAt: string | null
}

export type PurchaseLine = {
  productId: string
  sku: string
  name: string
  color: string
  size: string
  qty: number
  cost: number
}

export type Purchase = {
  id: string
  number: string
  date: string
  supplierId: string
  supplierName: string
  lines: PurchaseLine[]
  total: number
  paid: number
  balance: number
  account: CashAccount | null
  note: string
}

export type CollectionApplication = {
  saleId: string
  amount: number
}

export type Collection = {
  id: string
  date: string
  customerId: string
  customerName: string
  amount: number
  method: CashMethod
  account: CashAccount
  note: string
  saleId: string | null
  applications: CollectionApplication[]
}

export type CashMovement = {
  id: string
  date: string
  account: CashAccount
  direction: 'in' | 'out'
  amount: number
  kind: MovementKind
  concept: string
  refId: string | null
}

export type Payable = {
  id: string
  number: string
  date: string
  supplierId: string | null
  name: string
  concept: string
  kind: PayableKind
  total: number
  paid: number
  balance: number
  purchaseId: string | null
  note: string
}

export type State = {
  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  sales: Sale[]
  purchases: Purchase[]
  collections: Collection[]
  movements: CashMovement[]
  payables: Payable[]
  seq: { sale: number; purchase: number; payable: number }
}
