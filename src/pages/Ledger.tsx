import { useMemo, useState } from 'react'
import { AccountSelect, Button, Field, FormError, MoneyInput, PageHeader, inputClass, tdClass, thClass } from '../components/ui'
import { accountBalance, ledgerRows } from '../lib/money'
import { dateTime, money, todayInput } from '../lib/format'
import { useStore } from '../store'
import type { AccountKind } from '../types'

const kinds: { id: AccountKind; label: string }[] = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'wallet', label: 'Billetera' },
  { id: 'bank', label: 'Banco' },
  { id: 'other', label: 'Otra' },
]

export function Ledger() {
  const { state, transfer, saveAccount, toast } = useStore()
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '')
  const [fromId, setFromId] = useState(state.accounts[0]?.id ?? '')
  const [toId, setToId] = useState(state.accounts[1]?.id ?? '')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayInput())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('bank')
  const [opening, setOpening] = useState(0)

  const selected = state.accounts.find((account) => account.id === accountId) ?? state.accounts[0]
  const rows = useMemo(() => (selected ? ledgerRows(state, selected.id).slice().reverse() : []), [state, selected])
  const fromAccount = state.accounts.find((account) => account.id === fromId)
  const available = fromAccount ? Math.max(0, accountBalance(state, fromAccount.id)) : 0
  const over = amount > available

  async function move() {
    const result = await transfer({ fromId, toId, amount, date, note })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setAmount(0)
    setNote('')
    setError('')
    toast('Traslado registrado')
  }

  async function createAccount() {
    const result = await saveAccount({ name, kind, openingBalance: opening })
    if (!result.ok) {
      toast(result.error, 'warn')
      return
    }
    setName('')
    setOpening(0)
    setAccountId(result.data.id)
    toast('Cuenta creada')
  }

  return (
    <div>
      <PageHeader kicker="Nequi, efectivo y bancos" title="Caja" text="Cada venta, abono, gasto y traslado queda en una cuenta, con el saldo corrido." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {state.accounts.filter((account) => account.active).map((account) => (
          <button key={account.id} type="button" className={`rounded-2xl border p-4 text-left ${selected?.id === account.id ? 'border-brass bg-card' : 'border-line bg-card'}`} onClick={() => setAccountId(account.id)}>
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{account.name}</p>
            <p className="mt-2 font-serif text-3xl tabular-nums">{money(accountBalance(state, account.id))}</p>
          </button>
        ))}
      </div>
      <section className="mb-8 rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Traslado</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Sale de">
            <AccountSelect accounts={state.accounts} value={fromId} onChange={setFromId} />
            <span className="mt-1.5 block text-xs text-muted">
              Disponible {money(available)}
            </span>
          </Field>
          <Field label="Entra a">
            <AccountSelect accounts={state.accounts} value={toId} onChange={setToId} />
          </Field>
          <Field label="Valor" hint={over ? `Solo hay ${money(available)} en ${fromAccount?.name ?? 'esa cuenta'}` : undefined}>
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Fecha">
            <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Nota">
            <input className={inputClass} value={note} placeholder="Pasaron a Nequi" onChange={(event) => setNote(event.target.value)} />
          </Field>
        </div>
        <FormError>{error}</FormError>
        <Button className="mt-4" disabled={over || amount <= 0} onClick={move}>Pasar dinero</Button>
      </section>
      <section className="mb-8 rounded-3xl border border-line p-5">
        <h2 className="font-serif text-2xl">Nueva cuenta</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Nombre">
            <input className={inputClass} value={name} placeholder="Daviplata" onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Tipo">
            <select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
              {kinds.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Saldo inicial">
            <MoneyInput value={opening} onChange={setOpening} />
          </Field>
        </div>
        <Button className="mt-4" variant="ghost" onClick={createAccount}>Agregar cuenta</Button>
      </section>
      {selected ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Fecha</th>
                <th className={thClass}>Detalle</th>
                <th className={`${thClass} text-right`}>Entra</th>
                <th className={`${thClass} text-right`}>Sale</th>
                <th className={`${thClass} text-right`}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={tdClass}>{dateTime(row.date)}</td>
                  <td className={tdClass}>{row.counterparty}{row.note ? ` · ${row.note}` : ''}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{row.direction === 'in' ? money(row.amount) : ''}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{row.direction === 'out' ? money(row.amount) : ''}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{money(row.balance)}</td>
                </tr>
              ))}
              <tr>
                <td className={tdClass} colSpan={4}>Saldo al abrir la cuenta</td>
                <td className={`${tdClass} text-right tabular-nums`}>{money(selected.openingBalance)}</td>
              </tr>
            </tbody>
          </table>
          {rows.length === 0 ? <p className="mt-3 text-sm text-muted">Todavía no hay movimientos. El saldo es el de apertura.</p> : null}
        </div>
      ) : null}
    </div>
  )
}
