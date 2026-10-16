import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { createSeed } from './data/seed'
import { bookIsEmpty, emptyState, loadLocal, parseBackup, saveLocal } from './lib/book'
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
import { fullAccess, type Access } from './lib/access'
import { fetchSnapshot, postBook, supabase } from './lib/cloud'
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
  access: Access
  can: (permission: string) => boolean
  toast: (text: string, tone?: Toast['tone']) => void
  checkout: (input: CheckoutInput) => Promise<Result<State['sales'][number]>>
  collect: (input: CollectionInput) => Promise<Result<State['collections'][number]>>
  purchase: (input: PurchaseInput) => Promise<Result<State['purchases'][number]>>
  saveProduct: (input: ProductInput, id?: string) => Promise<Result<State['products'][number]>>
  setProductActive: (id: string, active: boolean) => Promise<Result<true>>
  saveCustomer: (input: CustomerInput, id?: string) => Promise<Result<State['customers'][number]>>
  removeCustomer: (id: string) => Promise<Result<true>>
  saveSupplier: (input: SupplierInput, id?: string) => Promise<Result<State['suppliers'][number]>>
  removeSupplier: (id: string) => Promise<Result<true>>
  transfer: (input: TransferInput) => Promise<Result<true>>
  saveAccount: (input: AccountInput, id?: string) => Promise<Result<State['accounts'][number]>>
  setAccountActive: (id: string, active: boolean) => Promise<Result<true>>
  expense: (input: ExpenseInput) => Promise<Result<State['expenses'][number]>>
  savePayable: (input: PayableInput) => Promise<Result<State['payables'][number]>>
  payPayable: (input: { payableId: string; amount: number; accountId: string; date?: string; note?: string }) => Promise<Result<true>>
  capital: (input: { kind: 'aporte' | 'prestamo'; person: string; amount: number; accountId: string; date?: string; note?: string }) => Promise<Result<true>>
  loan: (input: { person: string; amount: number; accountId: string; dueDate?: string | null; date?: string; note?: string }) => Promise<Result<State['loans'][number]>>
  payLoan: (input: { loanId: string; amount: number; accountId: string; date?: string; note?: string }) => Promise<Result<true>>
  layaway: (input: LayawayInput) => Promise<Result<State['layaways'][number]>>
  layawayDeposit: (input: { layawayId: string; amount: number; accountId: string; date?: string; note?: string }) => Promise<Result<true>>
  completeLayaway: (input: { layawayId: string; date?: string }) => Promise<Result<State['sales'][number]>>
  cancelLayaway: (input: { layawayId: string; accountId?: string | null; date?: string }) => Promise<Result<true>>
  voidSale: (saleId: string, date?: string) => Promise<Result<true>>
  updateSale: (saleId: string, patch: SalePatch) => Promise<Result<State['sales'][number]>>
  returnSale: (input: { saleId: string; lines: { index: number; qty: number }[]; accountId?: string | null; date?: string; note?: string }) => Promise<Result<true>>
  adjust: (input: { productId: string; qtyDelta: number; reason: string; date?: string }) => Promise<Result<true>>
  invest: (input: { supplierId: string; amount: number; note?: string; date?: string; accountId?: string | null; onCredit?: boolean }) => Promise<Result<true>>
  settleInvestment: (id: string) => Promise<Result<true>>
  addCategory: (name: string) => Promise<Result<true>>
  renameCategory: (from: string, to: string) => Promise<Result<true>>
  addColor: (name: string) => Promise<Result<true>>
  setSalaryShare: (percent: number) => Promise<Result<true>>
  replaceBook: (next: State) => Promise<Result<true>>
  loadSample: () => Promise<Result<true>>
  restoreBackup: (raw: string) => Promise<Result<true>>
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
  const [state, setState] = useState<State>(() => (mode === 'local' ? loadLocal() : emptyState()))
  const [access, setAccess] = useState<Access>(() => (mode === 'local' ? fullAccess().access : { roleId: '', roleName: '', active: true, permissions: [] }))
  const [ready, setReady] = useState(mode === 'local')
  const [syncing, setSyncing] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const stateRef = useRef(state)
  const versionRef = useRef(0)
  const requestGen = useRef(0)
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
    const pull = async (announce: boolean) => {
      const snap = await fetchSnapshot()
      if (cancel || !snap) return
      if (!snap.access.active) {
        await db?.auth.signOut()
        return
      }
      const changed = snap.version !== versionRef.current
      versionRef.current = snap.version
      setAccess(snap.access)
      skipSave.current = true
      setState(snap.state)
      if (announce && changed) toastRef.current('El libro se actualizó')
    }
    void pull(false)
      .catch(() => {
        if (!cancel) toastRef.current('No se pudo abrir el libro compartido.', 'warn')
      })
      .finally(() => {
        if (!cancel) setReady(true)
      })
    const channel = db
      ?.channel('grastore-book')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_signal', filter: 'id=eq.main' }, () => {
        void pull(true).catch(() => toastRef.current('No se pudo actualizar el libro', 'warn'))
      })
      .subscribe()
    return () => {
      cancel = true
      if (channel && db) void db.removeChannel(channel)
    }
  }, [mode])

  useEffect(() => {
    if (!ready || mode !== 'local') return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    saveLocal(state)
  }, [state, ready, mode])

  function commit(next: State) {
    stateRef.current = next
    setState(next)
  }

  async function perform<T>(action: string, input: unknown, local: () => Result<{ state: State }>, pick: (data: { state: State }) => T): Promise<Result<T>> {
    if (mode === 'cloud') {
      const ticket = ++requestGen.current
      setSyncing(true)
      const remote = await postBook(action, input)
      const latest = ticket === requestGen.current
      if (latest) setSyncing(false)
      if (!remote.ok) {
        if (remote.conflict && latest) {
          try {
            const snap = await fetchSnapshot()
            if (snap && ticket === requestGen.current) {
              versionRef.current = snap.version
              setAccess(snap.access)
              commit(snap.state)
            }
          } catch {
            toastRef.current('No se pudo recargar el libro', 'warn')
          }
        }
        return { ok: false, error: remote.error }
      }
      if (!latest) return { ok: true, data: remote.data as T }
      versionRef.current = remote.version
      setAccess(remote.access)
      commit(remote.state)
      return { ok: true, data: remote.data as T }
    }
    const result = local()
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
    access,
    can: (permission) => access.active && access.permissions.includes(permission),
    toast,
    checkout(input) {
      return perform('checkout', input, () => applyCheckout(stateRef.current, { ...input, actor: actorNow() }), (data) => (data as unknown as { sale: State['sales'][number] }).sale)
    },
    collect(input) {
      return perform('collect', input, () => applyCollection(stateRef.current, { ...input, actor: actorNow() }), (data) => (data as unknown as { collection: State['collections'][number] }).collection)
    },
    purchase(input) {
      return perform('purchase', input, () => applyPurchase(stateRef.current, { ...input, actor: actorNow() }), (data) => (data as unknown as { purchase: State['purchases'][number] }).purchase)
    },
    saveProduct(input, id) {
      return perform('saveProduct', { ...input, id }, () => applyProduct(stateRef.current, { ...input, actor: actorNow() }, id), (data) => (data as unknown as { product: State['products'][number] }).product)
    },
    setProductActive(id, active) {
      return perform('setProductActive', { id, active }, () => ({ ok: true, data: { state: applyProductActive(stateRef.current, id, active) } }), () => true)
    },
    saveCustomer(input, id) {
      return perform('saveCustomer', { ...input, id }, () => applyCustomer(stateRef.current, { ...input, actor: actorNow() }, id), (data) => (data as unknown as { customer: State['customers'][number] }).customer)
    },
    removeCustomer(id) {
      return perform('removeCustomer', { id }, () => applyRemoveCustomer(stateRef.current, id), () => true)
    },
    saveSupplier(input, id) {
      return perform('saveSupplier', { ...input, id }, () => applySupplier(stateRef.current, { ...input, actor: actorNow() }, id), (data) => (data as unknown as { supplier: State['suppliers'][number] }).supplier)
    },
    removeSupplier(id) {
      return perform('removeSupplier', { id }, () => applyRemoveSupplier(stateRef.current, id), () => true)
    },
    transfer(input) {
      return perform('transfer', input, () => applyTransfer(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    saveAccount(input, id) {
      return perform('saveAccount', { ...input, id }, () => applySaveAccount(stateRef.current, { ...input, actor: actorNow() }, id), (data) => (data as unknown as { account: State['accounts'][number] }).account)
    },
    setAccountActive(id, active) {
      return perform('setAccountActive', { id, active }, () => ({ ok: true, data: { state: applyAccountActive(stateRef.current, id, active) } }), () => true)
    },
    expense(input) {
      return perform('expense', input, () => applyExpense(stateRef.current, { ...input, actor: actorNow() }), (data) => (data as unknown as { expense: State['expenses'][number] }).expense)
    },
    savePayable(input) {
      return perform('savePayable', input, () => applyPayable(stateRef.current, { ...input, actor: actorNow() }), (data) => (data as unknown as { payable: State['payables'][number] }).payable)
    },
    payPayable(input) {
      return perform('payPayable', input, () => applyPayPayable(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    capital(input) {
      return perform('capital', input, () => applyCapital(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    loan(input) {
      return perform('loan', input, () => applyLoan(stateRef.current, { ...input, actor: actorNow() }), (data) => (data as unknown as { loan: State['loans'][number] }).loan)
    },
    payLoan(input) {
      return perform('payLoan', input, () => applyLoanPayment(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    layaway(input) {
      return perform('layaway', input, () => applyLayaway(stateRef.current, { ...input, actor: actorNow() }), (data) => (data as unknown as { layaway: State['layaways'][number] }).layaway)
    },
    layawayDeposit(input) {
      return perform('layawayDeposit', input, () => applyLayawayDeposit(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    completeLayaway(input) {
      return perform('completeLayaway', input, () => applyCompleteLayaway(stateRef.current, { ...input, actor: actorNow() }), (data) => (data as unknown as { sale: State['sales'][number] }).sale)
    },
    cancelLayaway(input) {
      return perform('cancelLayaway', input, () => applyCancelLayaway(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    voidSale(saleId, date) {
      return perform('voidSale', { saleId, date }, () => applyVoidSale(stateRef.current, { saleId, date, actor: actorNow() }), () => true)
    },
    updateSale(saleId, patch) {
      return perform('updateSale', { saleId, patch }, () => applyUpdateSale(stateRef.current, saleId, patch), (data) => (data as unknown as { sale: State['sales'][number] }).sale)
    },
    returnSale(input) {
      return perform('returnSale', input, () => applyReturn(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    adjust(input) {
      return perform('adjust', input, () => applyAdjustment(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    invest(input) {
      return perform('invest', input, () => applyInvestment(stateRef.current, { ...input, actor: actorNow() }), () => true)
    },
    settleInvestment(id) {
      return perform('settleInvestment', { id }, () => applySettleInvestment(stateRef.current, id), () => true)
    },
    addCategory(name) {
      return perform('addCategory', { name }, () => applyAddCategory(stateRef.current, name), () => true)
    },
    renameCategory(from, to) {
      return perform('renameCategory', { from, to }, () => applyRenameCategory(stateRef.current, from, to), () => true)
    },
    addColor(name) {
      return perform('addColor', { name }, () => applyAddColor(stateRef.current, name), () => true)
    },
    setSalaryShare(percent) {
      return perform('setSalaryShare', { percent }, () => applySalaryShare(stateRef.current, percent), () => true)
    },
    async replaceBook(next) {
      const result = await perform('replaceBook', next, () => ({ ok: true, data: { state: next } }), () => true as const)
      if (result.ok) toast('Libro importado')
      return result
    },
    async loadSample() {
      if (!bookIsEmpty(stateRef.current)) return { ok: false as const, error: 'El libro ya tiene datos. Descarga un respaldo antes de reemplazarlo.' }
      const result = await perform('loadSample', {}, () => ({ ok: true, data: { state: createSeed() } }), () => true as const)
      if (result.ok) toast('Muestra cargada')
      return result
    },
    async restoreBackup(raw) {
      try {
        if (mode === 'local') parseBackup(raw)
      } catch (error) {
        return { ok: false as const, error: error instanceof Error ? error.message : 'No se pudo leer el respaldo' }
      }
      const result = await perform('restoreBackup', { raw }, () => ({ ok: true, data: { state: parseBackup(raw) } }), () => true as const)
      if (result.ok) toast('Respaldo restaurado')
      return result
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

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('GraStore no está listo')
  return store
}
