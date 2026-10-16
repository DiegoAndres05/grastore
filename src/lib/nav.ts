export const PAGES = [
  'inicio',
  'vender',
  'ventas',
  'estadisticas',
  'productos',
  'compras',
  'caja',
  'cobrar',
  'pagar',
  'balance',
  'clientes',
  'proveedores',
] as const

export type PageId = (typeof PAGES)[number]

export function go(page: PageId) {
  window.location.hash = page
}

export function readPage(): PageId {
  const id = window.location.hash.replace(/^#/, '')
  return (PAGES as readonly string[]).includes(id) ? (id as PageId) : 'inicio'
}
