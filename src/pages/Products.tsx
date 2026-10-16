import { useMemo, useState } from 'react'
import { Badge, Button, Empty, Field, FormError, Modal, MoneyInput, PageHeader, SearchBox, inputClass, tdClass, thClass } from '../components/ui'
import { nextSku, norm, swatch } from '../lib/catalog'
import { inventoryRows, saveCsv, saveXlsx } from '../lib/exportSheet'
import { money, percent, todayInput } from '../lib/format'
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
  const { state, saveProduct, setProductActive, addCategory, addColor, adjust, toast, can } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const [archived, setArchived] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<ProductInput>(blank(''))
  const [error, setError] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [colorName, setColorName] = useState('')
  const [adjustId, setAdjustId] = useState('')
  const [delta, setDelta] = useState(0)
  const [reason, setReason] = useState('')
  const [adjustDate, setAdjustDate] = useState(todayInput())

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
    setForm({ ...blank(nextSku(state.products.map((product) => product.sku))), category: state.settings.categories[0] ?? 'General' })
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
      location: product.location ?? '',
      brand: product.brand ?? '',
      design: product.design ?? '',
    })
    setError('')
    setOpen(true)
  }

  async function save() {
    const result = await saveProduct(form, editing ?? undefined)
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
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => saveXlsx('inventario.xlsx', [{ name: 'Inventario', rows: inventoryRows(state) }])}>Excel</Button>
            <Button variant="ghost" onClick={() => saveCsv('inventario.csv', inventoryRows(state))}>CSV</Button>
            {can('products.write') ? <Button onClick={startCreate}>Nueva prenda</Button> : null}
          </div>
        }
      />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:w-80"><SearchBox value={query} onChange={setQuery} placeholder="Nombre, SKU o color" /></div>
        <div className="scroll-clean flex min-w-0 gap-2 overflow-x-auto">
          {['Todas', ...state.settings.categories].map((item) => (
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
                    <p className="mt-1 text-xs text-muted">{product.stock} und{can('products.costs') ? ` · margen ${percent(margin)}` : ''}</p>
                  </div>
                  {can('products.write') ? <div className="flex gap-3">
                    <button type="button" className="text-sm text-brass-deep" onClick={() => startEdit(product)}>Editar</button>
                    <button
                      type="button"
                      className="text-sm text-muted"
                      onClick={() => {
                        void setProductActive(product.id, !product.active).then((result) => {
                          if (!result.ok) toast(result.error, 'warn')
                          else toast(product.active ? 'Prenda archivada' : 'Prenda de vuelta en el piso')
                        })
                      }}
                    >
                      {product.active ? 'Archivar' : 'Activar'}
                    </button>
                  </div> : null}
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
                {can('products.costs') ? <th className={`${thClass} text-right`}>Margen</th> : null}
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
                    {can('products.costs') ? <td className={`${tdClass} text-right tabular-nums`}>{percent(margin)}</td> : null}
                    <td className={`${tdClass} text-right`}>
                      {can('products.write') ? (
                        <>
                      <button type="button" className="text-sm text-brass-deep" onClick={() => startEdit(product)}>Editar</button>
                      <button
                        type="button"
                        className="ml-3 text-sm text-muted"
                        onClick={() => {
                          void setProductActive(product.id, !product.active).then((result) => {
                            if (!result.ok) toast(result.error, 'warn')
                            else toast(product.active ? 'Prenda archivada' : 'Prenda de vuelta en el piso')
                          })
                        }}
                      >
                        {product.active ? 'Archivar' : 'Activar'}
                      </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {can('inventory.adjust') ? <section className="mt-8 rounded-3xl border border-line p-5">
        <h2 className="font-serif text-2xl">Ajuste de inventario</h2>
        <p className="mt-2 text-sm text-muted">Suma o resta unidades y deja el motivo. No cambia el costo.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_160px_1fr_auto]">
          <select className={inputClass} value={adjustId} onChange={(event) => setAdjustId(event.target.value)}>
            <option value="">Prenda</option>
            {state.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.color} · {product.size}</option>)}
          </select>
          <input className={inputClass} inputMode="numeric" placeholder="+/-" value={delta || ''} onChange={(event) => setDelta(Number(event.target.value.replace(/[^\d-]/g, '')) || 0)} />
          <input className={inputClass} type="date" value={adjustDate} onChange={(event) => setAdjustDate(event.target.value)} />
          <input className={inputClass} placeholder="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button variant="ghost" onClick={() => {
            void adjust({ productId: adjustId, qtyDelta: delta, reason, date: adjustDate }).then((result) => {
              if (!result.ok) toast(result.error, 'warn')
              else { toast('Ajuste registrado'); setDelta(0); setReason('') }
            })
          }}>Ajustar</Button>
        </div>
      </section> : null}

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
              {state.settings.categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Color">
            <input className={inputClass} list="gra-colors" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
            <datalist id="gra-colors">{state.settings.colors.map((color) => <option key={color} value={color} />)}</datalist>
          </Field>
          <Field label="Talla">
            <input className={inputClass} value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} />
          </Field>
          <Field label="Stock mínimo">
            <input className={inputClass} inputMode="numeric" value={form.minStock} onChange={(event) => setForm({ ...form, minStock: Number(event.target.value.replace(/\D/g, '')) || 0 })} />
          </Field>
          {can('products.costs') ? <Field label="Costo">
            <MoneyInput value={form.cost} onChange={(cost) => setForm({ ...form, cost })} />
          </Field> : null}
          <Field label="Precio de venta" hint={belowCost ? 'Se vende por debajo del costo.' : undefined}>
            <MoneyInput value={form.price} onChange={(price) => setForm({ ...form, price })} />
          </Field>
          <Field label="Ubicación">
            <input className={inputClass} value={form.location ?? ''} placeholder="Arriba, abajo, bodega" onChange={(event) => setForm({ ...form, location: event.target.value })} />
          </Field>
          <Field label="Existencias">
            <input className={inputClass} inputMode="numeric" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value.replace(/\D/g, '')) || 0 })} />
          </Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nueva categoría">
            <div className="flex gap-2">
              <input className={inputClass} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
              <Button variant="ghost" onClick={() => { void addCategory(categoryName).then((result) => { if (!result.ok) setError(result.error); else { setCategoryName(''); setForm({ ...form, category: categoryName.trim() }) } }) }}>Agregar</Button>
            </div>
          </Field>
          <Field label="Nuevo color">
            <div className="flex gap-2">
              <input className={inputClass} value={colorName} onChange={(event) => setColorName(event.target.value)} />
              <Button variant="ghost" onClick={() => { void addColor(colorName).then((result) => { if (!result.ok) setError(result.error); else { setColorName(''); setForm({ ...form, color: colorName.trim() }) } }) }}>Agregar</Button>
            </div>
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">Para una entrada formal de mercancía, regístrala en Compras: ahí el costo se promedia y el stock sube solo.</p>
        <FormError>{error}</FormError>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Guardar</Button>
        </div>
      </Modal>
    </div>
  )
}
