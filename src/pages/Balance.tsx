import { balanceHistory, balanceSheet, type BalanceRow } from '../lib/accounting'
import { money, percent } from '../lib/format'
import { useStore } from '../store'
import { Button, PageHeader } from '../components/ui'

function shown(value: number | null) {
  return value == null ? '—' : money(value)
}

function extraLines(row: BalanceRow) {
  return row.lines.filter((line) => {
    const key = line.label.toLowerCase()
    if (key.startsWith('venta')) return false
    if (key.startsWith('sueldo')) return false
    if (key === 'ganancia') return false
    return true
  })
}

function lineValue(line: BalanceRow['lines'][number]) {
  if (line.kind === 'ratio') return percent(line.amount)
  if (line.kind === 'count') return String(line.amount)
  return money(line.amount)
}

export function Balance() {
  const { state, closeMonth, toast } = useStore()
  const rows = balanceHistory(state)
  const sheet = balanceSheet(state)
  const excel = rows.filter((row) => row.source === 'excel')

  async function lock(row: BalanceRow) {
    if (!row.period) return
    const [yearText, monthText] = row.period.split('-')
    const result = await closeMonth(Number(yearText), Number(monthText))
    if (!result.ok) toast(result.error, 'warn')
    else toast(`Cierre de ${row.label} guardado`)
  }

  return (
    <div>
      <PageHeader
        kicker="Hoja Balance"
        title="Balance"
        text="Cada mes guarda patrimonio, ganancia y sueldo al 25%, como los bloques del Excel. Los meses importados quedan cerrados. El mes en curso se calcula con lo vendido aquí, y al cerrarlo se anota el patrimonio de hoy."
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Patrimonio hoy</p>
          <p className="mt-2 font-serif text-3xl tabular-nums">{money(sheet.equity)}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Meses del Excel</p>
          <p className="mt-2 font-serif text-3xl tabular-nums">{excel.length}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Sueldo</p>
          <p className="mt-2 font-serif text-3xl tabular-nums">{state.settings.salarySharePct}%</p>
        </article>
      </section>
      <div className="mt-6 overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-[0.16em] text-muted uppercase">
              <th className="p-3">Periodo</th>
              <th className="p-3 text-right">Patrimonio</th>
              <th className="p-3 text-right">Venta neta</th>
              <th className="p-3 text-right">Ganancia</th>
              <th className="p-3 text-right">Sueldo {state.settings.salarySharePct}%</th>
              <th className="p-3 text-right">Und</th>
              <th className="p-3">Origen</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted" colSpan={7}>Todavía no hay meses. Importa el Excel o cierra el mes en curso.</td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const extras = extraLines(row)
              const excelSame = row.source === 'vivo' && excel.some((item) => item.period === row.period)
              return (
                <tr key={row.key} className="border-t border-line align-top">
                  <td className="p-3">
                    <p>{row.label}</p>
                    {row.from && row.to && row.label !== `${row.from} – ${row.to}` ? <p className="text-xs text-muted">{row.from} – {row.to}</p> : null}
                    {extras.length ? (
                      <p className="mt-1 text-xs text-muted">
                        {extras.map((line) => `${line.label} ${lineValue(line)}`).join(' · ')}
                      </p>
                    ) : null}
                    {excelSame ? <p className="mt-1 text-xs text-muted">El Excel ya tiene un cierre de este periodo. Esta fila sale de lo registrado en la app.</p> : null}
                  </td>
                  <td className="p-3 text-right tabular-nums">{shown(row.equity)}</td>
                  <td className="p-3 text-right tabular-nums">{shown(row.sales)}</td>
                  <td className="p-3 text-right tabular-nums">{shown(row.profit)}</td>
                  <td className="p-3 text-right tabular-nums">{shown(row.salary)}</td>
                  <td className="p-3 text-right tabular-nums">{row.units ?? '—'}</td>
                  <td className="p-3">
                    {row.source === 'excel' ? <span>Excel</span> : null}
                    {row.source === 'app' ? <span>Cerrado</span> : null}
                    {row.source === 'vivo' ? (
                      <Button variant="ghost" onClick={() => lock(row)}>Cerrar mes</Button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
