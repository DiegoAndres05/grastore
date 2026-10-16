import { useMemo, useState } from 'react'
import { CollectModal } from '../components/CollectModal'
import { Badge, Empty, PageHeader, SearchBox, tdClass, thClass } from '../components/ui'
import { Button, Modal } from '../components/ui'
import { METHOD_LABEL, norm } from '../lib/catalog'
import { dateTime, lineCount, money, percent, saleStatus } from '../lib/format'
import { useStore } from '../store'
import type { Sale } from '../types'

export function Sales() {
  const { state } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'todas' | 'pagadas' | 'abiertas'>('todas')
  const [selected, setSelected] = useState<Sale | null>(null)
  const [collectSale, setCollectSale] = useState<Sale | null>(null)

  const rows = useMemo(() => {
    const needle = norm(query)
    return state.sales.filter((sale) => {
      if (filter === 'pagadas' && sale.balance > 0) return false
      if (filter === 'abiertas' && sale.balance <= 0) return false
      if (!needle) return true
      const blob = `${sale.number} ${sale.customerName} ${sale.lines.map((line) => line.name).join(' ')}`
      return norm(blob).includes(needle)
    })
  }, [state.sales, query, filter])

  const live = selected ? state.sales.find((sale) => sale.id === selected.id) ?? selected : null

  return (
    <div>
      <PageHeader kicker="Libro de caja" title="Ventas" text="Cada ticket queda con su cliente, su margen y lo que todavía se debe." />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-80">
          <SearchBox value={query} onChange={setQuery} placeholder="Ticket, cliente o prenda" />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ['todas', 'Todas'],
            ['pagadas', 'Pagadas'],
            ['abiertas', 'Por cobrar'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${filter === id ? 'bg-ink text-paper' : 'border border-line bg-card text-muted'}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty title="Sin tickets" text="No hay ventas con ese filtro." />
      ) : (
        <>
        <ul className="space-y-3 md:hidden">
          {rows.map((sale) => {
            const status = saleStatus(sale)
            const units = sale.lines.reduce((sum, line) => sum + line.qty, 0)
            return (
              <li key={sale.id}>
                <button type="button" className="w-full rounded-2xl border border-line bg-card p-4 text-left" onClick={() => setSelected(sale)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm">{sale.number}</p>
                      <p className="mt-1 truncate">{sale.customerName}</p>
                      <p className="mt-1 text-xs text-muted">{dateTime(sale.date)} · {sale.lines.length === 1 ? `${sale.lines[0].name} · ${sale.lines[0].size}` : lineCount(units)}{sale.createdByName ? ` · ${sale.createdByName}` : ''}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm tabular-nums">{money(sale.total)}</p>
                      <div className="mt-2"><Badge tone={status.tone}>{status.label}</Badge></div>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Ticket</th>
                <th className={thClass}>Cliente</th>
                <th className={thClass}>Detalle</th>
                <th className={`${thClass} text-right`}>Total</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sale) => {
                const status = saleStatus(sale)
                const units = sale.lines.reduce((sum, line) => sum + line.qty, 0)
                return (
                  <tr key={sale.id} className="cursor-pointer hover:bg-white/5" onClick={() => setSelected(sale)}>
                    <td className={tdClass}>
                      <p>{sale.number}</p>
                      <p className="text-xs text-muted">{dateTime(sale.date)}</p>
                    </td>
                    <td className={tdClass}>{sale.customerName}</td>
                    <td className={tdClass}>{sale.lines.length === 1 ? `${sale.lines[0].name} · ${sale.lines[0].size}` : lineCount(units)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{money(sale.total)}</td>
                    <td className={tdClass}><Badge tone={status.tone}>{status.label}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <Modal open={live != null} kicker={live ? dateTime(live.date) : ''} title={live?.number ?? ''} onClose={() => setSelected(null)}>
        {live ? <SaleBody key={live.id} sale={live} onCollect={() => setCollectSale(live)} /> : null}
      </Modal>
      <CollectModal
        open={collectSale != null}
        customerId={collectSale?.customerId ?? undefined}
        saleId={collectSale?.id}
        onClose={() => setCollectSale(null)}
      />
    </div>
  )
}

function SaleBody({ sale, onCollect }: { sale: Sale; onCollect: () => void }) {
  const { voidSale, updateSale, returnSale, toast, can } = useStore()
  const [prices, setPrices] = useState(sale.lines.map((line) => line.price))
  const [when, setWhen] = useState(sale.date.slice(0, 10))
  const [returnQty, setReturnQty] = useState(sale.lines.map(() => 0))
  const cost = sale.lines.reduce((sum, line) => sum + line.cost * line.qty, 0)
  const margin = sale.total - cost
  const status = saleStatus(sale)
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{sale.customerName} · {METHOD_LABEL[sale.method]}</p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <ul className="mt-5 space-y-3">
        {sale.lines.map((line) => (
          <li key={`${line.productId}-${line.size}`} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">{line.qty} × {line.name}<span className="block text-xs text-muted">{line.color} · {line.size} · {line.sku}</span></span>
            <span className="shrink-0 tabular-nums">{money(line.qty * line.price)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        {sale.discount > 0 ? <div className="flex justify-between"><dt className="text-muted">Descuento</dt><dd className="tabular-nums">{money(sale.discount)}</dd></div> : null}
        <div className="flex justify-between"><dt className="text-muted">Total</dt><dd className="font-serif text-2xl tabular-nums">{money(sale.total)}</dd></div>
        {can('products.costs') ? <div className="flex justify-between"><dt className="text-muted">Costo</dt><dd className="tabular-nums">{money(cost)}</dd></div> : null}
        {can('products.costs') ? <div className="flex justify-between"><dt className="text-muted">Margen</dt><dd className="tabular-nums">{money(margin)} · {percent(sale.total ? margin / sale.total : 0)}</dd></div> : null}
        {sale.createdByName ? <div className="flex justify-between"><dt className="text-muted">Registró</dt><dd>{sale.createdByName}</dd></div> : null}
        {sale.voided && sale.voidedByName ? <div className="flex justify-between"><dt className="text-muted">Anuló</dt><dd>{sale.voidedByName}</dd></div> : null}
        {sale.balance > 0 ? <div className="flex justify-between text-warn"><dt>Saldo</dt><dd className="tabular-nums">{money(sale.balance)}</dd></div> : null}
      </dl>
      {sale.note ? <p className="mt-4 text-sm text-muted">{sale.note}</p> : null}
      {sale.balance > 0 && sale.customerId && !sale.voided && can('collections.take') ? (
        <Button className="mt-6" onClick={onCollect}>Registrar abono</Button>
      ) : null}
      {!sale.voided && sale.kind !== 'opening' && (can('sales.edit') || can('sales.return') || can('sales.void')) ? (
        <div className="mt-6 space-y-3 border-t border-line pt-4">
          <label className="block text-sm">
            <span className="mb-2 block text-[11px] tracking-[0.16em] text-muted uppercase">Fecha</span>
            <input className="w-full rounded-xl border border-line bg-paper px-3 py-2" type="date" value={when} onChange={(event) => setWhen(event.target.value)} />
          </label>
          <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Corregir precios</p>
          {sale.lines.map((line, index) => (
            <label key={`${line.productId}-${index}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{line.name}</span>
              <input className="w-28 rounded-xl border border-line bg-paper px-3 py-2 text-right" inputMode="numeric" value={new Intl.NumberFormat('es-CO').format(prices[index] ?? line.price)} onChange={(event) => setPrices((current) => current.map((price, item) => item === index ? Number(event.target.value.replace(/\D/g, '')) || 0 : price))} />
            </label>
          ))}
          <Button variant="ghost" onClick={() => {
            void updateSale(sale.id, { date: when, prices: prices.map((price, index) => ({ index, price })) }).then((result) => {
              if (!result.ok) toast(result.error, 'warn')
              else toast('Venta actualizada')
            })
          }}>Guardar precios</Button>
          <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Devolver</p>
          {sale.lines.map((line, index) => (
            <label key={`back-${line.productId}-${index}`} className="flex items-center justify-between gap-3 text-sm">
              <span>{line.name} · quedan {line.qty - (line.returnedQty ?? 0)}</span>
              <input className="w-20 rounded-xl border border-line bg-paper px-3 py-2" inputMode="numeric" value={returnQty[index] || ''} onChange={(event) => setReturnQty((current) => current.map((qty, item) => item === index ? Number(event.target.value.replace(/\D/g, '')) || 0 : qty))} />
            </label>
          ))}
          <Button variant="ghost" onClick={() => {
            void returnSale({ saleId: sale.id, lines: returnQty.map((qty, index) => ({ index, qty })).filter((line) => line.qty > 0) }).then((result) => {
              if (!result.ok) toast(result.error, 'warn')
              else toast('Devolución registrada')
            })
          }}>Registrar devolución</Button>
          <Button variant="ghost" onClick={() => {
            void voidSale(sale.id).then((result) => {
              if (!result.ok) toast(result.error, 'warn')
              else toast('Venta anulada')
            })
          }}>Anular venta</Button>
        </div>
      ) : null}
      {!sale.voided && sale.kind === 'opening' && can('sales.void') ? (
        <Button className="mt-6" variant="ghost" onClick={() => {
          void voidSale(sale.id).then((result) => {
            if (!result.ok) toast(result.error, 'warn')
            else toast('Saldo inicial anulado')
          })
        }}>Anular saldo inicial</Button>
      ) : null}
    </div>
  )
}
