import { useState } from 'react'
import { AccountSelect, Button, Field, FormError, MoneyInput, PageHeader, inputClass } from '../components/ui'
import { EXPENSE_CATEGORIES } from '../lib/catalog'
import { dateTime, money, todayInput } from '../lib/format'
import { useStore } from '../store'

export function Expenses() {
  const { state, expense, capital, toast } = useStore()
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [custom, setCustom] = useState('')
  const [amount, setAmount] = useState(0)
  const [payee, setPayee] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayInput())
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '')
  const [onCredit, setOnCredit] = useState(false)
  const [error, setError] = useState('')
  const [person, setPerson] = useState('')
  const [capitalAmount, setCapitalAmount] = useState(0)
  const [capitalKind, setCapitalKind] = useState<'aporte' | 'prestamo'>('aporte')
  const [capitalAccount, setCapitalAccount] = useState(state.accounts[0]?.id ?? '')

  async function save() {
    const result = await expense({
      category: custom.trim() || category,
      amount,
      payee,
      note,
      date,
      accountId: onCredit ? null : accountId,
      onCredit,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setAmount(0)
    setPayee('')
    setNote('')
    setError('')
    toast('Gasto registrado')
  }

  async function saveCapital() {
    const result = await capital({ kind: capitalKind, person, amount: capitalAmount, accountId: capitalAccount, date })
    if (!result.ok) {
      toast(result.error, 'warn')
      return
    }
    setPerson('')
    setCapitalAmount(0)
    toast(capitalKind === 'aporte' ? 'Aporte registrado' : 'Préstamo recibido. Quedó en por pagar.')
  }

  return (
    <div>
      <PageHeader kicker="Salidas" title="Gastos" text="Sueldos, domicilios, envíos, servicios y comida. Si no se pagan de una, quedan como deuda." />
      <section className="rounded-3xl border border-line bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría">
            <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
              {EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Otra categoría">
            <input className={inputClass} value={custom} placeholder="Opcional" onChange={(event) => setCustom(event.target.value)} />
          </Field>
          <Field label="Valor">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="A quién">
            <input className={inputClass} value={payee} placeholder="Jo, mensajero, luz…" onChange={(event) => setPayee(event.target.value)} />
          </Field>
          <Field label="Fecha">
            <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Cuenta">
            <AccountSelect accounts={state.accounts} value={onCredit ? '' : accountId} onChange={(id) => { setAccountId(id); setOnCredit(!id) }} allowEmpty emptyLabel="Dejar por pagar" />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={onCredit} onChange={(event) => setOnCredit(event.target.checked)} />
            No salió de la caja: queda por pagar
          </label>
          <Field label="Nota">
            <input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </div>
        <FormError>{error}</FormError>
        <Button className="mt-4" onClick={save}>Registrar gasto</Button>
      </section>
      <ul className="mt-6 space-y-3">
        {state.expenses.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line px-4 py-3">
            <div>
              <p>{item.category}{item.payee ? ` · ${item.payee}` : ''}</p>
              <p className="mt-1 text-xs text-muted">{dateTime(item.date)}{item.note ? ` · ${item.note}` : ''}{item.createdByName ? ` · ${item.createdByName}` : ''}</p>
            </div>
            <p className="tabular-nums">{money(item.amount)}</p>
          </li>
        ))}
        {state.expenses.length === 0 ? <li className="text-sm text-muted">Todavía no hay gastos.</li> : null}
      </ul>
      <section className="mt-10 rounded-3xl border border-line p-5">
        <h2 className="font-serif text-2xl">Aportes y préstamos de capital</h2>
        <p className="mt-2 text-sm text-muted">Un aporte sube el patrimonio. Un préstamo entra a la caja y queda como deuda.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Quién">
            <input className={inputClass} value={person} onChange={(event) => setPerson(event.target.value)} />
          </Field>
          <Field label="Valor">
            <MoneyInput value={capitalAmount} onChange={setCapitalAmount} />
          </Field>
          <Field label="Tipo">
            <select className={inputClass} value={capitalKind} onChange={(event) => setCapitalKind(event.target.value as 'aporte' | 'prestamo')}>
              <option value="aporte">Aporte</option>
              <option value="prestamo">Préstamo que hay que devolver</option>
            </select>
          </Field>
          <Field label="Entra a">
            <AccountSelect accounts={state.accounts} value={capitalAccount} onChange={setCapitalAccount} />
          </Field>
        </div>
        <Button className="mt-4" variant="ghost" onClick={saveCapital}>Registrar</Button>
      </section>
    </div>
  )
}
