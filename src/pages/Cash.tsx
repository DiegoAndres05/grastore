import { useState } from 'react'
import { Button, Field, FormError, PageHeader, inputClass } from '../components/ui'
import { ACCOUNT_LABEL, ACCOUNTS, MOVEMENT_LABEL, accountBalances, cashTotal } from '../lib/books'
import { dateTime, money } from '../lib/format'
import type { CashAccount } from '../types'
import { useStore } from '../store'

type Mode = 'apertura' | 'gasto' | 'retiro' | 'transferencia'

const modes: { id: Mode; label: string }[] = [
  { id: 'apertura', label: 'Saldo inicial' },
  { id: 'gasto', label: 'Gasto' },
  { id: 'retiro', label: 'Retiro' },
  { id: 'transferencia', label: 'Pasar plata' },
]

export function Cash() {
  const { state, openBalance, recordExpense, transfer, toast } = useStore()
  const balances = accountBalances(state.movements)
  const [mode, setMode] = useState<Mode>('gasto')
  const [account, setAccount] = useState<CashAccount>('efectivo')
  const [destination, setDestination] = useState<CashAccount>('nequi')
  const [amount, setAmount] = useState(0)
  const [concept, setConcept] = useState('')
  const [error, setError] = useState('')

  function save() {
    const result = mode === 'apertura'
      ? openBalance({ account, amount, note: concept })
      : mode === 'transferencia'
        ? transfer({ from: account, to: destination, amount, note: concept })
        : recordExpense({ kind: mode, concept, amount, account })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setAmount(0)
    setConcept('')
    setError('')
    toast(mode === 'transferencia' ? 'La plata pasó de cuenta' : mode === 'retiro' ? 'Retiro registrado' : mode === 'apertura' ? 'Saldo inicial guardado' : 'Gasto registrado')
  }

  return (
    <div>
      <PageHeader
        kicker="Nequi, efectivo y banco"
        title="Caja"
        text="Cada venta cobrada, abono, compra, gasto y retiro queda en una cuenta. Pasar plata entre cuentas no cambia el total."
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ACCOUNTS.map((item) => (
          <article key={item} className="rounded-3xl border border-line bg-card p-5">
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{ACCOUNT_LABEL[item]}</p>
            <p className="mt-3 font-serif text-2xl tabular-nums">{money(balances[item])}</p>
          </article>
        ))}
        <article className="rounded-3xl bg-brass p-5 text-espresso">
          <p className="text-[11px] tracking-[0.16em] uppercase">Plata real</p>
          <p className="mt-3 font-serif text-2xl tabular-nums">{money(cashTotal(state.movements))}</p>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-card p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${mode === item.id ? 'bg-ink text-paper' : 'border border-line text-muted'}`}
              onClick={() => { setMode(item.id); setError('') }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={mode === 'transferencia' ? 'Sale de' : 'Cuenta'}>
            <select className={inputClass} value={account} onChange={(event) => setAccount(event.target.value as CashAccount)}>
              {ACCOUNTS.map((item) => <option key={item} value={item}>{ACCOUNT_LABEL[item]}</option>)}
            </select>
          </Field>
          {mode === 'transferencia' ? (
            <Field label="Entra a">
              <select className={inputClass} value={destination} onChange={(event) => setDestination(event.target.value as CashAccount)}>
                {ACCOUNTS.map((item) => <option key={item} value={item}>{ACCOUNT_LABEL[item]}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Concepto">
              <input className={inputClass} value={concept} placeholder={mode === 'gasto' ? 'Luz, bolsa, transporte' : mode === 'retiro' ? 'Retiro del dueño' : 'Saldo con el que abre la cuenta'} onChange={(event) => setConcept(event.target.value)} />
            </Field>
          )}
          <Field label="Valor">
            <input className={inputClass} inputMode="numeric" value={amount ? new Intl.NumberFormat('es-CO').format(amount) : ''} placeholder="0" onChange={(event) => setAmount(Number(event.target.value.replace(/\D/g, '')) || 0)} />
          </Field>
          {mode === 'transferencia' ? (
            <Field label="Nota">
              <input className={inputClass} value={concept} placeholder="Opcional" onChange={(event) => setConcept(event.target.value)} />
            </Field>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted">
          {mode === 'gasto' ? 'El gasto baja la caja y la ganancia neta.' : mode === 'retiro' ? 'El retiro baja la caja y queda fuera de los gastos.' : mode === 'transferencia' ? 'Las dos cuentas se mueven por el mismo valor.' : 'El saldo inicial entra a la cuenta sin contarse como venta.'}
        </p>
        <FormError>{error}</FormError>
        <Button className="mt-4" onClick={save}>Guardar movimiento</Button>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl">Movimientos</h2>
        {state.movements.length === 0 ? <p className="mt-4 text-sm text-muted">Todavía no hay plata registrada.</p> : (
          <ul className="mt-4">
            {state.movements.slice(0, 40).map((movement) => (
              <li key={movement.id} className="flex items-start justify-between gap-3 border-t border-line py-3">
                <div className="min-w-0">
                  <p className="text-sm">{movement.concept}</p>
                  <p className="mt-1 text-xs text-muted">{dateTime(movement.date)} · {ACCOUNT_LABEL[movement.account]} · {MOVEMENT_LABEL[movement.kind]}</p>
                </div>
                <p className={`shrink-0 text-sm tabular-nums ${movement.direction === 'in' ? 'text-brass-deep' : ''}`}>
                  {movement.direction === 'in' ? '+' : '−'}{money(movement.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
