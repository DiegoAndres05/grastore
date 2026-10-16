export const PAGES = [
  'inicio',
  'vender',
  'ventas',
  'estadisticas',
  'productos',
  'compras',
  'cobrar',
  'clientes',
  'proveedores',
  'caja',
  'gastos',
  'pagar',
  'contabilidad',
  'importar',
  'usuarios',
] as const

export type PageId = (typeof PAGES)[number]

export function go(page: PageId) {
  window.location.hash = page
}

export function readPage(): PageId {
  const id = window.location.hash.replace(/^#/, '')
  return (PAGES as readonly string[]).includes(id) ? (id as PageId) : 'inicio'
}

const PAGE_ANY: Record<PageId, string[]> = {
  inicio: ['products.read', 'pos.sell'],
  vender: ['pos.sell'],
  ventas: ['products.read', 'pos.sell', 'collections.take'],
  estadisticas: ['reports.read'],
  productos: ['products.read', 'pos.sell'],
  compras: ['purchases.write'],
  cobrar: ['collections.take', 'layaway.manage', 'reports.read'],
  clientes: ['customers.write', 'pos.sell', 'collections.take'],
  proveedores: ['purchases.write'],
  caja: ['cash.read'],
  gastos: ['expenses.read', 'expenses.write'],
  pagar: ['payables.read', 'payables.write'],
  contabilidad: ['reports.read'],
  importar: ['import.restore'],
  usuarios: ['users.manage'],
}

export function canOpen(page: PageId, permissions: readonly string[]) {
  return PAGE_ANY[page].some((permission) => permissions.includes(permission))
}
