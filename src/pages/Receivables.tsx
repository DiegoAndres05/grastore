import { useState } from 'react'
import { CollectModal } from '../components/CollectModal'
import { Badge, Button, Empty, PageHeader, tdClass, thClass } from '../components/ui'
import { daysSince, money, relativeDay } from '../lib/format'
import { useStore } from '../store'

export function Receivables() {
  const { state } = useStore()
  const [onlyLate, setOnlyLate] = useState(false)
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [saleId, setSaleId] = useState<string | undefined>()
  const [open, setOpen] = useState(false)

  const rows = state.sales
    .filter((sale) => sale.balance > 0)
    .filter((sale) => !onlyLate || daysSince(sale.date) > 15)
    .sort((a, b) => a.date.localeCompare(b.date))
  const total = state.sales.reduce((sum, sale) => sum + sale.balance, 0)
  const clients = new Set(rows.map((sale) => sale.customerId)).size
  const late = state.sales.filter((sale) => sale.balance > 0 && daysSince(sale.date) > 15)
  const lateTotal = late.reduce((sum, sale) => sum + sale.balance, 0)

  return (
    <div>
      <PageHeader
        kicker="Cuentas por cobrar"
        title="Cartera"
        text="El crédito de tienda queda amarrado al cupo del cliente. Los abonos se aplican primero a la venta que elijas."
        action={<Button onClick={() => { setCustomerId(undefined); setSaleId(undefined); setOpen(true) }}>Registrar abono</Button>}
      />
      <section className="mb-8 grid border-y border-line sm:grid-cols-3">
        {[
          { label: 'Saldo abierto', value: money(total), hint: `${state.sales.filter((sale) => sale.balance > 0).length} ventas` },
          { label: 'Clientes', value: String(new Set(state.sales.filter((sale) => sale.balance > 0).map((sale) => sale.customerId)).size), hint: 'Con saldo pendiente' },
          { label: 'Más de 15 días', value: money(lateTotal), hint: `${late.length} cuentas` },
        ].map((stat, index) => (
          <div key={stat.label} className={`py-6 sm:px-6 ${index === 0 ? 'sm:pl-0' : 'sm:border-l sm:border-line'}`}>
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{stat.label}</p>
            <p className="mt-3 font-serif text-3xl tabular-nums">{stat.value}</p>
            <p className="mt-1 text-sm text-muted">{stat.hint}</p>
          </div>
        ))}
      </section>
      <button type="button" className={`mb-4 rounded-full px-3 py-1.5 text-sm ${onlyLate ? 'bg-ink text-paper' : 'border border-line bg-card text-muted'}`} onClick={() => setOnlyLate((value) => !value)}>
        Solo vencidas
      </button>
      {rows.length === 0 ? (
        <Empty title="Cartera al día" text={onlyLate ? 'Ninguna cuenta supera los 15 días.' : 'No hay saldos por cobrar.'} />
      ) : (
        <>
        <ul className="space-y-3 md:hidden">
          {rows.map((sale) => {
            const age = daysSince(sale.date)
            return (
              <li key={sale.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{sale.customerName}</p>
                    <p className="mt-1 text-xs text-muted">{sale.number} · pagó {money(sale.paid)} de {money(sale.total)}</p>
                  </div>
                  {age > 15 ? <Badge tone="danger">{relativeDay(sale.date)}</Badge> : <span className="shrink-0 text-xs text-muted">{relativeDay(sale.date)}</span>}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="font-serif text-2xl tabular-nums">{money(sale.balance)}</p>
                  <button
                    type="button"
                    className="text-sm text-brass-deep"
                    onClick={() => {
                      setCustomerId(sale.customerId ?? undefined)
                      setSaleId(sale.id)
                      setOpen(true)
                    }}
                  >
                    Abonar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Cliente</th>
                <th className={thClass}>Ticket</th>
                <th className={thClass}>Antigüedad</th>
                <th className={`${thClass} text-right`}>Saldo</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {rows.map((sale) => {
                const age = daysSince(sale.date)
                return (
                  <tr key={sale.id}>
                    <td className={tdClass}>{sale.customerName}</td>
                    <td className={tdClass}>
                      <p>{sale.number}</p>
                      <p className="text-xs text-muted">Pagó {money(sale.paid)} de {money(sale.total)}</p>
                    </td>
                    <td className={tdClass}>
                      {age > 15 ? <Badge tone="danger">{relativeDay(sale.date)}</Badge> : <span className="text-muted">{relativeDay(sale.date)}</span>}
                    </td>
                    <td className={`${tdClass} text-right font-medium tabular-nums`}>{money(sale.balance)}</td>
                    <td className={`${tdClass} text-right`}>
                      <button
                        type="button"
                        className="text-sm text-brass-deep"
                        onClick={() => {
                          setCustomerId(sale.customerId ?? undefined)
                          setSaleId(sale.id)
                          setOpen(true)
                        }}
                      >
                        Abonar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      <p className="mt-4 text-xs text-muted">{clients} clientes en esta vista.</p>
      <CollectModal open={open} customerId={customerId} saleId={saleId} onClose={() => setOpen(false)} />
    </div>
  )
}
