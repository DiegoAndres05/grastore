import { useState, type PointerEvent } from 'react'
import { swatch } from '../lib/catalog'
import { greeting, isRetailSale, isSameDay, isSameMonth, longDate, money, percent, relativeDay } from '../lib/format'
import { availableUnits } from '../lib/money'
import { go } from '../lib/nav'
import { useStore } from '../store'
import { CountUp } from '../components/motion'
import { Button } from '../components/ui'

function Trend({ sales }: { sales: { date: string; total: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const points = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - (13 - index))
    const total = sales.filter((sale) => isSameDay(sale.date, date)).reduce((sum, sale) => sum + sale.total, 0)
    const label = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(date)
    return { label, total }
  })
  const width = 640
  const height = 180
  const pad = 12
  const max = Math.max(...points.map((point) => point.total), 1)
  const coords = points.map((point, index) => {
    const x = pad + (index * (width - pad * 2)) / (points.length - 1)
    const y = height - pad - (point.total / max) * (height - pad * 2 - 16)
    return { ...point, x, y }
  })
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]
  const first = coords[0]
  const area = `${line} L${last.x},${height - pad} L${first.x},${height - pad} Z`
  const active = hover == null ? null : coords[hover]

  function choose(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * width
    let best = 0
    let dist = Infinity
    coords.forEach((point, index) => {
      const delta = Math.abs(point.x - x)
      if (delta < dist) {
        dist = delta
        best = index
      }
    })
    setHover(best)
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-3">
          <p className="text-[11px] tracking-[0.18em] text-muted uppercase">Últimos 14 días</p>
          <button type="button" className="text-xs text-brass-deep" onClick={() => go('estadisticas')}>Ampliar</button>
        </div>
        <p className="text-sm text-muted tabular-nums">{active ? `${active.label} · ${money(active.total)}` : money(points.reduce((sum, point) => sum + point.total, 0))}</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full touch-pan-y"
        onPointerLeave={(event) => {
          if (event.pointerType !== 'touch') setHover(null)
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch') choose(event)
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== 'touch') choose(event)
        }}
      >
        <path className="trend-area" d={area} fill="rgba(245,197,24,0.18)" />
        <path className="trend-line" d={line} fill="none" stroke="#f5c518" strokeWidth="2" pathLength={1} />
        {active ? (
          <>
            <line x1={active.x} x2={active.x} y1={pad} y2={height - pad} stroke="#ffd84d" strokeDasharray="3 4" />
            <circle cx={active.x} cy={active.y} r="4" fill="#f5c518" />
          </>
        ) : (
          <circle cx={last.x} cy={last.y} r="3.5" fill="#f5c518" />
        )}
      </svg>
    </div>
  )
}

export function Dashboard() {
  const { state } = useStore()
  const retail = state.sales.filter(isRetailSale)
  const todaySales = retail.filter((sale) => isSameDay(sale.date))
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0)
  const todayUnits = todaySales.reduce((sum, sale) => sum + sale.lines.reduce((qty, line) => qty + line.qty, 0), 0)
  const monthSales = retail.filter((sale) => isSameMonth(sale.date))
  const monthTotal = monthSales.reduce((sum, sale) => sum + sale.total, 0)
  const monthCost = monthSales.reduce((sum, sale) => sum + sale.lines.reduce((cost, line) => cost + line.cost * line.qty, 0), 0)
  const monthMargin = monthTotal - monthCost
  const stock = state.products.filter((product) => product.active)
  const stockCost = stock.reduce((sum, product) => sum + product.stock * product.cost, 0)
  const stockRetail = stock.reduce((sum, product) => sum + product.stock * product.price, 0)
  const low = stock.filter((product) => availableUnits(product) <= product.minStock).sort((a, b) => availableUnits(a) - availableUnits(b))
  const open = state.sales.filter((sale) => sale.balance > 0).sort((a, b) => a.date.localeCompare(b.date))
  const receivable = open.reduce((sum, sale) => sum + sale.balance, 0)
  const average = todaySales.length ? Math.round(todayTotal / todaySales.length) : 0

  const stats = [
    { label: 'Mes en curso', value: monthTotal, kind: 'money' as const, hint: `${monthSales.length} ventas` },
    { label: 'Margen del mes', value: monthMargin, kind: 'money' as const, hint: monthTotal ? percent(monthMargin / monthTotal) : 'Sin ventas' },
    { label: 'Inventario', value: stockCost, kind: 'money' as const, hint: `Venta potencial ${money(stockRetail)}` },
    { label: 'Por reponer', value: low.length, kind: 'int' as const, hint: low[0] ? low[0].name : 'El piso está cubierto' },
  ]

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-brass uppercase">La grasa que nunca falla · Cartagena</p>
          <h1 className="mt-3 font-serif text-4xl leading-none tracking-wide uppercase sm:text-6xl">{greeting()}</h1>
          <p className="mt-2 text-sm text-muted">{longDate()} · {todayUnits} {todayUnits === 1 ? 'prenda salida hoy' : 'prendas salidas hoy'}</p>
        </div>
        <Button onClick={() => go('vender')}>Nueva venta</Button>
      </header>

      <div className="mt-10 grid gap-5 lg:grid-cols-12">
        <section className="rounded-3xl border border-line bg-card p-6 sm:p-8 lg:col-span-8">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[11px] tracking-[0.18em] text-muted uppercase">Ventas de hoy</p>
            <p className="text-sm text-muted">{todaySales.length} {todaySales.length === 1 ? 'ticket' : 'tickets'}</p>
          </div>
          <p className="mt-4 font-serif text-4xl tracking-tight tabular-nums sm:text-6xl"><CountUp value={todayTotal} /></p>
          <p className="mt-2 text-sm text-muted">Ticket promedio {money(average)}</p>
          <div className="mt-8">
            <Trend sales={retail} />
          </div>
        </section>

        <section className="flex flex-col rounded-3xl bg-brass p-6 text-espresso sm:p-8 lg:col-span-4">
          <p className="text-[11px] tracking-[0.18em] uppercase">Por cobrar</p>
          <p className="mt-4 font-serif text-4xl tracking-wide tabular-nums sm:text-5xl"><CountUp value={receivable} /></p>
          <p className="mt-2 text-sm">{open.length} {open.length === 1 ? 'cuenta abierta' : 'cuentas abiertas'}</p>
          <ul className="mt-8 flex-1 space-y-4">
            {open.slice(0, 4).map((sale) => (
              <li key={sale.id} className="flex items-start justify-between gap-3 border-t border-espresso/15 pt-4">
                <div>
                  <p className="text-sm font-medium">{sale.customerName}</p>
                  <p className="mt-1 text-xs opacity-70">{sale.number} · {relativeDay(sale.date)}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{money(sale.balance)}</p>
              </li>
            ))}
            {open.length === 0 ? <li className="text-sm">No hay saldos pendientes.</li> : null}
          </ul>
          <button type="button" className="mt-6 text-left text-sm font-semibold underline underline-offset-4" onClick={() => go('cobrar')}>
            Ver cartera
          </button>
        </section>
      </div>

      <section className="mt-5 grid border-y border-line sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div key={stat.label} className={`px-1 py-6 sm:px-6 ${index === 0 ? 'sm:pl-1' : 'lg:border-l lg:border-line'}`}>
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{stat.label}</p>
            <p className="mt-3 font-serif text-2xl tracking-tight tabular-nums sm:text-3xl"><CountUp value={stat.value} kind={stat.kind} /></p>
            <p className="mt-1 text-sm text-muted">{stat.hint}</p>
          </div>
        ))}
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-2xl">Últimas ventas</h2>
            <button type="button" className="text-sm text-brass-deep" onClick={() => go('ventas')}>Ver todas</button>
          </div>
          <ul>
            {retail.slice(0, 6).map((sale) => (
              <li key={sale.id} className="flex items-center justify-between gap-3 border-t border-line py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{sale.customerName}</p>
                  <p className="mt-0.5 text-xs text-muted">{sale.number} · {relativeDay(sale.date)}</p>
                </div>
                <p className="shrink-0 text-sm tabular-nums">{money(sale.total)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-line bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-2xl">Para reponer</h2>
            <button type="button" className="text-sm text-brass-deep" onClick={() => go('productos')}>Ver prendas</button>
          </div>
          <ul>
            {low.slice(0, 6).map((product) => (
              <li key={product.id} className="flex items-center gap-3 border-t border-line py-3">
                <span className="h-7 w-7 shrink-0 rounded-full border border-line" style={{ background: swatch(product.color) }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{product.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{product.color} · {product.size}</p>
                </div>
                <p className={`text-sm tabular-nums ${availableUnits(product) === 0 ? 'text-danger' : 'text-warn'}`}>{availableUnits(product)} und</p>
              </li>
            ))}
            {low.length === 0 ? <li className="border-t border-line py-6 text-sm text-muted">Ninguna prenda está bajo el mínimo.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  )
}
