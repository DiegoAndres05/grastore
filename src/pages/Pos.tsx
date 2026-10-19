import { Minus, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { METHOD_LABEL, PAY_METHODS, norm, swatch } from '../lib/catalog'
import { money, nextCutoff, todayInput } from '../lib/format'
import { availableUnits } from '../lib/money'
import type { CashMethod, Customer, PayMethod, Product, Sale } from '../types'
import { useStore } from '../store'
import { Button, FormError, Modal } from '../components/ui'

type CartLine = { productId: string; qty: number; price: number }
const methods: PayMethod[] = PAY_METHODS
const splitMethods = ['efectivo', 'nequi', 'bancolombia', 'tarjeta'] as const
type SplitMethod = (typeof splitMethods)[number]
const emptyParts = (): Record<SplitMethod, number> => ({ efectivo: 0, nequi: 0, bancolombia: 0, tarjeta: 0 })

export function Pos() {
  const { state, checkout, layaway, toast } = useStore()
  const searchRef = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [method, setMethod] = useState<PayMethod>('efectivo')
  const [split, setSplit] = useState(false)
  const [parts, setParts] = useState(emptyParts)
  const [paid, setPaid] = useState(0)
  const [tendered, setTendered] = useState(0)
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(todayInput())
  const [dueDate, setDueDate] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [ticketOpen, setTicketOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = document.activeElement?.tagName
      if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const products = useMemo(() => {
    const needle = norm(query)
    return state.products
      .filter((product) => product.active)
      .filter((product) => category === 'Todas' || product.category === category)
      .filter((product) => {
        if (!needle) return true
        return norm(`${product.name} ${product.sku} ${product.color} ${product.size} ${product.category}`).includes(needle)
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.size.localeCompare(b.size))
  }, [state.products, query, category])

  const detailed = cart
    .map((line) => ({ ...line, product: state.products.find((product) => product.id === line.productId) }))
    .filter((line) => line.product)
  const subtotal = detailed.reduce((sum, line) => sum + line.qty * line.price, 0)
  const safeDiscount = Math.min(discount, subtotal)
  const total = subtotal - safeDiscount
  const customer = state.customers.find((item) => item.id === customerId)
  const creditDue = method === 'credito' ? Math.max(0, total - Math.min(paid, total)) : 0
  const owed = customer ? customer.balance : 0
  const change = !split && method === 'efectivo' ? Math.max(0, tendered - total) : 0
  const received = splitMethods.reduce((sum, item) => sum + (parts[item] || 0), 0)
  const splitGap = Math.max(0, total - received)

  useEffect(() => {
    if (method === 'efectivo') setTendered(total)
  }, [method, total])

  useEffect(() => {
    if (cart.length === 0) lock.current = false
  }, [cart])

  function add(productId: string) {
    const product = state.products.find((item) => item.id === productId)
    if (!product) return
    const current = cart.find((line) => line.productId === productId)?.qty ?? 0
    const free = availableUnits(product)
    if (free <= 0 || current + 1 > free) {
      setNotice(free <= 0 ? `${product.name} está agotada` : `Solo quedan ${free} de ${product.name}`)
      return
    }
    setNotice('')
    setError('')
    setCart((lines) =>
      lines.some((line) => line.productId === productId)
        ? lines.map((line) => (line.productId === productId ? { ...line, qty: line.qty + 1 } : line))
        : [...lines, { productId, qty: 1, price: product.price }],
    )
  }

  function setQty(productId: string, qty: number) {
    const product = state.products.find((item) => item.id === productId)
    if (!product) return
    if (qty < 1) {
      setCart((lines) => lines.filter((line) => line.productId !== productId))
      return
    }
    if (qty > availableUnits(product)) {
      setNotice(`Solo quedan ${availableUnits(product)} de ${product.name}`)
      return
    }
    setNotice('')
    setCart((lines) => lines.map((line) => (line.productId === productId ? { ...line, qty } : line)))
  }

  function setPrice(productId: string, price: number) {
    setCart((lines) => lines.map((line) => (line.productId === productId ? { ...line, price } : line)))
  }

  async function cobrar() {
    if (lock.current) return
    lock.current = true
    if (split && received > total) {
      lock.current = false
      setError('El pago supera el total')
      return
    }
    const result = await checkout({
      lines: cart.map((line) => ({ productId: line.productId, qty: line.qty, price: line.price })),
      customerId: customerId || null,
      discount: safeDiscount,
      method,
      paid: split ? received : method === 'credito' ? Math.min(paid, total) : total,
      tendered,
      note,
      date: when,
      dueDate: split ? (splitGap > 0 ? dueDate || null : null) : method === 'credito' ? dueDate || null : null,
      payments: split ? splitMethods.map((item) => ({ method: item as CashMethod, amount: parts[item] || 0 })) : undefined,
    })
    if (!result.ok) {
      lock.current = false
      setError(result.error)
      return
    }
    setCart([])
    setDiscount(0)
    setPaid(0)
    setTendered(0)
    setParts(emptyParts())
    setNote('')
    setNotice('')
    setError('')
    setTicketOpen(false)
    setReceipt(result.data)
  }

  async function apartar() {
    if (!customerId) {
      setError('El plan separe necesita un cliente')
      return
    }
    const result = await layaway({
      customerId,
      lines: cart.map((line) => ({ productId: line.productId, qty: line.qty, price: line.price })),
      deposit: Math.min(paid, total),
      accountId: 'acct-efectivo',
      dueDate: dueDate || null,
      date: when,
      note,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setCart([])
    setPaid(0)
    setNote('')
    setError('')
    setTicketOpen(false)
    toast(`Apartado ${result.data.number}`)
  }

  useEffect(() => {
    if (!ticketOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTicketOpen(false)
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [ticketOpen])

  const units = detailed.reduce((sum, line) => sum + line.qty, 0)
  const ticket = (docked = false) => (
    <TicketBody
      docked={docked}
      detailed={detailed}
      customers={state.customers}
      customerId={customerId}
      setCustomerId={setCustomerId}
      safeDiscount={safeDiscount}
      setDiscount={setDiscount}
      method={method}
      setMethod={(value) => {
        setSplit(false)
        setMethod(value)
      }}
      split={split}
      setSplit={setSplit}
      parts={parts}
      setPart={(item, amount) => setParts((current) => ({ ...current, [item]: amount }))}
      received={received}
      splitGap={splitGap}
      tendered={tendered}
      setTendered={setTendered}
      paid={paid}
      setPaid={setPaid}
      creditDue={creditDue}
      customer={customer}
      owed={owed}
      note={note}
      setNote={setNote}
      total={total}
      change={change}
      notice={notice}
      error={error}
      onCharge={cobrar}
      onLayaway={apartar}
      setQty={setQty}
      setPrice={setPrice}
      when={when}
      setWhen={setWhen}
      dueDate={dueDate}
      setDueDate={setDueDate}
    />
  )
  const charge = (
    <>
      {notice ? <p className="text-sm text-warn">{notice}</p> : null}
      <FormError>{error}</FormError>
      <div className="mt-1 flex items-end justify-between">
        <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Total</p>
        <p className="font-serif text-3xl tabular-nums">{money(total)}</p>
      </div>
      {split && detailed.length > 0 ? (
        <p className="mt-1 text-right text-sm text-muted">
          Recibido {money(Math.min(received, total))} · saldo {money(splitGap)}
        </p>
      ) : null}
      {!split && method === 'efectivo' && detailed.length > 0 && change > 0 ? <p className="mt-1 text-right text-sm text-muted">Cambio {money(change)}</p> : null}
      <Button className="mt-4 w-full" disabled={detailed.length === 0} onClick={cobrar}>
        Cobrar
      </Button>
      <button type="button" className="mt-3 w-full text-sm text-brass-deep" disabled={detailed.length === 0} onClick={apartar}>
        Apartar (plan separe)
      </button>
    </>
  )

  return (
    <div>
      <header className="mb-6">
        <p className="text-[11px] tracking-[0.22em] text-muted uppercase">Piso de venta</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">Vender</h1>
      </header>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 pb-24 lg:pb-0">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" size={16} />
            <input
              ref={searchRef}
              className="w-full rounded-xl border border-line bg-card py-3 pr-12 pl-9 text-sm outline-none focus:border-ink"
              placeholder="Buscar prenda, color o talla"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">/</kbd>
          </div>
          <div className="scroll-clean mt-4 flex min-w-0 gap-2 overflow-x-auto pb-1">
            {['Todas', ...state.settings.categories].map((item) => (
              <button
                key={item}
                type="button"
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${category === item ? 'bg-ink text-paper' : 'border border-line bg-card text-muted'}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {products.length === 0 ? (
            <p className="mt-10 text-sm text-muted">Ninguna prenda coincide con esa búsqueda.</p>
          ) : (
            <div key={`${category}-${query}`} className="cascade mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product, index) => {
                const inCart = cart.find((line) => line.productId === product.id)?.qty ?? 0
                const free = availableUnits(product)
                const gone = free <= 0
                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={gone}
                    className="rounded-2xl border border-line bg-card p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-brass/70 disabled:opacity-50"
                    style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                    onClick={() => add(product.id)}
                  >
                    <div className="flex items-start justify-between">
                      <span className="h-8 w-8 rounded-full border border-line" style={{ background: swatch(product.color) }} />
                      <span className="text-[10px] tracking-[0.16em] text-muted uppercase">{product.category}</span>
                    </div>
                    <p className="mt-5 font-serif text-xl leading-tight">{product.name}</p>
                    <p className="mt-1 text-sm text-muted">{product.color} · {product.size}</p>
                    <div className="mt-4 flex items-end justify-between">
                      <p className="tabular-nums">{money(product.price)}</p>
                      <p className={`text-xs ${free <= product.minStock ? 'text-warn' : 'text-muted'}`}>
                        {gone ? 'Agotada' : inCart ? `${inCart} en ticket` : `${free} und`}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <aside className="sticky top-6 hidden min-w-0 rounded-3xl border border-line bg-ticket p-5 lg:block">{ticket()}</aside>
      </div>

      <button
        type="button"
        className="fixed right-4 bottom-4 left-4 z-30 flex items-center justify-between gap-3 rounded-full bg-brass px-5 py-3.5 text-espresso shadow-2xl lg:hidden"
        onClick={() => setTicketOpen(true)}
      >
        <span className="font-semibold">Ticket</span>
        <span className="text-sm">{units} {units === 1 ? 'prenda' : 'prendas'}</span>
        <span className="font-serif text-lg tabular-nums">{money(total)}</span>
      </button>

      {ticketOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="modal-scrim absolute inset-0 bg-espresso/70 backdrop-blur-[3px]" aria-label="Cerrar ticket" onClick={() => setTicketOpen(false)} />
          <div className="ticket-sheet absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl border border-line bg-ticket">
            <div className="relative flex h-11 shrink-0 items-center justify-center">
              <span className="h-1 w-10 rounded-full bg-line" />
              <button type="button" className="absolute right-4 flex h-9 w-9 items-center justify-center rounded-full border border-line" aria-label="Cerrar ticket" onClick={() => setTicketOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">{ticket(true)}</div>
            <div className="shrink-0 border-t border-dashed border-brass/50 px-5 pt-4 pb-6">{charge}</div>
          </div>
        </div>
      ) : null}

      <Modal open={receipt != null} kicker="Venta registrada" title={receipt?.number ?? ''} onClose={() => setReceipt(null)}>
        {receipt ? (
          <div>
            <p className="text-sm text-muted">
              {receipt.customerName}
              {' · '}
              {receipt.payments && receipt.payments.length > 1
                ? receipt.payments.map((part) => `${METHOD_LABEL[part.method]} ${money(part.amount)}`).join(' + ')
                : METHOD_LABEL[receipt.method]}
            </p>
            <ul className="mt-5 space-y-2">
              {receipt.lines.map((line) => (
                <li key={line.productId} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">{line.qty} × {line.name} · {line.size}</span>
                  <span className="shrink-0 tabular-nums">{money(line.qty * line.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-dashed border-line pt-4">
              <div className="flex items-end justify-between">
                <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Total</p>
                <p className="font-serif text-3xl tabular-nums sm:text-4xl">{money(receipt.total)}</p>
              </div>
              {receipt.tendered != null && receipt.tendered > receipt.total ? (
                <p className="mt-3 text-right font-serif text-2xl">Cambio {money(receipt.tendered - receipt.total)}</p>
              ) : null}
              {receipt.balance > 0 ? <p className="mt-3 text-right text-sm text-warn">Saldo a crédito {money(receipt.balance)}</p> : null}
            </div>
            <Button className="mt-6 w-full" onClick={() => setReceipt(null)}>Nueva venta</Button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

type TicketLine = { productId: string; qty: number; price: number; product?: Product }

function TicketBody({
  detailed,
  customers,
  customerId,
  setCustomerId,
  safeDiscount,
  setDiscount,
  method,
  setMethod,
  split,
  setSplit,
  parts,
  setPart,
  received,
  splitGap,
  tendered,
  setTendered,
  paid,
  setPaid,
  creditDue,
  customer,
  owed,
  note,
  setNote,
  total,
  change,
  notice,
  error,
  onCharge,
  onLayaway,
  setQty,
  setPrice,
  when,
  setWhen,
  dueDate,
  setDueDate,
  docked = false,
}: {
  detailed: TicketLine[]
  customers: Customer[]
  customerId: string
  setCustomerId: (value: string) => void
  safeDiscount: number
  setDiscount: (value: number) => void
  method: PayMethod
  setMethod: (value: PayMethod) => void
  split: boolean
  setSplit: (value: boolean) => void
  parts: Record<SplitMethod, number>
  setPart: (method: SplitMethod, amount: number) => void
  received: number
  splitGap: number
  tendered: number
  setTendered: (value: number) => void
  paid: number
  setPaid: (value: number) => void
  creditDue: number
  customer: Customer | undefined
  owed: number
  note: string
  setNote: (value: string) => void
  total: number
  change: number
  notice: string
  error: string
  onCharge: () => void
  onLayaway: () => void
  setQty: (productId: string, qty: number) => void
  setPrice: (productId: string, price: number) => void
  when: string
  setWhen: (value: string) => void
  dueDate: string
  setDueDate: (value: string) => void
  docked?: boolean
}) {
  return (
    <>
      <img src="/logo.svg" alt="La Grasita Store" className={`mx-auto w-full ${docked ? 'max-w-[150px]' : 'max-w-[210px]'}`} />
      <p className="mt-3 text-center text-[11px] tracking-[0.2em] text-muted uppercase">Ticket de venta</p>
      <div className="my-4 border-t border-dashed border-brass/50" />
      {detailed.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Todavía no hay prendas en este ticket.</p>
      ) : (
        <ul className="space-y-3">
          {detailed.map((line) => (
            <li key={line.productId} className="flex gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-5">{line.product?.name}</p>
                <p className="text-xs text-muted">{line.product?.color} · {line.product?.size}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full border border-line" aria-label="Quitar una" onClick={() => setQty(line.productId, line.qty - 1)}>
                  <Minus size={12} />
                </button>
                <span className="w-5 text-center text-sm tabular-nums">{line.qty}</span>
                <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full border border-line" aria-label="Sumar una" onClick={() => setQty(line.productId, line.qty + 1)}>
                  <Plus size={12} />
                </button>
              </div>
              <div className="shrink-0 text-right">
                <input
                  inputMode="numeric"
                  aria-label={`Precio de ${line.product?.name ?? 'prenda'}`}
                  className="w-24 rounded-lg border border-line bg-card px-2 py-1 text-right text-sm tabular-nums"
                  value={new Intl.NumberFormat('es-CO').format(line.price)}
                  onChange={(event) => setPrice(line.productId, Number(event.target.value.replace(/\D/g, '')) || 0)}
                />
                <p className="mt-1 text-[11px] text-muted">{money(line.qty * line.price)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="my-4 border-t border-dashed border-brass/50" />
      <label className="block text-[11px] tracking-[0.16em] text-muted uppercase">Cliente</label>
      <select className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
        <option value="">Mostrador</option>
        {customers.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
      <label className="mt-4 block text-[11px] tracking-[0.16em] text-muted uppercase">Fecha</label>
      <input className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm" type="date" value={when} onChange={(event) => setWhen(event.target.value)} />
      <label className="mt-4 block text-[11px] tracking-[0.16em] text-muted uppercase">Descuento</label>
      <input
        inputMode="numeric"
        className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
        value={safeDiscount ? new Intl.NumberFormat('es-CO').format(safeDiscount) : ''}
        placeholder="0"
        onChange={(event) => setDiscount(Number(event.target.value.replace(/\D/g, '')) || 0)}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Pago</p>
        <button type="button" className="text-sm text-brass-deep" onClick={() => setSplit(!split)}>
          {split ? 'Un solo medio' : 'Dividir pago'}
        </button>
      </div>
      {split ? (
        <div className="mt-3 space-y-3">
          {splitMethods.map((item) => (
            <label key={item} className="block">
              <span className="text-[11px] tracking-[0.16em] text-muted uppercase">{METHOD_LABEL[item]}</span>
              <input
                inputMode="numeric"
                className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
                value={parts[item] ? new Intl.NumberFormat('es-CO').format(parts[item]) : ''}
                placeholder="0"
                onChange={(event) => setPart(item, Number(event.target.value.replace(/\D/g, '')) || 0)}
              />
            </label>
          ))}
          <p className="text-xs text-muted">
            Recibido {money(Math.min(received, total))}
            {received > total ? ` · sobra ${money(received - total)}` : ` · saldo ${money(splitGap)}`}
          </p>
          {splitGap > 0 ? (
            <>
              <p className="text-xs text-muted">
                El saldo queda a crédito{customer && owed > 0 ? ` · ya debe ${money(owed)}` : ''}. Elige el cliente.
              </p>
              <label className="block text-[11px] tracking-[0.16em] text-muted uppercase">Corte</label>
              <select className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm" value={dueDate} onChange={(event) => setDueDate(event.target.value)}>
                <option value="">Sin fecha</option>
                <option value={nextCutoff(15)}>15 · {nextCutoff(15)}</option>
                <option value={nextCutoff(30)}>30 · {nextCutoff(30)}</option>
              </select>
            </>
          ) : null}
        </div>
      ) : (
        <>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {methods.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-xl border px-2 py-2 text-center text-sm leading-tight ${method === item ? 'border-ink bg-ink text-paper' : 'border-line bg-card'}`}
            onClick={() => setMethod(item)}
          >
            {METHOD_LABEL[item]}
          </button>
        ))}
      </div>
      {method === 'efectivo' ? (
        <div className="mt-4">
          <label className="text-[11px] tracking-[0.16em] text-muted uppercase">Efectivo recibido</label>
          <input
            inputMode="numeric"
            className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
            value={new Intl.NumberFormat('es-CO').format(tendered)}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setTendered(Number(event.target.value.replace(/\D/g, '')) || 0)}
          />
        </div>
      ) : null}
      {method === 'credito' ? (
        <div className="mt-4">
          <label className="text-[11px] tracking-[0.16em] text-muted uppercase">Abono inicial</label>
          <input
            inputMode="numeric"
            className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
            value={paid ? new Intl.NumberFormat('es-CO').format(paid) : ''}
            placeholder="0"
            onChange={(event) => setPaid(Number(event.target.value.replace(/\D/g, '')) || 0)}
          />
          <p className="mt-2 text-xs text-muted">
            Queda a crédito {money(creditDue)}
            {customer && owed > 0 ? ` · ya debe ${money(owed)}` : ''}
          </p>
          <label className="mt-3 block text-[11px] tracking-[0.16em] text-muted uppercase">Corte</label>
          <select className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm" value={dueDate} onChange={(event) => setDueDate(event.target.value)}>
            <option value="">Sin fecha</option>
            <option value={nextCutoff(15)}>15 · {nextCutoff(15)}</option>
            <option value={nextCutoff(30)}>30 · {nextCutoff(30)}</option>
          </select>
        </div>
      ) : null}
        </>
      )}
      <label className="mt-4 block text-[11px] tracking-[0.16em] text-muted uppercase">Nota</label>
      <input className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm" value={note} placeholder="Opcional" onChange={(event) => setNote(event.target.value)} />
      {docked ? null : (
        <>
          <div className="mt-5 flex items-end justify-between">
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Total</p>
            <p className="font-serif text-3xl tabular-nums">{money(total)}</p>
          </div>
          {split && detailed.length > 0 ? (
            <p className="mt-1 text-right text-sm text-muted">
              Recibido {money(Math.min(received, total))} · saldo {money(splitGap)}
            </p>
          ) : null}
          {!split && method === 'efectivo' && detailed.length > 0 && change > 0 ? <p className="mt-1 text-right text-sm text-muted">Cambio {money(change)}</p> : null}
          {notice ? <p className="mt-3 text-sm text-warn">{notice}</p> : null}
          <FormError>{error}</FormError>
          <Button className="mt-4 w-full" disabled={detailed.length === 0} onClick={onCharge}>
            Cobrar
          </Button>
          <button type="button" className="mt-3 w-full text-sm text-brass-deep" disabled={detailed.length === 0} onClick={onLayaway}>
            Apartar (plan separe)
          </button>
        </>
      )}
    </>
  )
}
