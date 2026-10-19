import { useMemo, useState } from 'react'
import { CollectModal } from '../components/CollectModal'
import { Button, Empty, Field, FormError, Modal, PageHeader, SearchBox, inputClass, tdClass, thClass } from '../components/ui'
import { norm } from '../lib/catalog'
import { money } from '../lib/format'
import type { CustomerInput } from '../lib/logic'
import { reminderLink } from '../lib/whatsapp'
import { useStore } from '../store'
import type { Customer } from '../types'

const blank: CustomerInput = { name: '', phone: '', email: '', city: '' }

export function Customers() {
  const { state, saveCustomer, removeCustomer, toast } = useStore()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<CustomerInput>(blank)
  const [error, setError] = useState('')
  const [collectId, setCollectId] = useState<string | undefined>()
  const [collectOpen, setCollectOpen] = useState(false)
  const [remindOpen, setRemindOpen] = useState(false)
  const [reminded, setReminded] = useState<string[]>([])

  const debtors = useMemo(
    () => state.customers.filter((customer) => customer.balance > 0).sort((a, b) => b.balance - a.balance),
    [state.customers],
  )

  const rows = useMemo(() => {
    const needle = norm(query)
    return state.customers
      .filter((customer) => !needle || norm(`${customer.name} ${customer.phone} ${customer.city} ${customer.email}`).includes(needle))
      .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
  }, [state.customers, query])

  function startCreate() {
    setEditing(null)
    setForm(blank)
    setError('')
    setOpen(true)
  }

  function startEdit(customer: Customer) {
    setEditing(customer.id)
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      city: customer.city,
    })
    setError('')
    setOpen(true)
  }

  async function save() {
    const result = await saveCustomer(form, editing ?? undefined)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast(editing ? 'Cliente actualizado' : 'Cliente creado')
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        kicker="Casa"
        title="Clientes"
        text="Lo que se fía en el ticket se suma solo a la deuda del cliente y baja con cada abono."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => { setReminded([]); setRemindOpen(true) }}>Recordar por WhatsApp</Button>
            <Button onClick={startCreate}>Nuevo cliente</Button>
          </div>
        }
      />
      <div className="mb-5 max-w-sm">
        <SearchBox value={query} onChange={setQuery} placeholder="Nombre, ciudad o teléfono" />
      </div>
      {rows.length === 0 ? (
        <Empty title="Sin clientes" text="Agrega a quien compra seguido o maneja crédito." />
      ) : (
        <>
        <ul className="space-y-3 md:hidden">
          {rows.map((customer) => {
            return (
              <li key={customer.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{customer.name}</p>
                    <p className="mt-1 text-xs text-muted">{customer.city || 'Sin ciudad'} · {customer.phone || 'Sin teléfono'}</p>
                  </div>
                  <p className={`shrink-0 text-sm tabular-nums ${customer.balance > 0 ? 'text-warn' : ''}`}>{money(customer.balance)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {customer.balance > 0 ? (
                    <button type="button" className="text-sm text-brass-deep" onClick={() => { setCollectId(customer.id); setCollectOpen(true) }}>
                      Abonar
                    </button>
                  ) : null}
                  <button type="button" className="text-sm text-brass-deep" onClick={() => startEdit(customer)}>Editar</button>
                  <button
                    type="button"
                    className="text-sm text-muted"
                    onClick={() => {
                      void removeCustomer(customer.id).then((result) => {
                        if (!result.ok) toast(result.error, 'warn')
                        else toast('Cliente eliminado')
                      })
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Cliente</th>
                <th className={thClass}>Contacto</th>
                <th className={`${thClass} text-right`}>Debe</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => {
                return (
                  <tr key={customer.id}>
                    <td className={tdClass}>
                      <p>{customer.name}</p>
                      <p className="text-xs text-muted">{customer.city || 'Sin ciudad'}</p>
                    </td>
                    <td className={tdClass}>
                      <p>{customer.phone || '—'}</p>
                      <p className="text-xs text-muted">{customer.email || 'Sin correo'}</p>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums ${customer.balance > 0 ? 'text-warn' : ''}`}>{money(customer.balance)}</td>
                    <td className={`${tdClass} text-right`}>
                      {customer.balance > 0 ? (
                        <button type="button" className="text-sm text-brass-deep" onClick={() => { setCollectId(customer.id); setCollectOpen(true) }}>
                          Abonar
                        </button>
                      ) : null}
                      <button type="button" className="ml-3 text-sm text-brass-deep" onClick={() => startEdit(customer)}>Editar</button>
                      <button
                        type="button"
                        className="ml-3 text-sm text-muted"
                        onClick={() => {
                          void removeCustomer(customer.id).then((result) => {
                            if (!result.ok) toast(result.error, 'warn')
                            else toast('Cliente eliminado')
                          })
                        }}
                      >
                        Eliminar
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

      <Modal open={open} kicker="Clientes" title={editing ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Ciudad">
            <input className={inputClass} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
          </Field>
          <Field label="Teléfono">
            <input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="Correo">
            <input className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
        </div>
        <FormError>{error}</FormError>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Guardar</Button>
        </div>
      </Modal>
      <Modal open={remindOpen} kicker="Clientes" title="Recordar por WhatsApp" onClose={() => setRemindOpen(false)}>
        {debtors.length === 0 ? (
          <p className="text-sm text-muted">Nadie debe en este momento.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              {debtors.length} {debtors.length === 1 ? 'cliente debe' : 'clientes deben'} {money(debtors.reduce((sum, customer) => sum + customer.balance, 0))}. Cada botón abre WhatsApp con el mensaje y su deuda.
            </p>
            <ul className="mt-4 divide-y divide-line">
              {debtors.map((customer) => {
                const link = reminderLink(customer.phone, customer.balance)
                const sent = reminded.includes(customer.id)
                return (
                  <li key={customer.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate">{customer.name}</p>
                      <p className="text-xs text-muted tabular-nums">
                        {money(customer.balance)} · {customer.phone || 'Sin teléfono'}
                      </p>
                    </div>
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setReminded((list) => (list.includes(customer.id) ? list : [...list, customer.id]))}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm ${sent ? 'border border-line text-muted' : 'bg-brass font-semibold text-espresso'}`}
                      >
                        {sent ? 'Enviado' : 'Enviar'}
                      </a>
                    ) : (
                      <button type="button" className="shrink-0 text-sm text-brass-deep" onClick={() => { setRemindOpen(false); startEdit(customer) }}>
                        Poner teléfono
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Modal>
      <CollectModal open={collectOpen} customerId={collectId} onClose={() => setCollectOpen(false)} />
    </div>
  )
}
