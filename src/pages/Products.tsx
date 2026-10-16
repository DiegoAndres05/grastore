import { useMemo, useState } from 'react'
import { Badge, Button, Empty, Field, FormError, Modal, MoneyInput, PageHeader, SearchBox, inputClass, tdClass, thClass } from '../components/ui'
import { CATEGORIES, COLORS, nextSku, norm, swatch } from '../lib/catalog'
import { money, percent } from '../lib/format'
import type { ProductInput } from '../lib/logic'
import { useStore } from '../store'
import type { Product } from '../types'

const blank = (sku: string): ProductInput => ({
  sku,
  name: '',
  category: 'Camisetas',
  color: 'Negro',
  size: 'M',
  cost: 0,
  price: 0,
  stock: 0,
  minStock: 2,
})

export function Products() {
  const { state, saveProduct, setProductActive, toast } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const [archived, setArchived] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<ProductInput>(blank(''))
  const [error, setError] = useState('')

  const rows = useMemo(() => {
    const needle = norm(query)
    return state.products
      .filter((product) => product.active !== archived)
      .filter((product) => category === 'Todas' || product.category === category)
      .filter((product) => !needle || norm(`${product.name} ${product.sku} ${product.color} ${product.size}`).includes(needle))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  }, [state.products, query, category, archived])

  function startCreate() {
    setEditing(null)
    setForm(blank(nextSku(state.products.map((product) => product.sku))))
    setError('')
    setOpen(true)
  }

  function startEdit(product: Product) {
    setEditing(product.id)
    setForm({
      sku: product.sku,
      name: product.name,
      category: product.category,
      color: product.color,
      size: product.size,
      cost: product.cost,
      price: product.price,
      stock: product.stock,
      minStock: product.minStock,
    })
    setError('')
    setOpen(true)
  }

  function save() {
    const result = saveProduct(form, editing ?? undefined)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast(editing ? 'Prenda actualizada' : 'Prenda publicada en el piso')
    setOpen(false)
  }

  const belowCost = form.price > 0 && form.cost > form.price

  return (
    <div>
      <PageHeader
        kicker="Catálogo"
        title="Prendas"
        text="Talla, color, costo y precio viven en la misma ficha. El stock baja con cada venta."
        action={<Button onClick={startCreate}>Nueva prenda</Button>}
      />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:w-80"><SearchBox value={query} onChange={setQuery} placeholder="Nombre, SKU o color" /></div>
        <div className="scroll-clean flex min-w-0 gap-2 overflow-x-auto">
          {['Todas', ...CATEGORIES].map((item) => (
            <button key={item} type="button" className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${category === item ? 'bg-ink text-paper' : 'border border-line bg-card text-muted'}`} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
        <button type="button" className="text-sm text-muted lg:ml-auto" onClick={() => setArchived((value) => !value)}>
          {archived ? 'Ver en piso' : 'Ver archivadas'}
        </button>
      </div>
      {rows.length === 0 ? (
        <Empty title={archived ? 'Sin archivadas' : 'Sin prendas'} text="Crea la primera ficha o cambia el filtro." />
      ) : (
        <>
        <ul className="space-y-3 md:hidden">
          {rows.map((product) => {
            const margin = product.price > 0 ? (product.price - product.cost) / product.price : 0
            return (
              <li key={product.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-7 w-7 shrink-0 rounded-full border border-line" style={{ background: swatch(product.color) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{product.name}</p>
                    <p className="mt-1 text-xs text-muted">{product.category} · {product.color} · {product.size}</p>
                    <p className="mt-1 text-xs text-muted">{product.sku}</p>
                  </div>
                  {product.active && product.stock <= product.minStock ? <Badge tone={product.stock === 0 ? 'danger' : 'warn'}>{product.stock === 0 ? 'Agotada' : 'Bajo'}</Badge> : null}
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm tabular-nums">{money(product.price)}</p>
                    <p className="mt-1 text-xs text-muted">{product.stock} und · margen {percent(margin)}</p>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" className="text-sm text-brass-deep" onClick={() => startEdit(product)}>Editar</button>
                    <button
                      type="button"
                      className="text-sm text-muted"
                      onClick={() => {
                        setProductActive(product.id, !product.active)
                        toast(product.active ? 'Prenda archivada' : 'Prenda de vuelta en el piso')
                      }}
                    >
                      {product.active ? 'Archivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Prenda</th>
                <th className={thClass}>SKU</th>
                <th className={`${thClass} text-right`}>Stock</th>
                <th className={`${thClass} text-right`}>Precio</th>
                <th className={`${thClass} text-right`}>Margen</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const margin = product.price > 0 ? (product.price - product.cost) / product.price : 0
                return (
                  <tr key={product.id}>
                    <td className={tdClass}>
                      <div className="flex items-center gap-3">
                        <span className="h-7 w-7 rounded-full border border-line" style={{ background: swatch(product.color) }} />
                        <div>
                          <p>{product.name}</p>
                          <p className="text-xs text-muted">{product.category} · {product.color} · {product.size}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${tdClass} text-muted`}>{product.sku}</td>
                    <td className={`${tdClass} text-right`}>
                      <span className="tabular-nums">{product.stock}</span>
                      {product.active && product.stock <= product.minStock ? <span className="mt-1 block"><Badge tone={product.stock === 0 ? 'danger' : 'warn'}>{product.stock === 0 ? 'Agotada' : 'Bajo'}</Badge></span> : null}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{money(product.price)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{percent(margin)}</td>
                    <td className={`${tdClass} text-right`}>
                      <button type="button" className="text-sm text-brass-deep" onClick={() => startEdit(product)}>Editar</button>
                      <button
                        type="button"
                        className="ml-3 text-sm text-muted"
                        onClick={() => {
                          setProductActive(product.id, !product.active)
                          toast(product.active ? 'Prenda archivada' : 'Prenda de vuelta en el piso')
                        }}
                      >
                        {product.active ? 'Archivar' : 'Activar'}
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

      <Modal open={open} kicker="Catálogo" title={editing ? 'Editar prenda' : 'Nueva prenda'} onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="SKU">
            <input className={inputClass} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
          </Field>
          <Field label="Categoría">
            <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Color">
            <input className={inputClass} list="gra-colors" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
            <datalist id="gra-colors">{COLORS.map((color) => <option key={color} value={color} />)}</datalist>
          </Field>
          <Field label="Talla">
            <input className={inputClass} value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} />
          </Field>
          <Field label="Stock mínimo">
            <input className={inputClass} inputMode="numeric" value={form.minStock} onChange={(event) => setForm({ ...form, minStock: Number(event.target.value.replace(/\D/g, '')) || 0 })} />
          </Field>
          <Field label="Costo">
            {editing ? <input className={inputClass} value={new Intl.NumberFormat('es-CO').format(form.cost)} readOnly /> : <MoneyInput value={form.cost} onChange={(cost) => setForm({ ...form, cost })} />}
          </Field>
          <Field label="Precio de venta" hint={belowCost ? 'Se vende por debajo del costo.' : undefined}>
            <MoneyInput value={form.price} onChange={(price) => setForm({ ...form, price })} />
          </Field>
          <Field label="Existencias">
            <input className={inputClass} inputMode="numeric" readOnly={editing != null} value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value.replace(/\D/g, '')) || 0 })} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">{editing ? 'El precio sí se puede ajustar. Las unidades entran por Compras y salen por Ventas.' : 'Las existencias iniciales quedan como apertura de inventario. Las siguientes entradas van por Compras.'}</p>
        <FormError>{error}</FormError>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Guardar</Button>
        </div>
      </Modal>
    </div>
  )
}
