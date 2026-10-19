import { createSeed } from '../data/seed'
import type { Actor, State } from '../types'
import { permissionFor, type BookAction } from './access'
import { bookIsEmpty, emptyState, hydrate, parseBackup } from './book'
import { applyImportClosings } from './importWorkbook'
import {
  applyAccountActive,
  applyAddCategory,
  applyAddColor,
  applyAdjustment,
  applyCancelLayaway,
  applyCapital,
  applyCloseMonth,
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
  type SalePatch,
} from './books'
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
} from './logic'

export function runAction(state: State, action: string, input: unknown, actor: Actor): Result<{ state: State; data: unknown }> {
  if (!permissionFor(action)) return { ok: false, error: 'Esa acción no existe' }
  const body = (input ?? {}) as Record<string, unknown>
  switch (action as BookAction) {
    case 'checkout':
      return map(applyCheckout(state, { ...(body as CheckoutInput), actor }), (data) => data.sale)
    case 'collect':
      return map(applyCollection(state, { ...(body as CollectionInput), actor }), (data) => data.collection)
    case 'purchase':
      return map(applyPurchase(state, { ...(body as PurchaseInput), actor }), (data) => data.purchase)
    case 'saveProduct':
      return map(applyProduct(state, { ...(body as ProductInput), actor }, (body as { id?: string }).id), (data) => data.product)
    case 'setProductActive': {
      const next = applyProductActive(state, String((body as { id: string }).id), Boolean((body as { active: boolean }).active))
      return { ok: true, data: { state: next, data: true } }
    }
    case 'saveCustomer':
      return map(applyCustomer(state, { ...(body as CustomerInput), actor }, (body as { id?: string }).id), (data) => data.customer)
    case 'removeCustomer':
      return map(applyRemoveCustomer(state, String((body as { id: string }).id)), () => true)
    case 'saveSupplier':
      return map(applySupplier(state, { ...(body as SupplierInput), actor }, (body as { id?: string }).id), (data) => data.supplier)
    case 'removeSupplier':
      return map(applyRemoveSupplier(state, String((body as { id: string }).id)), () => true)
    case 'transfer':
      return map(applyTransfer(state, { ...(body as Parameters<typeof applyTransfer>[1]), actor }), () => true)
    case 'saveAccount':
      return map(applySaveAccount(state, { ...(body as Parameters<typeof applySaveAccount>[1]), actor }, (body as { id?: string }).id), (data) => data.account)
    case 'setAccountActive': {
      const next = applyAccountActive(state, String((body as { id: string }).id), Boolean((body as { active: boolean }).active))
      return { ok: true, data: { state: next, data: true } }
    }
    case 'expense':
      return map(applyExpense(state, { ...(body as Parameters<typeof applyExpense>[1]), actor }), (data) => data.expense)
    case 'savePayable':
      return map(applyPayable(state, { ...(body as Parameters<typeof applyPayable>[1]), actor }), (data) => data.payable)
    case 'payPayable':
      return map(applyPayPayable(state, { ...(body as Parameters<typeof applyPayPayable>[1]), actor }), () => true)
    case 'capital':
      return map(applyCapital(state, { ...(body as Parameters<typeof applyCapital>[1]), actor }), () => true)
    case 'loan':
      return map(applyLoan(state, { ...(body as Parameters<typeof applyLoan>[1]), actor }), (data) => data.loan)
    case 'payLoan':
      return map(applyLoanPayment(state, { ...(body as Parameters<typeof applyLoanPayment>[1]), actor }), () => true)
    case 'layaway':
      return map(applyLayaway(state, { ...(body as Parameters<typeof applyLayaway>[1]), actor }), (data) => data.layaway)
    case 'layawayDeposit':
      return map(applyLayawayDeposit(state, { ...(body as Parameters<typeof applyLayawayDeposit>[1]), actor }), () => true)
    case 'completeLayaway':
      return map(applyCompleteLayaway(state, { ...(body as Parameters<typeof applyCompleteLayaway>[1]), actor }), (data) => data.sale)
    case 'cancelLayaway':
      return map(applyCancelLayaway(state, { ...(body as Parameters<typeof applyCancelLayaway>[1]), actor }), () => true)
    case 'voidSale':
      return map(applyVoidSale(state, { ...(body as { saleId: string; date?: string }), actor }), () => true)
    case 'updateSale':
      return map(applyUpdateSale(state, String((body as { saleId: string }).saleId), (body as { patch: SalePatch }).patch), (data) => data.sale)
    case 'returnSale':
      return map(applyReturn(state, { ...(body as Parameters<typeof applyReturn>[1]), actor }), () => true)
    case 'adjust':
      return map(applyAdjustment(state, { ...(body as Parameters<typeof applyAdjustment>[1]), actor }), () => true)
    case 'invest':
      return map(applyInvestment(state, { ...(body as Parameters<typeof applyInvestment>[1]), actor }), () => true)
    case 'settleInvestment':
      return map(applySettleInvestment(state, String((body as { id: string }).id)), () => true)
    case 'addCategory':
      return map(applyAddCategory(state, String((body as { name: string }).name)), () => true)
    case 'renameCategory':
      return map(applyRenameCategory(state, String((body as { from: string }).from), String((body as { to: string }).to)), () => true)
    case 'addColor':
      return map(applyAddColor(state, String((body as { name: string }).name)), () => true)
    case 'setSalaryShare':
      return map(applySalaryShare(state, Number((body as { percent: number }).percent)), () => true)
    case 'closeMonth':
      return map(applyCloseMonth(state, { ...(body as { year: number; month: number; today?: string }), actor }), (data) => data.closing)
    case 'importClosings': {
      const drafts = (body as { closings?: Parameters<typeof applyImportClosings>[1] }).closings ?? []
      if (!drafts.length) return { ok: false, error: 'Esa hoja Balance no tiene meses para importar' }
      return { ok: true, data: { state: applyImportClosings(state, drafts), data: true } }
    }
    case 'replaceBook':
      return { ok: true, data: { state: hydrate(body), data: true } }
    case 'restoreBackup':
      try {
        return { ok: true, data: { state: parseBackup(String((body as { raw: string }).raw)), data: true } }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'No se pudo leer el respaldo' }
      }
    case 'loadSample':
      if (!bookIsEmpty(state)) return { ok: false, error: 'El libro ya tiene datos' }
      return { ok: true, data: { state: createSeed(), data: true } }
    case 'wipeBook':
      return { ok: true, data: { state: emptyState(), data: true } }
    default:
      return { ok: false, error: 'Esa acción no existe' }
  }
}

function map<T>(result: Result<{ state: State } & T>, pick: (data: { state: State } & T) => unknown): Result<{ state: State; data: unknown }> {
  if (!result.ok) return result
  return { ok: true, data: { state: result.data.state, data: pick(result.data) } }
}
