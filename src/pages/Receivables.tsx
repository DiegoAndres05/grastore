import { useState } from 'react'
import { CollectModal } from '../components/CollectModal'
import { AccountSelect, Badge, Button, Empty, Field, MoneyInput, PageHeader, inputClass, tdClass, thClass } from '../components/ui'
import { cutoffSummary } from '../lib/accounting'
import { daysSince, money, relativeDay, todayInput } from '../lib/format'
import { accountBalance } from '../lib/money'
import { useStore } from '../store'

export function Receivables() {
  const { state, loan, payLoan, layawayDeposit, completeLayaway, cancelLayaway, toast } = useStore()
  const [onlyLate, setOnlyLate] = useState(false)
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [saleId, setSaleId] = useState<string | undefined>()
  const [open, setOpen] = useState(false)

  const [loanPerson, setLoanPerson] = useState('')
  const [loanAmount, setLoanAmount] = useState(0)
  const [loanAccount, setLoanAccount] = useState(state.accounts[0]?.id ?? '')
  const loanFrom = state.accounts.find((account) => account.id === loanAccount)
  const loanAvailable = loanFrom ? Math.max(0, accountBalance(state, loanFrom.id)) : 0
  const loanOver = loanAmount > loanAvailable
  const rows = state.sales
    .filter((sale) => !sale.voided && sale.balance > 0)
    .filter((sale) => !onlyLate || daysSince(sale.date) > 15)
    .sort((a, b) => a.date.localeCompare(b.date))
  const total = state.sales.reduce((sum, sale) => sum + sale.balance, 0)
  const clients = new Set(rows.map((sale) => sale.customerId)).size
  const late = state.sales.filter((sale) => !sale.voided && sale.balance > 0 && daysSince(sale.date) > 15)
  const cuts = cutoffSummary(state)
  const lateTotal = late.reduce((sum, sale) => sum + sale.balance, 0)

  return (
    <div>
      <PageHeader
        kicker="Cuentas por cobrar"
        title="Cartera"
        text="Lo que se fía en el ticket queda en la deuda del cliente. Los abonos se aplican primero a la venta que elijas."
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
      <section className="mt-8">
        <h2 className="font-serif text-2xl">Por corte</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {cuts.map((cut) => (
            <li key={cut.label} className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm">
              <span>{cut.label} · {cut.count}</span>
              <span className="tabular-nums">{money(cut.amount)}</span>
            </li>
          ))}
          {cuts.length === 0 ? <li className="text-sm text-muted">No hay saldos agrupados.</li> : null}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl">Plan separe</h2>
        <ul className="mt-3 space-y-3">
          {state.layaways.filter((item) => item.status === 'abierto').map((item) => (
            <li key={item.id} className="rounded-2xl border border-line p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p>{item.customerName} · {item.number}</p>
                  <p className="mt-1 text-xs text-muted">Abonado {money(item.deposited)} · falta {money(item.balance)}{item.note ? ` · ${item.note}` : ''}</p>
                </div>
                <p className="tabular-nums">{money(item.balance)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" className="text-brass-deep" onClick={() => {
                  void layawayDeposit({ layawayId: item.id, amount: item.balance, accountId: state.accounts[0]?.id ?? '', date: todayInput() }).then((result) => {
                    if (!result.ok) toast(result.error, 'warn')
                    else toast('Abono del apartado registrado')
                  })
                }}>Abonar el saldo</button>
                {item.balance === 0 ? <button type="button" className="text-brass-deep" onClick={() => {
                  void completeLayaway({ layawayId: item.id, date: todayInput() }).then((result) => {
                    if (!result.ok) toast(result.error, 'warn')
                    else toast(`Entregado en ${result.data.number}`)
                  })
                }}>Entregar</button> : null}
                <button type="button" className="text-muted" onClick={() => {
                  void cancelLayaway({ layawayId: item.id, accountId: state.accounts[0]?.id, date: todayInput() }).then((result) => {
                    if (!result.ok) toast(result.error, 'warn')
                    else toast('Apartado cancelado')
                  })
                }}>Cancelar</button>
              </div>
            </li>
          ))}
          {state.layaways.every((item) => item.status !== 'abierto') ? <li className="text-sm text-muted">No hay apartados abiertos.</li> : null}
        </ul>
      </section>
      <section className="mt-8 rounded-3xl border border-line p-5">
        <h2 className="font-serif text-2xl">Préstamos a terceros</h2>
        <p className="mt-2 text-sm text-muted">Es plata que sale de la caja y no es una venta. Se cobra aparte de la cartera de ropa.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="A quién"><input className={inputClass} value={loanPerson} onChange={(event) => setLoanPerson(event.target.value)} /></Field>
          <Field label="Valor" hint={loanOver ? `Solo hay ${money(loanAvailable)} en ${loanFrom?.name ?? 'esa cuenta'}` : undefined}>
            <MoneyInput value={loanAmount} onChange={setLoanAmount} />
          </Field>
          <Field label="Sale de">
            <AccountSelect accounts={state.accounts} value={loanAccount} onChange={setLoanAccount} />
            <span className="mt-1.5 block text-xs text-muted">Disponible {money(loanAvailable)}</span>
          </Field>
        </div>
        <Button className="mt-4" variant="ghost" disabled={loanOver || loanAmount <= 0} onClick={() => {
          void loan({ person: loanPerson, amount: loanAmount, accountId: loanAccount, date: todayInput() }).then((result) => {
            if (!result.ok) toast(result.error, 'warn')
            else { toast('Préstamo registrado'); setLoanPerson(''); setLoanAmount(0) }
          })
        }}>Prestar</Button>
        <ul className="mt-4 space-y-2">
          {state.loans.filter((item) => item.balance > 0).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border-t border-line py-3 text-sm">
              <span>{item.person} · {money(item.balance)}</span>
              <button type="button" className="text-brass-deep" onClick={() => {
                void payLoan({ loanId: item.id, amount: item.balance, accountId: loanAccount, date: todayInput() }).then((result) => {
                  if (!result.ok) toast(result.error, 'warn')
                  else toast('Abono del préstamo registrado')
                })
              }}>Cobrar todo</button>
            </li>
          ))}
        </ul>
      </section>
      <CollectModal open={open} customerId={customerId} saleId={saleId} onClose={() => setOpen(false)} />
    </div>
  )
}
