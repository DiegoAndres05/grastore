import { useEffect, useRef, useState } from 'react'
import { Shell } from './components/Shell'
import { readPage, type PageId } from './lib/nav'
import { canOpen } from './lib/nav'
import { useStore } from './store'
import { Accounting } from './pages/Accounting'
import { Balance } from './pages/Balance'
import { Customers } from './pages/Customers'
import { Dashboard } from './pages/Dashboard'
import { Expenses } from './pages/Expenses'
import { ImportBook } from './pages/ImportBook'
import { Ledger } from './pages/Ledger'
import { Payables } from './pages/Payables'
import { Pos } from './pages/Pos'
import { Products } from './pages/Products'
import { Purchases } from './pages/Purchases'
import { Receivables } from './pages/Receivables'
import { Sales } from './pages/Sales'
import { Statistics } from './pages/Statistics'
import { Suppliers } from './pages/Suppliers'
import { UsersPage } from './pages/Users'

const titles: Record<PageId, string> = {
  inicio: 'Inicio',
  vender: 'Vender',
  ventas: 'Ventas',
  estadisticas: 'Estadísticas',
  productos: 'Prendas',
  compras: 'Compras',
  cobrar: 'Cartera',
  clientes: 'Clientes',
  proveedores: 'Proveedores',
  caja: 'Caja',
  gastos: 'Gastos',
  pagar: 'Por pagar',
  contabilidad: 'Contabilidad',
  balance: 'Balance',
  importar: 'Importar',
  usuarios: 'Usuarios',
}

function Denied() {
  return (
    <div className="rounded-3xl border border-line bg-card p-8">
      <p className="text-[11px] tracking-[0.18em] text-brass uppercase">Acceso</p>
      <h1 className="mt-3 font-serif text-4xl">Esta parte no está en tu rol</h1>
      <p className="mt-3 max-w-lg text-sm text-muted">Si la necesitas para trabajar, pídesela al dueño. El permiso se revisa en el servidor, no solo en el menú.</p>
    </div>
  )
}

export default function App() {
  const { access, mode } = useStore()
  const [page, setPage] = useState<PageId>(readPage)
  const [revealed, setRevealed] = useState(false)
  const [bar, setBar] = useState(0)
  const skipBar = useRef(true)

  useEffect(() => {
    const onHash = () => setPage(readPage())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = `${titles[page]} · La Grasita Store`
  }, [page])

  useEffect(() => {
    const node = document.getElementById('boot')
    if (!node) {
      document.documentElement.classList.add('ready')
      setRevealed(true)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hold = 1280
    const fade = reduce ? 180 : 460
    const leave = window.setTimeout(() => node.classList.add('boot-out'), hold)
    const done = window.setTimeout(() => {
      node.remove()
      document.documentElement.classList.add('ready')
      setRevealed(true)
    }, hold + fade)
    return () => {
      window.clearTimeout(leave)
      window.clearTimeout(done)
    }
  }, [])

  useEffect(() => {
    if (!revealed) return
    if (skipBar.current) {
      skipBar.current = false
      return
    }
    setBar((current) => current + 1)
  }, [page, revealed])

  return (
    <Shell page={page}>
      {revealed && bar > 0 ? <div key={bar} className="route-bar" aria-hidden="true" /> : null}
      {revealed ? (
        <div key={page} className="stage min-w-0">
          {mode === 'cloud' && !access.roleId ? <p className="text-sm text-muted">Abriendo el libro…</p> : canOpen(page, access.permissions) ? (
            <>
          {page === 'inicio' && <Dashboard />}
          {page === 'vender' && <Pos />}
          {page === 'ventas' && <Sales />}
          {page === 'estadisticas' && <Statistics />}
          {page === 'productos' && <Products />}
          {page === 'compras' && <Purchases />}
          {page === 'cobrar' && <Receivables />}
          {page === 'clientes' && <Customers />}
          {page === 'proveedores' && <Suppliers />}
          {page === 'caja' && <Ledger />}
          {page === 'gastos' && <Expenses />}
          {page === 'pagar' && <Payables />}
          {page === 'contabilidad' && <Accounting />}
          {page === 'balance' && <Balance />}
          {page === 'importar' && <ImportBook />}
          {page === 'usuarios' && <UsersPage />}
            </>
          ) : <Denied />}
        </div>
      ) : null}
    </Shell>
  )
}
