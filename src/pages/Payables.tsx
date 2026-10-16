import { useState } from 'react'
import { AccountSelect, Button, Field, FormError, MoneyInput, PageHeader, inputClass } from '../components/ui'
import { money, todayInput } from '../lib/format'
import { useStore } from '../store'
import type { PayableKind } from '../types'

const kinds: { id: PayableKind; label: string }[] = [
  { id: 'proveedor', label: 'Proveedor' },
  { id: 'sueldo', label: 'Sueldo' },
  { id: 'servicio', label: 'Servicio' },
  { id: 'capital', label: 'Capital' },
  { id: 'otro', label: 'Otro' },
]

export function Payables() {
  const { state, savePayable, payPayable, toast } = useStore()
  const [creditor, setCreditor] = useState('')
  const [concept, setConcept] = useState('')
  const [kind, setKind] = useState<PayableKind>('otro')
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '')
  const [date, setDate] = useState(todayInput())

  const open = state.payables.filter((item) => item.balance > 0)
  const total = open.reduce((sum, item) => sum + item.balance, 0)

  async function create() {
    const result = await savePayable({ creditor, concept, kind, amount, date })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setCreditor('')
    setConcept('')
    setAmount(0)
    setError('')
    toast('Deuda registrada')
  }

  async function pay(id: string) {
    const result = await payPayable({ payableId: id, amount: payAmount, accountId, date })
    if (!result.ok) {
      toast(result.error, 'warn')
      return
    }
    setPaying(null)
    toast('Pago registrado')
  }

  return (
    <div>
      <PageHeader kicker="Cuentas por pagar" title="Por pagar" text={`Saldo abierto ${money(total)}. Incluye proveedores, sueldos, servicios y préstamos de capital.`} />
      <section className="mb-8 rounded-3xl border border-line bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="A quién">
            <input className={inputClass} value={creditor} onChange={(event) => setCreditor(event.target.value)} />
          </Field>
          <Field label="Concepto">
            <input className={inputClass} value={concept} onChange={(event) => setConcept(event.target.value)} />
          </Field>
          <Field label="Clase">
            <select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as PayableKind)}>
              {kinds.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Valor">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Fecha">
            <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>
        <FormError>{error}</FormError>
        <Button className="mt-4" onClick={create}>Anotar deuda</Button>
      </section>
      <ul className="space-y-3">
        {open.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p>{item.creditor}</p>
                <p className="mt-1 text-xs text-muted">{item.concept} · {item.kind}{item.createdByName ? ` · ${item.createdByName}` : ''}</p>
              </div>
              <p className="font-serif text-2xl tabular-nums">{money(item.balance)}</p>
            </div>
            {paying === item.id ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <MoneyInput value={payAmount} onChange={setPayAmount} />
                <AccountSelect accounts={state.accounts} value={accountId} onChange={setAccountId} />
                <Button onClick={() => pay(item.id)}>Pagar</Button>
              </div>
            ) : (
              <button type="button" className="mt-3 text-sm text-brass-deep" onClick={() => { setPaying(item.id); setPayAmount(item.balance) }}>Registrar pago</button>
            )}
          </li>
        ))}
        {open.length === 0 ? <li className="text-sm text-muted">No hay deudas abiertas.</li> : null}
      </ul>
    </div>
  )
}
