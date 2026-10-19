export type PayMethod = 'efectivo' | 'nequi' | 'bancolombia' | 'tarjeta' | 'credito' | 'transferencia'
export type CashMethod = Exclude<PayMethod, 'credito'>
export type SaleKind = 'retail' | 'opening'
export type AccountKind = 'cash' | 'wallet' | 'bank' | 'other'
export type MovementKind =
  | 'sale'
  | 'collection'
  | 'expense'
  | 'purchase'
  | 'transfer'
  | 'capital'
  | 'loan'
  | 'loan_payment'
  | 'payable'
  | 'layaway'
  | 'return'
  | 'void'
  | 'adjustment'
export type PayableKind = 'proveedor' | 'sueldo' | 'servicio' | 'capital' | 'otro'
export type LayawayStatus = 'abierto' | 'entregado' | 'cancelado'
export type BookOrigin = 'empty' | 'seed' | 'import' | 'restore'

export type Actor = { id: string; name: string }

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
  reserved?: number
  minStock: number
  active: boolean
  location?: string
  brand?: string
  design?: string
  createdBy?: string | null
  createdByName?: string | null
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
  createdBy?: string | null
  createdByName?: string | null
}

export type Supplier = {
  id: string
  name: string
  contact: string
  phone: string
  city: string
  specialty: string
  createdBy?: string | null
  createdByName?: string | null
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
  returnedQty?: number
}

export type SalePayment = {
  method: CashMethod
  amount: number
  accountId: string | null
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
  accountId?: string | null
  cashIn?: number
  payments?: SalePayment[]
  dueDate?: string | null
  kind?: SaleKind
  voided?: boolean
  voidedBy?: string | null
  voidedByName?: string | null
  affectsStock?: boolean
  layawayId?: string | null
  createdBy?: string | null
  createdByName?: string | null
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
  accountId?: string | null
  payableId?: string | null
  createdBy?: string | null
  createdByName?: string | null
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
  accountId?: string | null
  createdBy?: string | null
  createdByName?: string | null
}

export type Account = {
  id: string
  name: string
  kind: AccountKind
  openingBalance: number
  active: boolean
  createdBy?: string | null
  createdByName?: string | null
}

export type Movement = {
  id: string
  date: string
  accountId: string
  kind: MovementKind
  direction: 'in' | 'out'
  amount: number
  counterparty: string
  note: string
  refId: string | null
  createdBy?: string | null
  createdByName?: string | null
}

export type Expense = {
  id: string
  number: string
  date: string
  category: string
  amount: number
  accountId: string | null
  payableId: string | null
  payee: string
  note: string
  createdBy?: string | null
  createdByName?: string | null
}

export type Payable = {
  id: string
  date: string
  creditor: string
  supplierId: string | null
  concept: string
  kind: PayableKind
  category: string
  original: number
  balance: number
  note: string
  createdBy?: string | null
  createdByName?: string | null
}

export type PayablePayment = {
  id: string
  date: string
  payableId: string
  amount: number
  accountId: string
  note: string
  createdBy?: string | null
  createdByName?: string | null
}

export type CapitalEvent = {
  id: string
  date: string
  kind: 'aporte' | 'prestamo'
  person: string
  amount: number
  accountId: string | null
  payableId: string | null
  note: string
  createdBy?: string | null
  createdByName?: string | null
}

export type Loan = {
  id: string
  date: string
  person: string
  customerId: string | null
  original: number
  balance: number
  dueDate: string | null
  note: string
  createdBy?: string | null
  createdByName?: string | null
}

export type LoanPayment = {
  id: string
  date: string
  loanId: string
  amount: number
  accountId: string | null
  note: string
  createdBy?: string | null
  createdByName?: string | null
}

export type Layaway = {
  id: string
  number: string
  date: string
  dueDate: string | null
  customerId: string
  customerName: string
  lines: SaleLine[]
  total: number
  deposited: number
  balance: number
  status: LayawayStatus
  note: string
  /** Caja del abono. La devolución de la entrega usa esta cuenta. */
  accountId?: string | null
  createdBy?: string | null
  createdByName?: string | null
}

export type SaleReturn = {
  id: string
  date: string
  saleId: string
  saleNumber: string
  lines: { productId: string; qty: number; price: number; cost: number }[]
  amount: number
  accountId: string | null
  note: string
  createdBy?: string | null
  createdByName?: string | null
}

export type Adjustment = {
  id: string
  date: string
  productId: string
  sku: string
  name: string
  qtyDelta: number
  reason: string
  createdBy?: string | null
  createdByName?: string | null
}

export type Investment = {
  id: string
  date: string
  supplierId: string | null
  supplierName: string
  amount: number
  allocated: number
  accountId: string | null
  payableId: string | null
  note: string
  location: string
  createdBy?: string | null
  createdByName?: string | null
}

export type OpeningPnl = {
  sales: number
  cogs: number
  asOf: string
  note: string
}

export type Settings = {
  salarySharePct: number
  categories: string[]
  colors: string[]
}

export type BookMeta = {
  origin: BookOrigin
  importedAt: string | null
}

export type State = {
  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  sales: Sale[]
  purchases: Purchase[]
  collections: Collection[]
  accounts: Account[]
  movements: Movement[]
  expenses: Expense[]
  payables: Payable[]
  payablePayments: PayablePayment[]
  capitalEvents: CapitalEvent[]
  loans: Loan[]
  loanPayments: LoanPayment[]
  layaways: Layaway[]
  returns: SaleReturn[]
  adjustments: Adjustment[]
  investments: Investment[]
  openingPnl: OpeningPnl | null
  settings: Settings
  seq: { sale: number; purchase: number; layaway: number; expense: number }
  meta: BookMeta
}
