import { describe, expect, it } from 'vitest'
import { emptyState } from './book'
import { DEFAULT_GRANTS, effectivePermissions, permissionFor, redactState, type Access } from './access'

function access(roleId: string, permissions: string[]): Access {
  return { roleId, roleName: roleId, active: true, permissions }
}

describe('permisos', () => {
  it('el trabajador vende y no ve costos ni contabilidad', () => {
    const grants = DEFAULT_GRANTS.trabajador
    expect(grants).toContain('pos.sell')
    expect(grants).toContain('collections.take')
    expect(grants).not.toContain('products.costs')
    expect(grants).not.toContain('cash.read')
    expect(grants).not.toContain('reports.read')
    expect(grants).not.toContain('sales.void')
    expect(grants).not.toContain('import.restore')
    expect(grants).not.toContain('users.manage')
  })

  it('el administrador opera el negocio y no administra usuarios ni importa', () => {
    const grants = DEFAULT_GRANTS.administrador
    expect(grants).toContain('purchases.write')
    expect(grants).toContain('reports.read')
    expect(grants).toContain('sales.void')
    expect(grants).not.toContain('users.manage')
    expect(grants).not.toContain('import.restore')
    expect(grants).not.toContain('book.delete')
  })

  it('el dueño no pierde permisos aunque el override los quite', () => {
    const permissions = effectivePermissions('dueno', [], { 'users.manage': false }, true)
    expect(permissions).toContain('users.manage')
    expect(permissions).toContain('products.costs')
  })

  it('un override del trabajador puede darle o quitarle un permiso', () => {
    const granted = effectivePermissions('trabajador', DEFAULT_GRANTS.trabajador, { 'cash.read': true }, true)
    const revoked = effectivePermissions('trabajador', DEFAULT_GRANTS.trabajador, { 'pos.sell': false }, true)
    expect(granted).toContain('cash.read')
    expect(revoked).not.toContain('pos.sell')
  })

  it('una cuenta inactiva no tiene permisos', () => {
    expect(effectivePermissions('administrador', DEFAULT_GRANTS.administrador, {}, false)).toEqual([])
  })

  it('oculta costos, caja y gastos a quien no puede verlos', () => {
    const state = emptyState()
    state.products = [{ id: 'p', sku: 'A', name: 'Prenda', category: 'Camisetas', color: 'Negro', size: 'M', cost: 40_000, price: 90_000, stock: 2, minStock: 0, active: true }]
    state.sales = [{
      id: 's', number: 'V-1', date: '2026-10-01T12:00:00.000Z', customerId: null, customerName: 'Mostrador',
      lines: [{ productId: 'p', sku: 'A', name: 'Prenda', color: 'Negro', size: 'M', qty: 1, price: 90_000, cost: 40_000 }],
      discount: 0, total: 90_000, method: 'efectivo', paid: 90_000, balance: 0, tendered: null, note: '',
    }]
    state.accounts = [{ id: 'acct-efectivo', name: 'Efectivo', kind: 'cash', openingBalance: 80_000, active: true }]
    state.movements = [{ id: 'm', date: '2026-10-01T12:00:00.000Z', accountId: 'acct-efectivo', kind: 'sale', direction: 'in', amount: 90_000, counterparty: '', note: '', refId: 's' }]
    state.expenses = [{ id: 'e', number: 'G-1', date: '2026-10-01T12:00:00.000Z', category: 'Comida', amount: 10_000, accountId: null, payableId: null, payee: '', note: '' }]
    const hidden = redactState(state, access('trabajador', DEFAULT_GRANTS.trabajador))
    expect(hidden.products[0].cost).toBe(0)
    expect(hidden.sales[0].lines[0].cost).toBe(0)
    expect(hidden.accounts[0].openingBalance).toBe(0)
    expect(hidden.movements).toEqual([])
    expect(hidden.expenses).toEqual([])
    expect(hidden.openingPnl).toBeNull()
    const owner = redactState(state, access('dueno', DEFAULT_GRANTS.dueno))
    expect(owner.products[0].cost).toBe(40_000)
    expect(owner.movements).toHaveLength(1)
  })

  it('cada acción del libro exige un permiso', () => {
    expect(permissionFor('checkout')).toBe('pos.sell')
    expect(permissionFor('voidSale')).toBe('sales.void')
    expect(permissionFor('wipeBook')).toBe('book.delete')
    expect(permissionFor('inventada')).toBeNull()
  })
})
