import { ACCOUNT_LABEL, ACCOUNTS, balanceSheet, periodResult } from '../lib/books'
import { money, percent } from '../lib/format'
import { useStore } from '../store'

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3 ${strong ? '' : 'border-t border-line'}`}>
      <dt className={strong ? 'font-serif text-2xl' : 'text-sm text-muted'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-serif text-2xl' : 'text-sm'}`}>{money(value)}</dd>
    </div>
  )
}

export function Balance() {
  const { state } = useStore()
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const books = balanceSheet(state)
  const month = periodResult(state, start, end)
  const allStart = new Date(0)
  const allEnd = new Date(now.getFullYear() + 1, 0, 1)
  const life = periodResult(state, allStart, allEnd)

  return (
    <div>
      <header className="mb-8">
        <p className="text-[11px] tracking-[0.22em] text-muted uppercase">Situación de la tienda</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">Balance</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          La plata, lo que deben los clientes y el inventario al costo, menos lo que la tienda debe. El patrimonio es esa resta.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-card p-6">
          <h2 className="font-serif text-2xl">Hoy</h2>
          <dl className="mt-4">
            {ACCOUNTS.map((account) => (
              <Row key={account} label={ACCOUNT_LABEL[account]} value={books.accounts[account]} />
            ))}
            <Row label="Plata real" value={books.cash} strong />
            <Row label="Por cobrar" value={books.receivable} />
            <Row label="Inventario al costo" value={books.inventory} />
            <Row label="Activos" value={books.assets} strong />
            <Row label="Por pagar" value={books.payable} />
            <Row label="Patrimonio" value={books.equity} strong />
          </dl>
        </section>

        <section className="rounded-3xl border border-line bg-card p-6">
          <h2 className="font-serif text-2xl">Ganancia del mes</h2>
          <dl className="mt-4">
            <Row label="Ventas" value={month.sales} />
            <Row label="Costo de lo vendido" value={month.cost} />
            <Row label="Ganancia bruta" value={month.gross} strong />
            <Row label="Gastos" value={month.expenses} />
            <Row label="Ganancia neta" value={month.net} strong />
            <Row label="Retiros del dueño" value={month.withdrawals} />
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted">
            {month.sales ? `La ganancia bruta es el ${percent(month.gross / month.sales)} de las ventas.` : 'Este mes todavía no tiene ventas.'} Los retiros salen de la caja y no se restan otra vez como gasto.
          </p>
          <h3 className="mt-8 font-serif text-xl">Desde el inicio del libro</h3>
          <dl className="mt-2">
            <Row label="Ventas" value={life.sales} />
            <Row label="Costo de lo vendido" value={life.cost} />
            <Row label="Ganancia bruta" value={life.gross} />
            <Row label="Gastos" value={life.expenses} />
            <Row label="Ganancia neta" value={life.net} strong />
          </dl>
        </section>
      </div>
    </div>
  )
}
