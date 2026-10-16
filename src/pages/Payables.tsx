import { useState } from 'react'
import { Badge, Button, Empty, Field, FormError, Modal, PageHeader, inputClass } from '../components/ui'
import { ACCOUNT_LABEL, ACCOUNTS, PAYABLE_LABEL, payableTotal } from '../lib/books'
import { dateTime, money } from '../lib/format'
import type { CashAccount, PayableKind } from '../types'
import { useStore } from '../store'

const kinds: Exclude<PayableKind, 'mercancia'>[] = ['servicio', 'sueldo', 'otro']

export function Payables() {
  const { state, savePayable, payPayable, toast } = useStore()
  const [open, setOpen] = useState(false)
  const [paying, setPaying] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [concept, setConcept] = useState('')
  const [kind, setKind] = useState<Exclude<PayableKind, 'mercancia'>>('servicio')
  const [total, setTotal] = useState(0)
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState(0)
  const [account, setAccount] = useState<CashAccount>('efectivo')
  const [error, setError] = useState('')

  const due = payableTotal(state.payables)
  const current = state.payables.find((item) => item.id === paying)

  function start() {
    setName('')
    setSupplierId('')
    setConcept('')
    setKind('servicio')
    setTotal(0)
    setNote('')
    setError('')
    setOpen(true)
  }

  function create() {
    const supplier = state.suppliers.find((item) => item.id === supplierId)
    const result = savePayable({
      supplierId: supplier?.id ?? null,
      name: supplier?.name || name,
      concept,
      kind,
      total,
      note,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast(`${result.data.number} quedó por pagar`)
    setOpen(false)
  }

  function pay() {
    if (!paying) return
    const result = payPayable({ payableId: paying, amount, account })
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast('Pago registrado. La deuda y la caja bajaron.')
    setPaying(null)
  }

  return (
    <div>
      <PageHeader
        kicker="Lo que la tienda debe"
        title="Por pagar"
        text="Una compra fiada nace aquí. Un pago baja esta deuda y la cuenta de donde salió la plata, sin crear otra compra."
        action={<Button onClick={start}>Nueva obligación</Button>}
      />
      <p className="mb-6 font-serif text-4xl tabular-nums">{money(due)}</p>
      {state.payables.length === 0 ? (
        <Empty title="Sin deudas" text="Las compras a crédito y los servicios fiados aparecen aquí." />
      ) : (
        <ul>
          {state.payables.map((payable) => (
            <li key={payable.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-line py-4">
              <div className="min-w-0">
                <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{payable.number} · {dateTime(payable.date)}</p>
                <p className="mt-1 font-serif text-xl">{payable.name}</p>
                <p className="mt-1 text-sm text-muted">{payable.concept} · {PAYABLE_LABEL[payable.kind]}</p>
              </div>
              <div className="text-right">
                <p className="font-serif text-xl tabular-nums">{money(payable.balance)}</p>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Badge tone={payable.balance === 0 ? 'ok' : 'warn'}>{payable.balance === 0 ? 'Pagada' : `Abonado ${money(payable.paid)}`}</Badge>
                  {payable.balance > 0 ? (
                    <Button onClick={() => { setPaying(payable.id); setAmount(payable.balance); setError(''); setAccount('efectivo') }}>Pagar</Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} kicker="Obligación" title="Nueva deuda" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Field label="Proveedor">
            <select className={inputClass} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">Escribir el nombre</option>
              {state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </Field>
          {supplierId ? null : (
            <Field label="A quién se le debe">
              <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
          )}
          <Field label="Concepto">
            <input className={inputClass} value={concept} placeholder="Luz, local, sueldo" onChange={(event) => setConcept(event.target.value)} />
          </Field>
          <Field label="Tipo">
            <div className="grid grid-cols-3 gap-2">
              {kinds.map((item) => (
                <button key={item} type="button" className={`rounded-xl border px-2 py-2 text-sm ${kind === item ? 'border-ink bg-ink text-paper' : 'border-line'}`} onClick={() => setKind(item)}>
                  {PAYABLE_LABEL[item]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Valor" hint="Entra a la ganancia neta cuando es sueldo, servicio u otro. La mercancía nace desde Compras.">
            <input className={inputClass} inputMode="numeric" value={total ? new Intl.NumberFormat('es-CO').format(total) : ''} placeholder="0" onChange={(event) => setTotal(Number(event.target.value.replace(/\D/g, '')) || 0)} />
          </Field>
          <Field label="Nota">
            <input className={inputClass} value={note} placeholder="Opcional" onChange={(event) => setNote(event.target.value)} />
          </Field>
          <FormError>{error}</FormError>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create}>Guardar deuda</Button>
          </div>
        </div>
      </Modal>

      <Modal open={current != null} kicker={current?.number ?? ''} title="Pagar obligación" onClose={() => setPaying(null)}>
        {current ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">{current.name} · saldo {money(current.balance)}</p>
            <Field label="Valor">
              <input className={inputClass} inputMode="numeric" value={amount ? new Intl.NumberFormat('es-CO').format(amount) : ''} onChange={(event) => setAmount(Number(event.target.value.replace(/\D/g, '')) || 0)} />
            </Field>
            <Field label="Sale de">
              <select className={inputClass} value={account} onChange={(event) => setAccount(event.target.value as CashAccount)}>
                {ACCOUNTS.map((item) => <option key={item} value={item}>{ACCOUNT_LABEL[item]}</option>)}
              </select>
            </Field>
            <FormError>{error}</FormError>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPaying(null)}>Cancelar</Button>
              <Button onClick={pay}>Registrar pago</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
