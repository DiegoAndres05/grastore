import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { CountUp } from '../components/motion'
import { PageHeader } from '../components/ui'
import { money, percent } from '../lib/format'
import { ACCOUNT_LABEL, collectedByAccount } from '../lib/books'
import { byCategory, defaultSpan, rangeLabel, series, spanOptions, topProducts, type Grain } from '../lib/stats'
import { useStore } from '../store'

const grains: { id: Grain; label: string }[] = [
  { id: 'dia', label: 'Días' },
  { id: 'semana', label: 'Semanas' },
  { id: 'mes', label: 'Meses' },
]

function spanLabel(grain: Grain, count: number) {
  if (grain === 'dia') return `${count} días`
  if (grain === 'semana') return `${count} semanas`
  return `${count} meses`
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 639px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)')
    const onChange = () => setNarrow(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function Bars({ points }: { points: { label: string; total: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const narrow = useNarrow()
  const width = 760
  const height = 240
  const padX = 8
  const padY = 16
  const gap = points.length > 16 ? 4 : 8
  const max = Math.max(...points.map((point) => point.total), 1)
  const barWidth = (width - padX * 2 - gap * (points.length - 1)) / points.length
  const active = hover == null ? null : points[hover]
  const budget = narrow ? 4 : points.length > 16 ? 8 : points.length
  const step = points.length > budget ? Math.ceil((points.length - 1) / Math.max(1, budget - 1)) : 1
  const marks = points
    .map((point, index) => ({ point, index }))
    .filter(({ index }) => index % step === 0 || index === points.length - 1)

  function choose(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * width
    const index = Math.min(points.length - 1, Math.max(0, Math.floor((x - padX) / (barWidth + gap))))
    setHover(index)
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted">{active ? active.label : narrow ? 'Toca una barra' : 'Pasa el cursor por una barra'}</p>
        <p className="font-serif text-2xl tabular-nums">{active ? money(active.total) : ''}</p>
      </div>
      <svg
        key={points.map((point) => point.label).join('|')}
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
        {points.map((point, index) => {
          const barHeight = point.total === 0 ? 3 : Math.max(6, (point.total / max) * (height - padY * 2))
          const x = padX + index * (barWidth + gap)
          const y = height - padY - barHeight
          const hot = hover === index
          return (
            <rect
              key={`${point.label}-${index}`}
              className="bar-grow"
              style={{ animationDelay: `${Math.min(index, 14) * 35}ms` }}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={Math.min(6, barWidth / 2)}
              fill={point.total === 0 ? '#2a2a2a' : hot ? '#ffd84d' : '#f5c518'}
            />
          )
        })}
      </svg>
      <div className="mt-2 flex justify-between gap-2">
        {marks.map(({ point, index }) => (
          <span key={`${point.label}-${index}`} className="min-w-0 truncate text-[10px] text-muted first:text-left last:text-right">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Rank({ rows }: { rows: { label: string; hint: string; total: number }[] }) {
  const max = Math.max(...rows.map((row) => row.total), 1)
  if (rows.length === 0) return <p className="text-sm text-muted">Sin movimiento en este periodo.</p>
  return (
    <ul className="space-y-4">
      {rows.map((row, index) => (
        <li key={`${row.label}-${row.hint}`}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm">{row.label}</p>
              <p className="text-xs text-muted">{row.hint}</p>
            </div>
            <p className="shrink-0 text-sm tabular-nums">{money(row.total)}</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="meter h-1.5 rounded-full bg-brass"
              style={{ width: `${Math.max(4, (row.total / max) * 100)}%`, animationDelay: `${index * 70}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Statistics() {
  const { state } = useStore()
  const [grain, setGrain] = useState<Grain>('dia')
  const [count, setCount] = useState(14)
  const [sweep, setSweep] = useState(0)

  const report = useMemo(() => series(state.sales, grain, count), [state.sales, grain, count])
  const total = report.buckets.reduce((sum, bucket) => sum + bucket.total, 0)
  const tickets = report.buckets.reduce((sum, bucket) => sum + bucket.tickets, 0)
  const units = report.buckets.reduce((sum, bucket) => sum + bucket.units, 0)
  const cost = report.buckets.reduce((sum, bucket) => sum + bucket.cost, 0)
  const previousTotal = report.previous.reduce((sum, bucket) => sum + bucket.total, 0)
  const margin = total - cost
  const change = previousTotal === 0 ? null : (total - previousTotal) / previousTotal
  const products = topProducts(report.currentSales)
  const methods = collectedByAccount(state.movements, report.start, new Date(report.end.getTime() + 1))
  const openCredit = report.currentSales.reduce((sum, sale) => sum + sale.balance, 0)
  const categories = byCategory(
    report.currentSales,
    new Map(state.products.map((product) => [product.id, product.category])),
  )
  const methodTotal = methods.reduce((sum, [, value]) => sum + value, 0) + openCredit

  return (
    <div>
      <PageHeader
        kicker="Tendencias"
        title="Estadísticas"
        text="Mueve el periodo para ver cómo se mueve la tienda: por días, por semanas o por meses."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {grains.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-full px-4 py-2 text-sm transition duration-200 ${grain === item.id ? 'bg-brass font-semibold text-espresso' : 'border border-line bg-card text-muted hover:text-ink'}`}
              onClick={() => {
                setGrain(item.id)
                setCount(defaultSpan(item.id))
                setSweep((value) => value + 1)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {spanOptions(grain).map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm transition duration-200 ${count === option ? 'bg-ink text-paper' : 'border border-line text-muted hover:text-ink'}`}
              onClick={() => {
                setCount(option)
                setSweep((value) => value + 1)
              }}
            >
              {spanLabel(grain, option)}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        {rangeLabel(report.start, report.end)}
        {change == null ? '' : ` · ${percent(Math.abs(change))} ${change >= 0 ? 'por encima' : 'por debajo'} del periodo anterior`}
      </p>

      <section className="grid border-y border-line sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Ventas', value: total, kind: 'money' as const, hint: change == null ? 'Periodo actual' : change >= 0 ? 'Sube frente al anterior' : 'Baja frente al anterior' },
          { label: 'Tickets', value: tickets, kind: 'int' as const, hint: tickets ? `Promedio ${money(Math.round(total / tickets))}` : 'Sin tickets' },
          { label: 'Unidades', value: units, kind: 'int' as const, hint: tickets ? `${(units / tickets).toFixed(1)} por ticket` : 'Sin salida' },
          { label: 'Margen', value: margin, kind: 'money' as const, hint: total ? percent(margin / total) : 'Sin ventas' },
        ].map((stat, index) => (
          <div key={stat.label} className={`py-6 sm:px-6 ${index === 0 ? 'sm:pl-0' : 'sm:border-l sm:border-line'}`}>
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{stat.label}</p>
            <p className="mt-3 font-serif text-2xl tabular-nums sm:text-3xl"><CountUp value={stat.value} kind={stat.kind} /></p>
            <p className="mt-1 text-sm text-muted">{stat.hint}</p>
          </div>
        ))}
      </section>

      <section className="relative mt-6 overflow-hidden rounded-3xl border border-line bg-card p-6 sm:p-8">
        {sweep > 0 ? <span key={sweep} className="sheen" aria-hidden="true" /> : null}
        <p className="text-[11px] tracking-[0.18em] text-muted uppercase">Ventas del periodo</p>
        <div className="mt-4">
          <Bars points={report.buckets.map((bucket) => ({ label: bucket.label, total: bucket.total }))} />
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-card p-6">
          <h2 className="mb-5 font-serif text-2xl tracking-wide">Prendas que más salen</h2>
          <Rank
            key={`${grain}-${count}-prendas`}
            rows={products.map((product) => ({
              label: product.name,
              hint: `${product.detail} · ${product.units} und`,
              total: product.total,
            }))}
          />
        </section>
        <section className="rounded-3xl border border-line bg-card p-6">
          <h2 className="mb-5 font-serif text-2xl tracking-wide">Cómo pagan</h2>
          <Rank
            key={`${grain}-${count}-pagos`}
            rows={[
              ...methods.map(([account, value]) => ({
                label: ACCOUNT_LABEL[account],
                hint: methodTotal ? percent(value / methodTotal) : '0%',
                total: value,
              })),
              ...(openCredit > 0 ? [{ label: 'Sigue fiado', hint: methodTotal ? percent(openCredit / methodTotal) : '0%', total: openCredit }] : []),
            ]}
          />
        </section>
      </div>

      <section className="mt-5 rounded-3xl border border-line bg-card p-6">
        <h2 className="mb-5 font-serif text-2xl tracking-wide">Por categoría</h2>
        <Rank key={`${grain}-${count}-categorias`} rows={categories.map(([label, value]) => ({ label, hint: 'Venta del periodo', total: value }))} />
      </section>
    </div>
  )
}
