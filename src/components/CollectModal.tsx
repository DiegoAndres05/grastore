import { useEffect, useRef, useState } from 'react'
import { ACCOUNT_LABEL, ACCOUNTS } from '../lib/books'
import { money } from '../lib/format'
import type { CashAccount } from '../types'
import { useStore } from '../store'
import { Button, Field, FormError, Modal, MoneyInput, inputClass } from './ui'

export function CollectModal({
  open,
  onClose,
  customerId,
  saleId,
}: {
  open: boolean
  onClose: () => void
  customerId?: string
  saleId?: string
}) {
  const { state, collect, toast } = useStore()
  const lock = useRef(false)
  const [chosen, setChosen] = useState(customerId ?? '')
  const [amount, setAmount] = useState(0)
  const [account, setAccount] = useState<CashAccount>('efectivo')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    lock.current = false
    const sale = saleId ? state.sales.find((item) => item.id === saleId) : undefined
    const id = customerId ?? sale?.customerId ?? ''
    const customer = state.customers.find((item) => item.id === id)
    setChosen(id)
    setAmount(sale?.balance ?? customer?.balance ?? 0)
    setAccount('efectivo')
    setNote('')
    setError('')
  }, [open, customerId, saleId, state.sales, state.customers])

  const debtors = state.customers.filter((customer) => customer.balance > 0 || customer.id === chosen)
  const customer = state.customers.find((item) => item.id === chosen)

  function submit() {
    if (lock.current) return
    lock.current = true
    const result = collect({ customerId: chosen, amount, account, note, saleId })
    if (!result.ok) {
      lock.current = false
      setError(result.error)
      return
    }
    toast(`Abono de ${money(result.data.amount)} registrado`)
    onClose()
  }

  return (
    <Modal open={open} kicker="Cartera" title="Registrar abono" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Cliente">
          <select className={inputClass} value={chosen} onChange={(event) => {
            const id = event.target.value
            setChosen(id)
            const next = state.customers.find((item) => item.id === id)
            setAmount(next?.balance ?? 0)
          }}>
            <option value="">Elegir cliente</option>
            {debtors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {money(item.balance)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor" hint={customer ? `Saldo ${money(customer.balance)} · cupo ${money(customer.creditLimit)}` : undefined}>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Entra a">
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNTS.map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-xl border px-3 py-2 text-sm ${account === item ? 'border-ink bg-ink text-paper' : 'border-line bg-paper'}`}
                onClick={() => setAccount(item)}
              >
                {ACCOUNT_LABEL[item]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Nota">
          <input className={inputClass} value={note} placeholder="Opcional" onChange={(event) => setNote(event.target.value)} />
        </Field>
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Guardar abono</Button>
        </div>
      </div>
    </Modal>
  )
}
