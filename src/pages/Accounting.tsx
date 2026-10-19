import { useMemo, useState } from 'react'
import { Button, Field, PageHeader, inputClass } from '../components/ui'
import { balanceSheet, dailyReport, monthlyClose, profitAndLoss } from '../lib/accounting'
import { inventoryRows, ledgerRowsExport, payableRows, pnlRows, receivableRows, salesRows, saveCsv, saveXlsx } from '../lib/exportSheet'
import { money, percent, todayInput } from '../lib/format'
import { go } from '../lib/nav'
import { useStore } from '../store'

export function Accounting() {
  const { state, setSalaryShare, toast } = useStore()
  const now = new Date()
  const [from, setFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
  const [to, setTo] = useState(todayInput())
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [share, setShare] = useState(state.settings.salarySharePct)
  const sheet = balanceSheet(state)
  const report = useMemo(() => profitAndLoss(state, { from, to }), [state, from, to])
  const close = monthlyClose(state, year, month)
  const days = dailyReport(state, close.from === close.to ? { from: close.from, to: close.to } : { from: close.from, to: close.to })

  async function saveShare() {
    const result = await setSalaryShare(share)
    if (!result.ok) toast(result.error, 'warn')
    else toast('Porcentaje de sueldo actualizado')
  }

  return (
    <div>
      <PageHeader
        kicker="Balance LAGRASITASTORECTG"
        title="Contabilidad"
        text="El patrimonio es caja + cartera + inventario − por pagar − anticipos de apartados. Los meses del Excel, con ganancia y sueldo, están en Balance."
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Caja y bancos', sheet.cash],
          ['Cartera', sheet.receivable.total],
          ['Inventario', sheet.inventory.total],
          ['Por pagar', sheet.payables],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{label}</p>
            <p className="mt-2 font-serif text-3xl tabular-nums">{money(Number(value))}</p>
          </article>
        ))}
      </section>
      <section className="mt-4 rounded-3xl bg-brass p-6 text-espresso">
        <p className="text-[11px] tracking-[0.18em] uppercase">Patrimonio</p>
        <p className="mt-2 font-serif text-5xl tabular-nums">{money(sheet.equity)}</p>
        <p className="mt-2 text-sm">Activos {money(sheet.assets)} − por pagar {money(sheet.payables)} − anticipos {money(sheet.deposits)}</p>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line p-5">
          <h2 className="font-serif text-2xl">Cuentas</h2>
          <ul className="mt-3">
            {sheet.accounts.map((account) => (
              <li key={account.id} className="flex justify-between border-t border-line py-2 text-sm">
                <span>{account.name}</span><span className="tabular-nums">{money(account.balance)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-line py-2 text-sm"><span>Ventas a crédito</span><span className="tabular-nums">{money(sheet.receivable.credit)}</span></li>
            <li className="flex justify-between border-t border-line py-2 text-sm"><span>Plan separe importado</span><span className="tabular-nums">{money(sheet.receivable.layaways)}</span></li>
            <li className="flex justify-between border-t border-line py-2 text-sm"><span>Anticipos de apartados</span><span className="tabular-nums">{money(sheet.deposits)}</span></li>
            <li className="flex justify-between border-t border-line py-2 text-sm"><span>Préstamos</span><span className="tabular-nums">{money(sheet.receivable.loans)}</span></li>
            <li className="flex justify-between border-t border-line py-2 text-sm"><span>Prendas a costo</span><span className="tabular-nums">{money(sheet.inventory.garments)}</span></li>
            <li className="flex justify-between border-t border-line py-2 text-sm"><span>Inversión sin detalle</span><span className="tabular-nums">{money(sheet.inventory.investments)}</span></li>
          </ul>
        </section>
        <section className="rounded-3xl border border-line p-5">
          <h2 className="font-serif text-2xl">Pérdidas y ganancias</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Desde"><input className={inputClass} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
            <Field label="Hasta"><input className={inputClass} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
          </div>
          <ul className="mt-4 text-sm">
            {[
              ['Ventas', report.netSales],
              ['Costo de venta', report.cogs],
              ['Utilidad bruta', report.grossProfit],
              ['Gastos', report.expenseTotal],
            ].map(([label, value]) => (
              <li key={String(label)} className="flex justify-between border-t border-line py-2"><span>{label}</span><span className="tabular-nums">{money(Number(value))}</span></li>
            ))}
          </ul>
          <p className="mt-4 font-serif text-3xl tabular-nums">{money(report.profit)}</p>
          <p className="text-sm text-muted">Margen {percent(report.margin)} · {report.units} unidades</p>
          {report.openingSales ? <p className="mt-2 text-xs text-muted">Incluye el histórico importado: ventas {money(report.openingSales)} y costo {money(report.openingCogs)}.</p> : null}
          {state.openingPnl && report.openingSales === 0 ? (
            <div className="mt-3 rounded-2xl border border-brass/40 bg-brass/10 p-3 text-sm">
              <p>
                El histórico importado está fuera de estas fechas, por eso aquí sale en cero. Quedó al {state.openingPnl.asOf}: ventas {money(state.openingPnl.sales)} y costo {money(state.openingPnl.cogs)}.
              </p>
              <button
                type="button"
                className="mt-2 text-sm text-brass-deep underline"
                onClick={() => {
                  const opening = state.openingPnl
                  if (!opening) return
                  const [yearText, monthText] = opening.asOf.split('-')
                  const historicYear = Number(yearText)
                  const historicMonth = Number(monthText)
                  if (!historicYear || !historicMonth) return
                  const last = new Date(historicYear, historicMonth, 0).getDate()
                  const month = String(historicMonth).padStart(2, '0')
                  setFrom(`${historicYear}-${month}-01`)
                  setTo(`${historicYear}-${month}-${String(last).padStart(2, '0')}`)
                  setYear(historicYear)
                  setMonth(historicMonth)
                }}
              >
                Ver el mes del histórico
              </button>
            </div>
          ) : null}
        </section>
      </div>
      <section className="mt-6 rounded-3xl border border-line p-5">
        <h2 className="font-serif text-2xl">Cierre del mes</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Año"><input className={`${inputClass} w-28`} inputMode="numeric" value={year} onChange={(event) => setYear(Number(event.target.value) || year)} /></Field>
          <Field label="Mes"><input className={`${inputClass} w-24`} inputMode="numeric" value={month} onChange={(event) => setMonth(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} /></Field>
          <Field label="Sueldo %">
            <input className={`${inputClass} w-24`} inputMode="numeric" value={share} onChange={(event) => setShare(Number(event.target.value) || 0)} />
          </Field>
          <Button variant="ghost" onClick={saveShare}>Guardar %</Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ['Utilidad', money(close.profit)],
            ['Margen', percent(close.margin)],
            ['Unidades', String(close.units)],
            [`Sueldo ${close.salarySharePct}%`, money(close.salaryShare)],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl bg-card p-4">
              <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{label}</p>
              <p className="mt-2 font-serif text-2xl tabular-nums">{value}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-[0.16em] text-muted uppercase">
                <th className="pb-2">Día</th><th className="pb-2 text-right">Ventas</th><th className="pb-2 text-right">Costo</th><th className="pb-2 text-right">Gastos</th><th className="pb-2 text-right">Utilidad</th><th className="pb-2 text-right">Und</th>
              </tr>
            </thead>
            <tbody>
              {days.filter((day) => day.sales || day.expenses || day.units).map((day) => (
                <tr key={day.date} className="border-t border-line">
                  <td className="py-2">{day.date}</td>
                  <td className="py-2 text-right tabular-nums">{money(day.sales)}</td>
                  <td className="py-2 text-right tabular-nums">{money(day.cogs)}</td>
                  <td className="py-2 text-right tabular-nums">{money(day.expenses)}</td>
                  <td className="py-2 text-right tabular-nums">{money(day.profit)}</td>
                  <td className="py-2 text-right tabular-nums">{day.units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-6 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => go('balance')}>Ver Balance</Button>
        <Button variant="ghost" onClick={() => saveXlsx('inventario.xlsx', [{ name: 'Inventario', rows: inventoryRows(state) }])}>Inventario xlsx</Button>
        <Button variant="ghost" onClick={() => saveCsv('inventario.csv', inventoryRows(state))}>Inventario csv</Button>
        <Button variant="ghost" onClick={() => saveXlsx('ventas.xlsx', [{ name: 'Ventas', rows: salesRows(state) }])}>Ventas</Button>
        <Button variant="ghost" onClick={() => saveXlsx('cartera.xlsx', [{ name: 'Cartera', rows: receivableRows(state) }])}>Cartera</Button>
        <Button variant="ghost" onClick={() => saveXlsx('por-pagar.xlsx', [{ name: 'Por pagar', rows: payableRows(state) }])}>Por pagar</Button>
        <Button variant="ghost" onClick={() => saveXlsx('caja.xlsx', [{ name: 'Caja', rows: ledgerRowsExport(state) }])}>Caja</Button>
        <Button variant="ghost" onClick={() => saveXlsx('pyg.xlsx', [{ name: 'PyG', rows: pnlRows(state, { from, to }) }])}>P y G</Button>
      </section>
    </div>
  )
}
