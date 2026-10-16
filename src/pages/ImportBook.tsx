import { useMemo, useState } from 'react'
import { Button, Field, PageHeader, inputClass } from '../components/ui'
import { balanceSheet } from '../lib/accounting'
import { money } from '../lib/format'
import { defaultDecisions, importBook, parseWorkbook, type ImportDecisions, type ReceivableKind, type WorkbookPreview } from '../lib/importWorkbook'
import { bookHasRealData } from '../lib/book'
import { useStore } from '../store'

const steps = ['Archivo', 'Inventario', 'Clientes', 'Dinero', 'Confirmar']

export function ImportBook() {
  const { state, replaceBook, actor } = useStore()
  const [step, setStep] = useState(0)
  const [preview, setPreview] = useState<WorkbookPreview | null>(null)
  const [decisions, setDecisions] = useState<ImportDecisions | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState(false)

  const built = useMemo(() => (preview && decisions ? importBook(preview, decisions, actor) : null), [preview, decisions, actor])
  const sheet = built ? balanceSheet(built) : null

  async function onFile(file: File) {
    setError('')
    try {
      const parsed = parseWorkbook(await file.arrayBuffer())
      setPreview(parsed)
      setDecisions(defaultDecisions(parsed))
      setStep(1)
    } catch {
      setError('No se pudo leer ese archivo. Usa el libro .xlsx de la tienda.')
    }
  }

  function updateProduct(key: string, patch: Partial<ImportDecisions['products'][number]>) {
    setDecisions((current) => current && { ...current, products: current.products.map((item) => (item.key === key ? { ...item, ...patch } : item)) })
  }

  function commit() {
    if (!built) return
    if (bookHasRealData(state) && !confirming) {
      setConfirming(true)
      return
    }
    replaceBook(built)
    setConfirming(false)
  }

  const visible = preview && decisions
    ? preview.products.filter((product) => {
        const needle = query.trim().toLowerCase()
        if (!needle) return true
        return `${product.sku} ${product.name} ${product.sourceColor} ${product.category}`.toLowerCase().includes(needle)
      })
    : []

  return (
    <div>
      <PageHeader kicker="Excel" title="Importar el libro" text="Trae el inventario sin vender, los clientes, la cartera, las deudas, los saldos de Nequi, efectivo y Bancolombia, y el histórico de ventas si lo quieres." />
      <div className="mb-6 flex flex-wrap gap-2">
        {steps.map((label, index) => (
          <button key={label} type="button" className={`rounded-full px-3 py-1.5 text-sm ${step === index ? 'bg-ink text-paper' : 'border border-line text-muted'}`} onClick={() => preview && setStep(index)} disabled={!preview && index > 0}>
            {index + 1}. {label}
          </button>
        ))}
      </div>
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {step === 0 ? (
        <label className="block rounded-3xl border border-dashed border-line px-6 py-16 text-center">
          <p className="font-serif text-2xl">Suelta el archivo .xlsx</p>
          <p className="mt-2 text-sm text-muted">Se lee en este navegador. No se sube a ningún servidor hasta que el libro compartido esté configurado, y aun así solo viaja el resultado, no el Excel.</p>
          <input className="mt-6 block w-full text-sm" type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onFile(file) }} />
        </label>
      ) : null}
      {step === 1 && preview && decisions ? (
        <div>
          <p className="mb-3 text-sm text-muted">{preview.products.length} fichas sin vender · {preview.products.reduce((sum, item) => sum + item.stock, 0)} unidades. Los códigos repetidos ya traen un sufijo; cámbialo si quieres otro.</p>
          {preview.warnings.map((warning) => <p key={warning} className="mb-2 text-sm text-warn">{warning}</p>)}
          <input className={`${inputClass} mb-4 max-w-md`} value={query} placeholder="Buscar prenda" onChange={(event) => setQuery(event.target.value)} />
          <div className="max-h-[32rem] overflow-auto rounded-2xl border border-line">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-[11px] tracking-[0.14em] text-muted uppercase">
                  <th className="p-2">SKU</th><th className="p-2">Nombre</th><th className="p-2">Tipo</th><th className="p-2">Color</th><th className="p-2">Talla</th><th className="p-2 text-right">Und</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => {
                  const decision = decisions.products.find((item) => item.key === product.key)
                  if (!decision) return null
                  return (
                    <tr key={product.key} className="border-t border-line">
                      <td className="p-2"><input className={inputClass} value={decision.sku} onChange={(event) => updateProduct(product.key, { sku: event.target.value })} /></td>
                      <td className="p-2"><input className={inputClass} value={decision.name} onChange={(event) => updateProduct(product.key, { name: event.target.value })} /></td>
                      <td className="p-2"><input className={inputClass} value={decision.category} onChange={(event) => updateProduct(product.key, { category: event.target.value })} /></td>
                      <td className="p-2">
                        <input className={inputClass} value={decision.color} onChange={(event) => updateProduct(product.key, { color: event.target.value })} />
                        {product.colorReview ? <span className="text-[11px] text-warn">En el Excel: {product.sourceColor || 'vacío'}</span> : null}
                      </td>
                      <td className="p-2">
                        <input className={inputClass} value={decision.size} onChange={(event) => updateProduct(product.key, { size: event.target.value })} />
                        {product.sizeReview ? <span className="text-[11px] text-warn">En el Excel: {product.sourceSize || 'vacío'}</span> : null}
                      </td>
                      <td className="p-2 text-right tabular-nums">{product.stock}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {step === 2 && preview && decisions ? (
        <div className="space-y-6">
          <section>
            <h2 className="font-serif text-2xl">Nombres parecidos</h2>
            {preview.merges.length === 0 ? <p className="mt-2 text-sm text-muted">No hay duplicados dudosos.</p> : null}
            <ul className="mt-3 space-y-2">
              {preview.merges.map((merge) => {
                const decision = decisions.merges.find((item) => item.id === merge.id)
                return (
                  <li key={merge.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
                    <span>{merge.from} → {merge.into}</span>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={decision?.accept ?? false} onChange={(event) => setDecisions({ ...decisions, merges: decisions.merges.map((item) => item.id === merge.id ? { ...item, accept: event.target.checked } : item) })} />
                      Unir
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
          <section>
            <h2 className="font-serif text-2xl">No parecen personas</h2>
            <ul className="mt-3 space-y-2">
              {preview.excluded.map((item) => {
                const decision = decisions.excluded.find((row) => row.name === item.name)
                return (
                  <li key={item.name} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
                    <span>{item.name} · {item.reason}</span>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={decision?.exclude ?? true} onChange={(event) => setDecisions({ ...decisions, excluded: decisions.excluded.map((row) => row.name === item.name ? { ...row, exclude: event.target.checked } : row) })} />
                      Excluir
                    </label>
                  </li>
                )
              })}
              {preview.excluded.length === 0 ? <li className="text-sm text-muted">Nada para excluir.</li> : null}
            </ul>
          </section>
        </div>
      ) : null}
      {step === 3 && preview && decisions ? (
        <div className="space-y-6">
          <section>
            <h2 className="font-serif text-2xl">Cartera</h2>
            <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
              {preview.receivables.map((row) => {
                const decision = decisions.receivables.find((item) => item.row === row.row)
                return (
                  <li key={row.row} className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_140px_160px_120px] sm:items-center">
                    <span className="text-sm">{decision?.name || row.name} · {money(row.amount)}</span>
                    <input className={inputClass} value={decision?.name ?? row.name} onChange={(event) => setDecisions({ ...decisions, receivables: decisions.receivables.map((item) => item.row === row.row ? { ...item, name: event.target.value } : item) })} />
                    <select className={inputClass} value={decision?.kind ?? row.kind} onChange={(event) => setDecisions({ ...decisions, receivables: decisions.receivables.map((item) => item.row === row.row ? { ...item, kind: event.target.value as ReceivableKind } : item) })}>
                      <option value="credito">Crédito</option>
                      <option value="separe">Plan separe</option>
                      <option value="prestamo">Préstamo</option>
                    </select>
                    <span className="text-xs text-muted">{row.dueDate || row.source || 'Sin fecha'}</span>
                  </li>
                )
              })}
            </ul>
          </section>
          <section className="grid gap-3 sm:grid-cols-3">
            {preview.cash.map((account) => (
              <article key={account.name} className="rounded-2xl border border-line p-4">
                <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{account.name}</p>
                <p className="mt-2 font-serif text-2xl tabular-nums">{money(account.balance)}</p>
              </article>
            ))}
          </section>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={decisions.includeCash} onChange={(event) => setDecisions({ ...decisions, includeCash: event.target.checked })} /> Usar estos saldos como apertura de caja</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={decisions.includePayables} onChange={(event) => setDecisions({ ...decisions, includePayables: event.target.checked })} /> Importar deudas ({money(preview.payables.reduce((sum, item) => sum + item.amount, 0))})</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={decisions.includeInvestments} onChange={(event) => setDecisions({ ...decisions, includeInvestments: event.target.checked })} /> Importar inversiones sin prenda ({money(preview.investments.reduce((sum, item) => sum + item.amount, 0))})</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={decisions.includeOpeningPnl} onChange={(event) => setDecisions({ ...decisions, includeOpeningPnl: event.target.checked })} /> Guardar el histórico de ventas {preview.openingPnl ? money(preview.openingPnl.sales) : ''} como cifra de apertura del P y G</label>
          <Field label="Fecha de esa cifra">
            <input className={`${inputClass} max-w-xs`} type="date" value={decisions.openingPnlDate} onChange={(event) => setDecisions({ ...decisions, openingPnlDate: event.target.value })} />
          </Field>
        </div>
      ) : null}
      {step === 4 && sheet && preview ? (
        <div>
          <p className="text-sm text-muted">Esto reemplaza el libro actual por el resultado de la importación.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-line p-4">
              <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Patrimonio importado</p>
              <p className="mt-2 font-serif text-4xl tabular-nums">{money(sheet.equity)}</p>
              <p className="mt-2 text-sm text-muted">Activos {money(sheet.assets)} − por pagar {money(sheet.liabilities)}</p>
            </article>
            <article className="rounded-2xl border border-line p-4">
              <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Patrimonio en el Excel</p>
              <p className="mt-2 font-serif text-4xl tabular-nums">{preview.workbookEquity == null ? '—' : money(preview.workbookEquity)}</p>
              <p className="mt-2 text-sm text-muted">Prendas {money(sheet.inventory.garments)} + inversión sin detalle {money(sheet.inventory.investments)}. Esa inversión es la diferencia de las filas INVERSION frente al costo de las prendas.</p>
            </article>
          </div>
          {confirming ? <p className="mt-4 text-sm text-warn">El libro ya tiene datos reales. Confirma otra vez para reemplazarlo. Conviene descargar un respaldo JSON antes.</p> : null}
          <Button className="mt-6" onClick={commit}>{confirming ? 'Sí, reemplazar el libro' : 'Importar'}</Button>
        </div>
      ) : null}
      {step > 0 && step < 4 ? <Button className="mt-6" onClick={() => setStep(step + 1)}>Seguir</Button> : null}
    </div>
  )
}
