import { useState } from 'react'
import { Button, Empty, Field, FormError, Modal, PageHeader, inputClass, tdClass, thClass } from '../components/ui'
import { money } from '../lib/format'
import type { SupplierInput } from '../lib/logic'
import { useStore } from '../store'
import type { Supplier } from '../types'

const blank: SupplierInput = { name: '', contact: '', phone: '', city: '', specialty: '' }

export function Suppliers() {
  const { state, saveSupplier, removeSupplier, toast } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<SupplierInput>(blank)
  const [error, setError] = useState('')

  function startCreate() {
    setEditing(null)
    setForm(blank)
    setError('')
    setOpen(true)
  }

  function startEdit(supplier: Supplier) {
    setEditing(supplier.id)
    setForm({
      name: supplier.name,
      contact: supplier.contact,
      phone: supplier.phone,
      city: supplier.city,
      specialty: supplier.specialty,
    })
    setError('')
    setOpen(true)
  }

  function save() {
    const result = saveSupplier(form, editing ?? undefined)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast(editing ? 'Proveedor actualizado' : 'Proveedor creado')
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        kicker="Taller y tela"
        title="Proveedores"
        text="De aquí salen las compras. El historial de cada pedido conserva el nombre aunque el proveedor cambie."
        action={<Button onClick={startCreate}>Nuevo proveedor</Button>}
      />
      {state.suppliers.length === 0 ? (
        <Empty title="Sin proveedores" text="Agrega el taller o la tela de la que compras." />
      ) : (
        <>
        <ul className="space-y-3 md:hidden">
          {state.suppliers.map((supplier) => {
            const orders = state.purchases.filter((purchase) => purchase.supplierId === supplier.id)
            const total = orders.reduce((sum, purchase) => sum + purchase.total, 0)
            return (
              <li key={supplier.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{supplier.name}</p>
                    <p className="mt-1 text-xs text-muted">{supplier.city || 'Sin ciudad'} · {supplier.specialty || 'Sin especialidad'}</p>
                    <p className="mt-1 text-xs text-muted">{supplier.contact || 'Sin contacto'} · {supplier.phone || 'Sin teléfono'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm tabular-nums">{money(total)}</p>
                    <p className="mt-1 text-xs text-muted">{orders.length} {orders.length === 1 ? 'compra' : 'compras'}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-3">
                  <button type="button" className="text-sm text-brass-deep" onClick={() => startEdit(supplier)}>Editar</button>
                  <button
                    type="button"
                    className="text-sm text-muted"
                    onClick={() => {
                      const result = removeSupplier(supplier.id)
                      if (!result.ok) toast(result.error, 'warn')
                      else toast('Proveedor eliminado')
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
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Proveedor</th>
                <th className={thClass}>Contacto</th>
                <th className={thClass}>Especialidad</th>
                <th className={`${thClass} text-right`}>Comprado</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {state.suppliers.map((supplier) => {
                const orders = state.purchases.filter((purchase) => purchase.supplierId === supplier.id)
                const total = orders.reduce((sum, purchase) => sum + purchase.total, 0)
                return (
                  <tr key={supplier.id}>
                    <td className={tdClass}>
                      <p>{supplier.name}</p>
                      <p className="text-xs text-muted">{supplier.city || 'Sin ciudad'}</p>
                    </td>
                    <td className={tdClass}>
                      <p>{supplier.contact || '—'}</p>
                      <p className="text-xs text-muted">{supplier.phone || 'Sin teléfono'}</p>
                    </td>
                    <td className={tdClass}>{supplier.specialty || '—'}</td>
                    <td className={`${tdClass} text-right`}>
                      <p className="tabular-nums">{money(total)}</p>
                      <p className="text-xs text-muted">{orders.length} {orders.length === 1 ? 'compra' : 'compras'}</p>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <button type="button" className="text-sm text-brass-deep" onClick={() => startEdit(supplier)}>Editar</button>
                      <button
                        type="button"
                        className="ml-3 text-sm text-muted"
                        onClick={() => {
                          const result = removeSupplier(supplier.id)
                          if (!result.ok) toast(result.error, 'warn')
                          else toast('Proveedor eliminado')
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

      <Modal open={open} kicker="Proveedores" title={editing ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Contacto">
            <input className={inputClass} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
          </Field>
          <Field label="Teléfono">
            <input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="Ciudad">
            <input className={inputClass} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Especialidad">
              <input className={inputClass} value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} />
            </Field>
          </div>
        </div>
        <FormError>{error}</FormError>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Guardar</Button>
        </div>
      </Modal>
    </div>
  )
}
