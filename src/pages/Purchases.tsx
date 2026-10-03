import { useRef, useState } from 'react'
import { Button, Empty, Field, FormError, Modal, PageHeader, inputClass } from '../components/ui'
import { CATEGORIES } from '../lib/catalog'
import { dateTime, money } from '../lib/format'
import { useStore } from '../store'

type DraftLine = { key: string; productId: string; qty: number; cost: number }

function emptyLine(): DraftLine {
  return { key: crypto.randomUUID(), productId: '', qty: 1, cost: 0 }
}

export function Purchases() {
  const { state, purchase, toast } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [error, setError] = useState('')
  const lock = useRef(false)

  function start() {
    lock.current = false
    setSupplierId(state.suppliers[0]?.id ?? '')
    setNote('')
    setLines([emptyLine()])
    setError('')
    setOpen(true)
  }

  function chooseProduct(key: string, productId: string) {
    const product = state.products.find((item) => item.id === productId)
    setLines((current) => current.map((line) => (line.key === key ? { ...line, productId, cost: product?.cost ?? line.cost } : line)))
  }

  const total = lines.reduce((sum, line) => sum + line.qty * line.cost, 0)

  function save() {
    if (lock.current) return
    lock.current = true
    const result = purchase({
      supplierId,
      note,
      lines: lines.filter((line) => line.productId).map((line) => ({ productId: line.productId, qty: line.qty, cost: line.cost })),
    })
    if (!result.ok) {
      lock.current = false
      setError(result.error)
      return
    }
    toast(`${result.data.number} recibida. El inventario ya quedó actualizado.`)
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        kicker="Entrada de mercancía"
        title="Compras"
        text="Al recibir un pedido sube el stock y el costo de la prenda se promedia con lo que ya había."
        action={<Button onClick={start}>Registrar compra</Button>}
      />
      {state.purchases.length === 0 ? (
        <Empty title="Sin compras" text="La primera entrada de mercancía aparece aquí." />
      ) : (
        <div>
          {state.purchases.map((item) => {
            const expanded = openId === item.id
            const units = item.lines.reduce((sum, line) => sum + line.qty, 0)
            return (
              <article key={item.id} className="border-t border-line py-5">
                <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenId(expanded ? null : item.id)}>
                  <div className="min-w-0">
                    <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{item.number} · {dateTime(item.date)}</p>
                    <p className="mt-1 font-serif text-xl">{item.supplierName}</p>
                    <p className="mt-1 text-sm text-muted">{units} unidades{item.note ? ` · ${item.note}` : ''}</p>
                  </div>
                  <p className="shrink-0 font-serif text-xl tabular-nums">{money(item.total)}</p>
                </button>
                {expanded ? (
                  <ul className="mt-4 space-y-2">
                    {item.lines.map((line) => (
                      <li key={`${item.id}-${line.productId}-${line.size}`} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0">{line.qty} × {line.name} · {line.color} · {line.size}</span>
                        <span className="shrink-0 tabular-nums">{money(line.qty * line.cost)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      <Modal open={open} kicker="Mercancía" title="Registrar compra" wide onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Field label="Proveedor">
            <select className={inputClass} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">Elegir proveedor</option>
              {state.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </Field>
          {lines.map((line, index) => {
            const product = state.products.find((item) => item.id === line.productId)
            return (
              <div key={line.key} className="grid gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_88px_140px_auto]">
                <label className="block">
                  <span className="mb-2 block text-[11px] tracking-[0.16em] text-muted uppercase">Prenda</span>
                  <select className={inputClass} value={line.productId} onChange={(event) => chooseProduct(line.key, event.target.value)}>
                    <option value="">Elegir</option>
                    {CATEGORIES.map((category) => (
                      <optgroup key={category} label={category}>
                        {state.products.filter((item) => item.active && item.category === category).map((item) => (
                          <option key={item.id} value={item.id}>{item.name} · {item.color} · {item.size}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] tracking-[0.16em] text-muted uppercase">Cant.</span>
                  <input className={inputClass} inputMode="numeric" value={line.qty} onChange={(event) => {
                    const qty = Number(event.target.value.replace(/\D/g, '')) || 0
                    setLines((current) => current.map((item) => (item.key === line.key ? { ...item, qty } : item)))
                  }} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] tracking-[0.16em] text-muted uppercase">Costo</span>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={new Intl.NumberFormat('es-CO').format(line.cost)}
                    onChange={(event) => {
                      const cost = Number(event.target.value.replace(/\D/g, '')) || 0
                      setLines((current) => current.map((item) => (item.key === line.key ? { ...item, cost } : item)))
                    }}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="mb-2 text-sm text-muted"
                    onClick={() => setLines((current) => current.length === 1 ? current : current.filter((item) => item.key !== line.key))}
                  >
                    Quitar
                  </button>
                </div>
                {product ? <p className="text-xs text-muted sm:col-span-4">Quedará en {product.stock + line.qty} und · línea {index + 1}</p> : null}
              </div>
            )
          })}
          <button type="button" className="text-sm text-brass-deep" onClick={() => setLines((current) => [...current, emptyLine()])}>
            Agregar prenda
          </button>
          <Field label="Nota">
            <input className={inputClass} value={note} placeholder="Pedido, guía o temporada" onChange={(event) => setNote(event.target.value)} />
          </Field>
          <div className="flex items-end justify-between">
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Total de la compra</p>
            <p className="font-serif text-3xl tabular-nums">{money(total)}</p>
          </div>
          <FormError>{error}</FormError>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Recibir mercancía</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
