export type PayMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'credito'
export type CashMethod = Exclude<PayMethod, 'credito'>

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
  paid: number
  balance: number
  tendered: number | null
  note: string
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
  note: string
}

export type Collection = {
  id: string
  date: string
  customerId: string
  customerName: string
  amount: number
  method: CashMethod
  note: string
  saleId: string | null
}

export type State = {
  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  sales: Sale[]
  purchases: Purchase[]
  collections: Collection[]
  seq: { sale: number; purchase: number }
}
