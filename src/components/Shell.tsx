import {
  LayoutDashboard,
  Menu,
  PackagePlus,
  Receipt,
  ChartColumn,
  Shirt,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { go, type PageId } from '../lib/nav'
import { useStore } from '../store'
import { Splash } from './motion'
import { Button, Modal } from './ui'

const floor: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
  { id: 'vender', label: 'Vender', icon: ShoppingBag },
  { id: 'ventas', label: 'Ventas', icon: Receipt },
  { id: 'estadisticas', label: 'Estadísticas', icon: ChartColumn },
  { id: 'productos', label: 'Prendas', icon: Shirt },
]

const books: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'compras', label: 'Compras', icon: PackagePlus },
  { id: 'cobrar', label: 'Cartera', icon: Wallet },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'proveedores', label: 'Proveedores', icon: Truck },
]

function SideNav({
  page,
  openCount,
  onNavigate,
  onReset,
}: {
  page: PageId
  openCount: number
  onNavigate: () => void
  onReset: () => void
}) {
  const item = (entry: { id: PageId; label: string; icon: LucideIcon }) => {
    const active = page === entry.id
    const Icon = entry.icon
    return (
      <button
        key={entry.id}
        type="button"
        aria-current={active ? 'page' : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition duration-200 ${active ? 'bg-brass text-espresso' : 'text-[#d4d4d4] hover:bg-white/10 hover:text-white'}`}
        onClick={() => {
          go(entry.id)
          onNavigate()
        }}
      >
        <Icon size={16} strokeWidth={1.6} />
        <span>{entry.label}</span>
        {entry.id === 'cobrar' && openCount > 0 ? (
          <span className={`ml-auto text-[11px] tabular-nums ${active ? 'text-espresso' : 'text-brass'}`}>{openCount}</span>
        ) : null}
      </button>
    )
  }

  return (
    <div className="flex h-full flex-col border-r border-brass/50 bg-espresso text-white">
      <div className="px-6 pt-7 pb-6">
        <img src="/logo.svg" alt="La Grasita Store" decoding="sync" fetchPriority="high" className="mark-live w-full" />
        <p className="mt-4 text-[11px] tracking-[0.22em] text-brass uppercase">Cartagena</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-auto px-3">
        {floor.map(item)}
        <p className="px-3 pt-6 pb-2 text-[10px] tracking-[0.2em] text-brass/80 uppercase">Libros</p>
        {books.map(item)}
      </nav>
      <div className="px-6 py-5">
        <p className="text-[11px] tracking-[0.16em] text-[#8a8a8a] uppercase">Caja principal</p>
        <button type="button" className="mt-2 text-left text-xs text-[#9a9a9a] underline-offset-2 hover:text-brass hover:underline" onClick={onReset}>
          Restaurar muestra
        </button>
      </div>
    </div>
  )
}

export function Shell({ page, children }: { page: PageId; children: ReactNode }) {
  const { state, resetDemo } = useStore()
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [splash, setSplash] = useState<string | null>(null)
  const openCount = state.sales.filter((sale) => sale.balance > 0).length

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="aside-in sticky top-0 hidden h-screen lg:block">
        <SideNav page={page} openCount={openCount} onNavigate={() => setMenu(false)} onReset={() => setConfirm(true)} />
      </aside>
      <div className={`fixed inset-0 z-40 lg:hidden ${menu ? '' : 'pointer-events-none'}`} inert={menu ? undefined : true}>
        <button
          type="button"
          className={`absolute inset-0 bg-espresso/60 ${menu ? 'menu-scrim' : 'opacity-0'}`}
          aria-label="Cerrar menú"
          tabIndex={menu ? 0 : -1}
          onClick={() => setMenu(false)}
        />
        <div className={`absolute inset-y-0 left-0 w-[240px] ${menu ? 'menu-drawer' : '-translate-x-[105%]'}`}>
          <SideNav page={page} openCount={openCount} onNavigate={() => setMenu(false)} onReset={() => { setMenu(false); setConfirm(true) }} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line" aria-label="Abrir menú" onClick={() => setMenu(true)}>
            <Menu size={16} />
          </button>
          <p className="min-w-0 flex-1 truncate text-center font-serif text-lg tracking-wide">LA GRASITA STORE</p>
          <button type="button" className="shrink-0 text-sm text-brass-deep" onClick={() => go('vender')}>
            Vender
          </button>
        </div>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
      <Modal open={confirm} kicker="Datos de muestra" title="Restaurar el libro" onClose={() => setConfirm(false)}>
        <p className="text-sm leading-6 text-muted">
          Se borran las ventas, compras y cambios de este navegador, y La Grasita Store vuelve a la muestra de la tienda.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              resetDemo()
              setConfirm(false)
              setSplash('Restaurando el libro')
            }}
          >
            Restaurar
          </Button>
        </div>
      </Modal>
      {splash ? <Splash label={splash} onDone={() => setSplash(null)} /> : null}
    </div>
  )
}
