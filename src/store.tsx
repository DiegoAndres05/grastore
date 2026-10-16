import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { createEmpty, createSeed } from './data/seed'
import { normalizeState } from './lib/books'
import {
  applyCheckout,
  applyCollection,
  applyCustomer,
  applyExpense,
  applyOpening,
  applyPayable,
  applyPayablePayment,
  applyProduct,
  applyProductActive,
  applyPurchase,
  applyRemoveCustomer,
  applyRemoveSupplier,
  applyReturn,
  applySupplier,
  applyTransfer,
  type CheckoutInput,
  type CollectionInput,
  type CustomerInput,
  type ExpenseInput,
  type OpeningInput,
  type PayableInput,
  type PayablePaymentInput,
  type ProductInput,
  type PurchaseInput,
  type Result,
  type SupplierInput,
  type TransferInput,
} from './lib/logic'
import type { Collection, Customer, Payable, Product, Purchase, Sale, State, Supplier } from './types'

const STORAGE_KEY = 'grastore.v8'

type Toast = { id: string; text: string; tone: 'ok' | 'warn' }

type StoreApi = {
  state: State
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
  checkout: (input: CheckoutInput) => Result<Sale>
  collect: (input: CollectionInput) => Result<Collection>
  purchase: (input: PurchaseInput) => Result<Purchase>
  saveProduct: (input: ProductInput, id?: string) => Result<Product>
  setProductActive: (id: string, active: boolean) => void
  saveCustomer: (input: CustomerInput, id?: string) => Result<Customer>
  removeCustomer: (id: string) => Result<true>
  saveSupplier: (input: SupplierInput, id?: string) => Result<Supplier>
  removeSupplier: (id: string) => Result<true>
  returnSale: (id: string) => Result<Sale>
  openBalance: (input: OpeningInput) => Result<true>
  recordExpense: (input: ExpenseInput) => Result<true>
  transfer: (input: TransferInput) => Result<true>
  savePayable: (input: PayableInput) => Result<Payable>
  payPayable: (input: PayablePaymentInput) => Result<true>
  resetDemo: () => void
}

const StoreContext = createContext<StoreApi | null>(null)

function readStored(key: string): State | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: number; state?: State }
    if (!parsed.state || !Array.isArray(parsed.state.products) || !Array.isArray(parsed.state.sales)) return null
    if (parsed.version !== 8) return null
    return normalizeState(parsed.state)
  } catch {
    return null
  }
}

function load(): State {
  return readStored(STORAGE_KEY) ?? createEmpty()
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load)
  const [toasts, setToasts] = useState<Toast[]>([])
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 8, state }))
  }, [state])

  function commit(next: State) {
    stateRef.current = next
    setState(next)
  }

  function toast(text: string, tone: Toast['tone'] = 'ok') {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, text, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 3400)
  }

  const api: StoreApi = {
    state,
    toasts,
    toast,
    checkout(input) {
      const applied = applyCheckout(stateRef.current, input)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: applied.data.sale }
    },
    collect(input) {
      const applied = applyCollection(stateRef.current, input)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: applied.data.collection }
    },
    purchase(input) {
      const applied = applyPurchase(stateRef.current, input)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: applied.data.purchase }
    },
    saveProduct(input, id) {
      const applied = applyProduct(stateRef.current, input, id)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: applied.data.product }
    },
    setProductActive(id, active) {
      commit(applyProductActive(stateRef.current, id, active))
    },
    saveCustomer(input, id) {
      const applied = applyCustomer(stateRef.current, input, id)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: applied.data.customer }
    },
    removeCustomer(id) {
      const applied = applyRemoveCustomer(stateRef.current, id)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: true }
    },
    saveSupplier(input, id) {
      const applied = applySupplier(stateRef.current, input, id)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: applied.data.supplier }
    },
    removeSupplier(id) {
      const applied = applyRemoveSupplier(stateRef.current, id)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: true }
    },
    returnSale(id) {
      const applied = applyReturn(stateRef.current, id)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: applied.data.sale }
    },
    openBalance(input) {
      const applied = applyOpening(stateRef.current, input)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: true }
    },
    recordExpense(input) {
      const applied = applyExpense(stateRef.current, input)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: true }
    },
    transfer(input) {
      const applied = applyTransfer(stateRef.current, input)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: true }
    },
    savePayable(input) {
      const applied = applyPayable(stateRef.current, input)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: applied.data.payable }
    },
    payPayable(input) {
      const applied = applyPayablePayment(stateRef.current, input)
      if (!applied.ok) return applied
      commit(applied.data.state)
      return { ok: true, data: true }
    },
    resetDemo() {
      commit(createSeed())
      toast('Libro de muestra restaurado')
    },
  }

  return (
    <StoreContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`toast-in pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-2xl ${item.tone === 'warn' ? 'border-danger/50 bg-[#1a1010] text-danger' : 'border-brass/40 bg-espresso text-ink'}`}
          >
            {item.text}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  )
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('GraStore no está listo')
  return store
}
