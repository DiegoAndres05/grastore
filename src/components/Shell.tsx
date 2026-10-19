import {
  ArrowLeftRight,
  ChartColumn,
  FileUp,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Menu,
  PackagePlus,
  Receipt,
  Scale,
  CalendarRange,
  Shirt,
  ShoppingBag,
  Truck,
  Shield,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { bookHasRealData, bookIsEmpty } from '../lib/book'
import { canOpen, go, type PageId } from '../lib/nav'
import { downloadBackup } from '../lib/exportSheet'
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
  { id: 'caja', label: 'Caja', icon: Landmark },
  { id: 'gastos', label: 'Gastos', icon: ArrowLeftRight },
  { id: 'pagar', label: 'Por pagar', icon: HandCoins },
]

const closeBooks: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'contabilidad', label: 'Contabilidad', icon: Scale },
  { id: 'balance', label: 'Balance', icon: CalendarRange },
  { id: 'importar', label: 'Importar', icon: FileUp },
  { id: 'usuarios', label: 'Usuarios', icon: Shield },
]

function SideNav({
  page,
  openCount,
  onNavigate,
  onReset,
  showSample,
  permissions,
}: {
  page: PageId
  openCount: number
  onNavigate: () => void
  onReset: () => void
  showSample: boolean
  permissions: readonly string[]
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
        {floor.filter((entry) => canOpen(entry.id, permissions)).map(item)}
        {books.some((entry) => canOpen(entry.id, permissions)) ? <p className="px-3 pt-6 pb-2 text-[10px] tracking-[0.2em] text-brass/80 uppercase">Libros</p> : null}
        {books.filter((entry) => canOpen(entry.id, permissions)).map(item)}
        {closeBooks.some((entry) => canOpen(entry.id, permissions)) ? <p className="px-3 pt-6 pb-2 text-[10px] tracking-[0.2em] text-brass/80 uppercase">Cierre</p> : null}
        {closeBooks.filter((entry) => canOpen(entry.id, permissions)).map(item)}
      </nav>
      <div className="px-6 py-5">
        <p className="text-[11px] tracking-[0.16em] text-[#8a8a8a] uppercase">La Grasita</p>
        {showSample ? (
          <button type="button" className="mt-2 text-left text-xs text-[#9a9a9a] underline-offset-2 hover:text-brass hover:underline" onClick={onReset}>
            Cargar muestra
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function Shell({ page, children }: { page: PageId; children: ReactNode }) {
  const { state, loadSample, restoreBackup, toast, mode, actor, access, syncing, signOut, can } = useStore()
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [splash, setSplash] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const openCount = state.sales.filter((sale) => !sale.voided && sale.balance > 0).length
  const showSample = bookIsEmpty(state) && !bookHasRealData(state)

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="aside-in sticky top-0 hidden h-screen lg:block">
        <SideNav page={page} openCount={openCount} onNavigate={() => setMenu(false)} onReset={() => setConfirm(true)} showSample={showSample && can('import.restore')} permissions={access.permissions} />
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
          <SideNav page={page} openCount={openCount} onNavigate={() => setMenu(false)} onReset={() => { setMenu(false); setConfirm(true) }} showSample={showSample && can('import.restore')} permissions={access.permissions} />
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
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {mode === 'local' ? (
            <div className="mb-6 rounded-2xl border border-brass/40 bg-brass/10 px-4 py-3 text-sm">
              Modo local: este libro vive solo en este navegador y aquí entras como dueño. Para el libro compartido, configura Supabase y las variables del servidor. Los pasos están en el README.
            </div>
          ) : (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <p>{syncing ? 'Guardando…' : 'Libro compartido'} · {actor.name}{access.roleName ? ` · ${access.roleName}` : ''}</p>
              <button type="button" className="text-brass-deep" onClick={() => void signOut()}>Salir</button>
            </div>
          )}
          {can('import.restore') ? <div className="mb-6 flex flex-wrap gap-3 text-sm">
            <button type="button" className="text-brass-deep" onClick={() => downloadBackup(state)}>Descargar respaldo JSON</button>
            <button type="button" className="text-muted" onClick={() => fileRef.current?.click()}>Restaurar respaldo</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                if (bookHasRealData(state) && !window.confirm('Esto reemplaza el libro actual. Si hay ventas o cartera, se pierden. ¿Continuar?')) return
                void file.text().then(async (raw) => {
                  const result = await restoreBackup(raw)
                  if (!result.ok) toast(result.error, 'warn')
                })
              }}
            />
          </div> : null}
          {children}
        </main>
      </div>
      <Modal open={confirm} kicker="Datos de muestra" title="Cargar la muestra" onClose={() => setConfirm(false)}>
        <p className="text-sm leading-6 text-muted">
          Carga prendas y ventas inventadas para mirar el punto de venta. No es la contabilidad de la tienda, y solo se ofrece cuando el libro está vacío.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              void (async () => {
              const result = await loadSample()
              setConfirm(false)
              if (!result.ok) toast(result.error, 'warn')
              else setSplash('Cargando la muestra')
              })()
            }}
          >
            Cargar
          </Button>
        </div>
      </Modal>
      {splash ? <Splash label={splash} onDone={() => setSplash(null)} /> : null}
    </div>
  )
}
