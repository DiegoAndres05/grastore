import type { Actor, State } from '../types'

export const ROLES = [
  { id: 'dueno', name: 'Dueño', locked: true },
  { id: 'administrador', name: 'Administrador', locked: false },
  { id: 'trabajador', name: 'Trabajador', locked: false },
] as const

export type RoleId = (typeof ROLES)[number]['id']

export const PERMISSIONS = [
  { id: 'pos.sell', label: 'Vender en caja', group: 'Mostrador' },
  { id: 'layaway.manage', label: 'Plan separe', group: 'Mostrador' },
  { id: 'collections.take', label: 'Abonar cartera de ventas', group: 'Mostrador' },
  { id: 'customers.write', label: 'Crear y editar clientes', group: 'Mostrador' },
  { id: 'products.read', label: 'Ver prendas y existencias', group: 'Inventario' },
  { id: 'products.costs', label: 'Ver costos y márgenes', group: 'Inventario' },
  { id: 'products.write', label: 'Editar prendas, categorías y colores', group: 'Inventario' },
  { id: 'inventory.adjust', label: 'Ajustar inventario', group: 'Inventario' },
  { id: 'sales.void', label: 'Anular ventas', group: 'Ventas' },
  { id: 'sales.edit', label: 'Corregir ventas', group: 'Ventas' },
  { id: 'sales.return', label: 'Registrar devoluciones', group: 'Ventas' },
  { id: 'purchases.write', label: 'Compras e inversiones', group: 'Compras' },
  { id: 'cash.read', label: 'Ver saldos de caja', group: 'Dinero' },
  { id: 'cash.write', label: 'Traslados y cuentas', group: 'Dinero' },
  { id: 'expenses.read', label: 'Ver gastos', group: 'Dinero' },
  { id: 'expenses.write', label: 'Registrar gastos', group: 'Dinero' },
  { id: 'payables.read', label: 'Ver deudas', group: 'Dinero' },
  { id: 'payables.write', label: 'Registrar y pagar deudas', group: 'Dinero' },
  { id: 'capital.write', label: 'Aportes, préstamos y préstamos a terceros', group: 'Dinero' },
  { id: 'reports.read', label: 'Contabilidad y estadísticas', group: 'Cierre' },
  { id: 'import.restore', label: 'Importar Excel, respaldo y muestra', group: 'Cierre' },
  { id: 'book.delete', label: 'Vaciar el libro', group: 'Cierre' },
  { id: 'users.manage', label: 'Usuarios y permisos', group: 'Acceso' },
] as const

export type Permission = (typeof PERMISSIONS)[number]['id']

const ALL: Permission[] = PERMISSIONS.map((item) => item.id)

const TRABAJADOR: Permission[] = ['pos.sell', 'layaway.manage', 'collections.take', 'customers.write', 'products.read']

const ADMINISTRADOR: Permission[] = ALL.filter((id) => id !== 'users.manage' && id !== 'import.restore' && id !== 'book.delete')

export const DEFAULT_GRANTS: Record<RoleId, Permission[]> = {
  dueno: ALL,
  administrador: ADMINISTRADOR,
  trabajador: TRABAJADOR,
}

export type Access = {
  roleId: string
  roleName: string
  active: boolean
  permissions: string[]
}

export function fullAccess(actorName = 'Este navegador'): { access: Access; actor: Actor } {
  return {
    actor: { id: 'local', name: actorName },
    access: { roleId: 'dueno', roleName: 'Dueño', active: true, permissions: [...ALL] },
  }
}

export function can(access: Access, permission: string) {
  return access.active && access.permissions.includes(permission)
}

export function effectivePermissions(roleId: string, grants: string[], overrides: Record<string, boolean> | null | undefined, active: boolean) {
  if (!active) return []
  if (roleId === 'dueno') return [...ALL]
  const set = new Set(grants)
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value) set.add(key)
    else set.delete(key)
  }
  return ALL.filter((id) => set.has(id))
}

export const ACTION_PERMISSION = {
  checkout: 'pos.sell',
  collect: 'collections.take',
  layaway: 'layaway.manage',
  layawayDeposit: 'layaway.manage',
  completeLayaway: 'layaway.manage',
  cancelLayaway: 'layaway.manage',
  saveCustomer: 'customers.write',
  removeCustomer: 'customers.write',
  saveProduct: 'products.write',
  setProductActive: 'products.write',
  addCategory: 'products.write',
  renameCategory: 'products.write',
  addColor: 'products.write',
  adjust: 'inventory.adjust',
  voidSale: 'sales.void',
  updateSale: 'sales.edit',
  returnSale: 'sales.return',
  purchase: 'purchases.write',
  invest: 'purchases.write',
  settleInvestment: 'purchases.write',
  saveSupplier: 'purchases.write',
  removeSupplier: 'purchases.write',
  transfer: 'cash.write',
  saveAccount: 'cash.write',
  setAccountActive: 'cash.write',
  expense: 'expenses.write',
  savePayable: 'payables.write',
  payPayable: 'payables.write',
  capital: 'capital.write',
  loan: 'capital.write',
  payLoan: 'capital.write',
  setSalaryShare: 'reports.read',
  replaceBook: 'import.restore',
  restoreBackup: 'import.restore',
  loadSample: 'import.restore',
  wipeBook: 'book.delete',
} as const

export type BookAction = keyof typeof ACTION_PERMISSION

export function permissionFor(action: string) {
  if (action in ACTION_PERMISSION) return ACTION_PERMISSION[action as BookAction]
  return null
}

function zeroLineCosts<T extends { cost: number }>(lines: T[]) {
  return lines.map((line) => ({ ...line, cost: 0 }))
}

export function redactState(state: State, access: Access): State {
  const allow = (permission: string) => can(access, permission)
  const seeCosts = allow('products.costs')
  const seeCash = allow('cash.read')
  const seeExpenses = allow('expenses.read') || allow('expenses.write')
  const seePayables = allow('payables.read') || allow('payables.write')
  const seeCapital = allow('capital.write') || allow('reports.read')
  const seeReports = allow('reports.read')
  const seePurchases = allow('purchases.write') || seeReports || seeCosts
  const seeProducts = allow('products.read') || allow('pos.sell')
  const seeSales = seeProducts || allow('collections.take') || seeReports
  const seeCustomers = allow('customers.write') || allow('collections.take') || allow('pos.sell') || seeReports

  return {
    ...state,
    products: seeProducts ? state.products.map((product) => (seeCosts ? product : { ...product, cost: 0 })) : [],
    customers: seeCustomers ? state.customers : [],
    suppliers: seePurchases ? state.suppliers : [],
    sales: seeSales
      ? state.sales.map((sale) => (seeCosts ? sale : { ...sale, lines: zeroLineCosts(sale.lines) }))
      : [],
    purchases: seePurchases
      ? state.purchases.map((purchase) => (seeCosts ? purchase : { ...purchase, lines: zeroLineCosts(purchase.lines), total: purchase.total }))
      : [],
    layaways:
      allow('layaway.manage') || seeReports
        ? state.layaways.map((layaway) => (seeCosts ? layaway : { ...layaway, lines: zeroLineCosts(layaway.lines) }))
        : [],
    returns: seeSales
      ? state.returns.map((item) => (seeCosts ? item : { ...item, lines: zeroLineCosts(item.lines) }))
      : [],
    collections: allow('collections.take') || seeReports ? state.collections : [],
    accounts: state.accounts.map((account) => (seeCash ? account : { ...account, openingBalance: 0 })),
    movements: seeCash ? state.movements : [],
    expenses: seeExpenses ? state.expenses : [],
    payables: seePayables ? state.payables : [],
    payablePayments: seePayables ? state.payablePayments : [],
    capitalEvents: seeCapital ? state.capitalEvents : [],
    loans: seeCapital ? state.loans : [],
    loanPayments: seeCapital ? state.loanPayments : [],
    adjustments: allow('inventory.adjust') || seeReports || allow('products.write') ? state.adjustments : [],
    investments: seePurchases ? state.investments : [],
    openingPnl: seeReports ? state.openingPnl : null,
  }
}
