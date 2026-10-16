import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { createSeed } from './data/seed'
import { bookIsEmpty, emptyState, hydrate, isDemoBook, loadLocal, parseBackup, saveLocal } from './lib/book'
import {
  applyAccountActive,
  applyAddCategory,
  applyAddColor,
  applyAdjustment,
  applyCancelLayaway,
  applyCapital,
  applyCompleteLayaway,
  applyExpense,
  applyInvestment,
  applyLayaway,
  applyLayawayDeposit,
  applyLoan,
  applyLoanPayment,
  applyPayPayable,
  applyPayable,
  applyRenameCategory,
  applyReturn,
  applySalaryShare,
  applySaveAccount,
  applySettleInvestment,
  applyTransfer,
  applyUpdateSale,
  applyVoidSale,
  type AccountInput,
  type ExpenseInput,
  type LayawayInput,
  type PayableInput,
  type SalePatch,
  type TransferInput,
} from './lib/books'
import { fetchBook, saveBook, supabase } from './lib/cloud'
import {
  applyCheckout,
  applyCollection,
  applyCustomer,
  applyProduct,
  applyProductActive,
  applyPurchase,
  applyRemoveCustomer,
  applyRemoveSupplier,
  applySupplier,
  type CheckoutInput,
  type CollectionInput,
  type CustomerInput,
  type ProductInput,
  type PurchaseInput,
  type Result,
  type SupplierInput,
} from './lib/logic'
import type { Actor, State } from './types'

type Toast = { id: string; text: string; tone: 'ok' | 'warn' }

type StoreApi = {
  state: State
  toasts: Toast[]
  mode: 'local' | 'cloud'
  syncing: boolean
  actor: Actor
  toast: (text: string, tone?: Toast['tone']) => void
  checkout: (input: CheckoutInput) => Result<State['sales'][number]>
  collect: (input: CollectionInput) => Result<State['collections'][number]>
  purchase: (input: PurchaseInput) => Result<State['purchases'][number]>
  saveProduct: (input: ProductInput, id?: string) => Result<State['products'][number]>
  setProductActive: (id: string, active: boolean) => void
  saveCustomer: (input: CustomerInput, id?: string) => Result<State['customers'][number]>
  removeCustomer: (id: string) => Result<true>
  saveSupplier: (input: SupplierInput, id?: string) => Result<State['suppliers'][number]>
  removeSupplier: (id: string) => Result<true>
  transfer: (input: TransferInput) => Result<true>
  saveAccount: (input: AccountInput, id?: string) => Result<State['accounts'][number]>
  setAccountActive: (id: string, active: boolean) => void
  expense: (input: ExpenseInput) => Result<State['expenses'][number]>
  savePayable: (input: PayableInput) => Result<State['payables'][number]>
  payPayable: (input: { payableId: string; amount: number; accountId: string; date?: string; note?: string }) => Result<true>
  capital: (input: { kind: 'aporte' | 'prestamo'; person: string; amount: number; accountId: string; date?: string; note?: string }) => Result<true>
  loan: (input: { person: string; amount: number; accountId: string; dueDate?: string | null; date?: string; note?: string }) => Result<State['loans'][number]>
  payLoan: (input: { loanId: string; amount: number; accountId: string; date?: string; note?: string }) => Result<true>
  layaway: (input: LayawayInput) => Result<State['layaways'][number]>
  layawayDeposit: (input: { layawayId: string; amount: number; accountId: string; date?: string; note?: string }) => Result<true>
  completeLayaway: (input: { layawayId: string; date?: string }) => Result<State['sales'][number]>
  cancelLayaway: (input: { layawayId: string; accountId?: string | null; date?: string }) => Result<true>
  voidSale: (saleId: string, date?: string) => Result<true>
  updateSale: (saleId: string, patch: SalePatch) => Result<State['sales'][number]>
  returnSale: (input: { saleId: string; lines: { index: number; qty: number }[]; accountId?: string | null; date?: string; note?: string }) => Result<true>
  adjust: (input: { productId: string; qtyDelta: number; reason: string; date?: string }) => Result<true>
  invest: (input: { supplierId: string; amount: number; note?: string; date?: string; accountId?: string | null; onCredit?: boolean }) => Result<true>
  settleInvestment: (id: string) => Result<true>
  addCategory: (name: string) => Result<true>
  renameCategory: (from: string, to: string) => Result<true>
  addColor: (name: string) => Result<true>
  setSalaryShare: (percent: number) => Result<true>
  replaceBook: (next: State) => void
  loadSample: () => Result<true>
  restoreBackup: (raw: string) => Result<true>
  signOut: () => Promise<void>
}

const StoreContext = createContext<StoreApi | null>(null)

export function StoreProvider({
  children,
  actor,
  mode,
}: {
  children: ReactNode
  actor: Actor
  mode: 'local' | 'cloud'
}) {
  const [state, setState] = useState<State>(() => (mode === 'local' ? loadLocal() : emptyCloud()))
  const [ready, setReady] = useState(mode === 'local')
  const [syncing, setSyncing] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const stateRef = useRef(state)
  const versionRef = useRef(0)
  const skipSave = useRef(false)
  const actorRef = useRef(actor)
  useEffect(() => {
    actorRef.current = actor
  }, [actor])

  function toast(text: string, tone: Toast['tone'] = 'ok') {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, text, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3400)
  }
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  })

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (mode !== 'cloud') return
    let cancel = false
    const db = supabase()
    void (async () => {
      try {
        const book = await fetchBook()
        if (cancel) return
        if (book) {
          versionRef.current = book.version
          skipSave.current = true
          setState(hydrate(book.data))
        } else if (isDemoBook(stateRef.current) || bookIsEmpty(stateRef.current)) {
          skipSave.current = true
          setState(emptyState())
        }
      } catch {
        if (!cancel) toastRef.current('No se pudo abrir el libro compartido. Sigues en la copia de este navegador.', 'warn')
      } finally {
        if (!cancel) setReady(true)
      }
    })()
    const channel = db
      ?.channel('grastore-book')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books', filter: 'id=eq.main' }, (payload) => {
        const row = payload.new as { version?: number; data?: unknown }
        if (!row?.version || row.version === versionRef.current) return
        versionRef.current = row.version
        skipSave.current = true
        setState(hydrate(row.data))
        toastRef.current('El libro se actualizó desde otro usuario')
      })
      .subscribe()
    return () => {
      cancel = true
      if (channel && db) void db.removeChannel(channel)
    }
  }, [mode])

  useEffect(() => {
    if (!ready) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    if (mode === 'local') {
      saveLocal(state)
      return
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        setSyncing(true)
        const result = await saveBook(state, versionRef.current, actorRef.current.id)
        if (result.ok) versionRef.current = result.version
        else if (result.conflict) {
          try {
            const latest = await fetchBook()
            if (latest) {
              versionRef.current = latest.version
              skipSave.current = true
              setState(hydrate(latest.data))
              toastRef.current('Otro usuario guardó el libro. Se recargó la versión más reciente.', 'warn')
            }
          } catch {
            toastRef.current('No se pudo sincronizar el libro', 'warn')
          }
        } else toastRef.current(result.message, 'warn')
        setSyncing(false)
      })()
    }, 700)
    return () => window.clearTimeout(handle)
  }, [state, ready, mode])

  function commit(next: State) {
    stateRef.current = next
    setState(next)
  }

  function done<R extends { state: State }, T>(result: Result<R>, pick: (data: R) => T): Result<T> {
    if (!result.ok) return result
    commit(result.data.state)
    return { ok: true, data: pick(result.data) }
  }

  const actorNow = () => actorRef.current

  const api: StoreApi = {
    state,
    toasts,
    mode,
    syncing,
    actor,
    toast,
    checkout(input) {
      return done(applyCheckout(stateRef.current, { ...input, actor: actorNow() }), (data) => data.sale)
    },
    collect(input) {
      return done(applyCollection(stateRef.current, { ...input, actor: actorNow() }), (data) => data.collection)
    },
    purchase(input) {
      return done(applyPurchase(stateRef.current, { ...input, actor: actorNow() }), (data) => data.purchase)
    },
    saveProduct(input, id) {
      return done(applyProduct(stateRef.current, { ...input, actor: actorNow() }, id), (data) => data.product)
    },
    setProductActive(id, active) {
      commit(applyProductActive(stateRef.current, id, active))
    },
    saveCustomer(input, id) {
      return done(applyCustomer(stateRef.current, input, id), (data) => data.customer)
    },
    removeCustomer(id) {
      return done(applyRemoveCustomer(stateRef.current, id), () => true)
    },
    saveSupplier(input, id) {
      return done(applySupplier(stateRef.current, input, id), (data) => data.supplier)
    },
    removeSupplier(id) {
      return done(applyRemoveSupplier(stateRef.current, id), () => true)
    },
    transfer(input) {
      return done(applyTransfer(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    saveAccount(input, id) {
      return done(applySaveAccount(stateRef.current, { ...input, actor: actorNow() }, id), (data) => data.account)
    },
    setAccountActive(id, active) {
      commit(applyAccountActive(stateRef.current, id, active))
    },
    expense(input) {
      return done(applyExpense(stateRef.current, { ...input, actor: actorNow() }), (data) => data.expense)
    },
    savePayable(input) {
      return done(applyPayable(stateRef.current, { ...input, actor: actorNow() }), (data) => data.payable)
    },
    payPayable(input) {
      return done(applyPayPayable(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    capital(input) {
      return done(applyCapital(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    loan(input) {
      return done(applyLoan(stateRef.current, { ...input, actor: actorNow() }), (data) => data.loan)
    },
    payLoan(input) {
      return done(applyLoanPayment(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    layaway(input) {
      return done(applyLayaway(stateRef.current, { ...input, actor: actorNow() }), (data) => data.layaway)
    },
    layawayDeposit(input) {
      return done(applyLayawayDeposit(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    completeLayaway(input) {
      return done(applyCompleteLayaway(stateRef.current, { ...input, actor: actorNow() }), (data) => data.sale)
    },
    cancelLayaway(input) {
      return done(applyCancelLayaway(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    voidSale(saleId, date) {
      return done(applyVoidSale(stateRef.current, { saleId, date, actor: actorNow() }), () => true)
    },
    updateSale(saleId, patch) {
      return done(applyUpdateSale(stateRef.current, saleId, patch), (data) => data.sale)
    },
    returnSale(input) {
      return done(applyReturn(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    adjust(input) {
      return done(applyAdjustment(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    invest(input) {
      return done(applyInvestment(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    settleInvestment(id) {
      return done(applySettleInvestment(stateRef.current, id), () => true)
    },
    addCategory(name) {
      return done(applyAddCategory(stateRef.current, name), () => true)
    },
    renameCategory(from, to) {
      return done(applyRenameCategory(stateRef.current, from, to), () => true)
    },
    addColor(name) {
      return done(applyAddColor(stateRef.current, name), () => true)
    },
    setSalaryShare(percent) {
      return done(applySalaryShare(stateRef.current, percent), () => true)
    },
    replaceBook(next) {
      commit(next)
      toast('Libro importado')
    },
    loadSample() {
      if (!bookIsEmpty(stateRef.current)) return { ok: false, error: 'El libro ya tiene datos. Descarga un respaldo antes de reemplazarlo.' }
      commit(createSeed())
      toast('Muestra cargada en este navegador')
      return { ok: true, data: true }
    },
    restoreBackup(raw) {
      try {
        const next = parseBackup(raw)
        commit(next)
        toast('Respaldo restaurado')
        return { ok: true, data: true }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'No se pudo leer el respaldo' }
      }
    },
    async signOut() {
      await supabase()?.auth.signOut()
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

function emptyCloud(): State {
  return loadLocal()
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('GraStore no está listo')
  return store
}
