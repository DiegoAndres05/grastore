import * as XLSX from 'xlsx'
import { COLORS, CATEGORIES, norm } from './catalog'
import { emptyState } from './book'
import { uid } from './money'
import type { Actor, PayableKind, Product, State } from '../types'

export type ProductDraft = {
  key: string
  sku: string
  name: string
  category: string
  color: string
  sourceColor: string
  size: string
  sourceSize: string
  cost: number
  price: number
  stock: number
  location: string
  brand: string
  design: string
  colorReview: boolean
  sizeReview: boolean
}

export type MergeDraft = { id: string; from: string; into: string; reason: string }
export type ExcludeDraft = { name: string; reason: string }
export type ReceivableKind = 'credito' | 'separe' | 'prestamo'
export type ReceivableDraft = {
  row: number
  name: string
  amount: number
  kind: ReceivableKind
  dueDate: string | null
  source: string
}
export type PayableDraft = { row: number; creditor: string; amount: number; kind: PayableKind; concept: string }
export type InvestmentDraft = { row: number; supplier: string; amount: number; location: string; label: string }
export type CashDraft = { name: string; balance: number }

export type WorkbookPreview = {
  products: ProductDraft[]
  buyers: string[]
  merges: MergeDraft[]
  excluded: ExcludeDraft[]
  receivables: ReceivableDraft[]
  payables: PayableDraft[]
  investments: InvestmentDraft[]
  suppliers: string[]
  cash: CashDraft[]
  openingPnl: { sales: number; cogs: number; profit: number } | null
  workbookEquity: number | null
  warnings: string[]
}

export type ImportDecisions = {
  products: { key: string; sku: string; name: string; category: string; color: string; size: string; include: boolean }[]
  merges: { id: string; accept: boolean }[]
  excluded: { name: string; exclude: boolean }[]
  receivables: { row: number; kind: ReceivableKind; dueDate: string | null; name: string }[]
  includeInvestments: boolean
  includePayables: boolean
  includeCash: boolean
  includeOpeningPnl: boolean
  openingPnlDate: string
}

const NOT_COLOR = new Set(['p', 'g', 'j', 'b', 'tp', 'prom', 's', 'economic', 'jean', 'vendida', 'ok', ''])
const NOT_SIZE = new Set(['p', 'g', 'j', 'b', 'tp', 'prom', 's', 'economic', 'vendida', 'ok'])
const NON_PERSON = /^(pago\b|pauta\b|prestamo\b|préstamo\b|gorras\b|inversion\b|inversión\b|saldo a favor\b)/i

function text(cell: XLSX.CellObject | undefined) {
  if (!cell || cell.v == null) return ''
  if (cell.v instanceof Date) return dateOnly(cell.v)
  return String(cell.v).replace(/\s+/g, ' ').trim()
}

function number(cell: XLSX.CellObject | undefined) {
  if (!cell || cell.v == null || cell.v === '') return null
  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) return cell.v
  if (typeof cell.v === 'string') {
    const cleaned = Number(cell.v.replace(/[^\d.-]/g, ''))
    return Number.isFinite(cleaned) ? cleaned : null
  }
  return null
}

function dateOnly(value: Date) {
  const iso = value.toISOString()
  if (iso.endsWith('T00:00:00.000Z') || iso.endsWith('T05:00:00.000Z')) return iso.slice(0, 10)
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

function cell(ws: XLSX.WorkSheet, c: number, r: number) {
  return ws[XLSX.utils.encode_cell({ c, r })] as XLSX.CellObject | undefined
}

function sheet(wb: XLSX.WorkBook, name: string) {
  const found = wb.SheetNames.find((item) => norm(item) === norm(name))
  return found ? wb.Sheets[found] : undefined
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
}

function normalizeColor(raw: string) {
  const trimmed = raw.trim()
  const key = norm(trimmed)
  if (NOT_COLOR.has(key)) return { value: 'Sin definir', review: true }
  const aliases: Record<string, string> = {
    rojo: 'Rojo',
    roja: 'Rojo',
    negro: 'Negro',
    negra: 'Negro',
    blanco: 'Blanco',
    blanca: 'Blanco',
    azul: 'Azul',
    'azul oscuro': 'Azul oscuro',
    'azul claro': 'Azul claro',
    'azul raro': 'Azul raro',
    gris: 'Gris',
    'gris opaco': 'Gris opaco',
    'gris claro': 'Gris claro',
    'gris oscuro': 'Gris oscuro',
    verde: 'Verde',
    cafe: 'Café',
    'cafe claro': 'Café claro',
    rosado: 'Rosado',
    'rosa claro': 'Rosa claro',
    hueso: 'Hueso',
    amarillo: 'Amarillo',
  }
  return { value: aliases[key] ?? titleCase(trimmed), review: false }
}

function normalizeSize(raw: string) {
  const trimmed = String(raw).trim()
  const key = norm(trimmed)
  if (NOT_SIZE.has(key)) return { value: 'U', review: true }
  return { value: trimmed.toUpperCase(), review: false }
}

function parseCode(code: string) {
  const match = code.trim().match(/^#[^%]*%([^()]+)\(([^)]+)\)/)
  if (!match) return { brand: '', design: '' }
  return { brand: match[1].trim(), design: match[2].trim() }
}

function isTotal(value: string) {
  return /^(total|totales|cxc|cxp|sumas iguales)$/i.test(value.trim())
}

function compactName(value: string) {
  return norm(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

function displayName(value: string) {
  return titleCase(value)
}

function findRow(ws: XLSX.WorkSheet, label: string, max = 20) {
  for (let r = 0; r < max; r += 1) {
    for (let c = 0; c < 30; c += 1) {
      if (norm(text(cell(ws, c, r))) === norm(label)) return { c, r }
    }
  }
  return null
}

function lastBalance(ws: XLSX.WorkSheet, column: number, start: number) {
  let last = 0
  let seen = false
  let empty = 0
  for (let r = start; r < start + 5000; r += 1) {
    const value = number(cell(ws, column, r))
    if (value == null) {
      empty += 1
      if (seen && empty > 40) break
      continue
    }
    empty = 0
    seen = true
    last = Math.round(value)
  }
  return last
}

export function suggestMerges(names: string[]): MergeDraft[] {
  const unique = new Map<string, string>()
  for (const name of names) {
    const clean = displayName(name)
    const key = compactName(clean)
    if (!key || unique.has(key)) continue
    unique.set(key, clean)
  }
  const list = [...unique.values()]
  const merges: MergeDraft[] = []
  const used = new Set<string>()
  const longerFirst = [...list].sort((a, b) => compactName(b).length - compactName(a).length)
  for (const short of [...list].sort((a, b) => compactName(a).length - compactName(b).length)) {
    const key = compactName(short)
    if (key.length < 6 || used.has(key)) continue
    const host = longerFirst.find((long) => {
      const other = compactName(long)
      return other !== key && other.length > key.length && other.startsWith(key)
    })
    if (!host) continue
    used.add(key)
    merges.push({
      id: `${key}->${compactName(host)}`,
      from: short,
      into: host,
      reason: 'El nombre más corto parece la misma persona',
    })
  }
  return merges
}

export function parseWorkbook(data: ArrayBuffer | Uint8Array): WorkbookPreview {
  const wb = XLSX.read(data, { type: 'array', cellDates: true })
  const warnings: string[] = []
  const inventory = sheet(wb, 'Inv Actual')
  const cxc = sheet(wb, 'CxC')
  const cxp = sheet(wb, 'CxP')
  const cashSheet = sheet(wb, 'Neq o Efe')
  const pnl = sheet(wb, 'Perd y Gan')
  const balance = sheet(wb, 'Balance')
  if (!inventory) warnings.push('No está la hoja Inv Actual')

  const groups = new Map<string, ProductDraft & { count: number }>()
  const buyers: string[] = []
  const investments: InvestmentDraft[] = []
  if (inventory) {
    for (let r = 0; r < 2000; r += 1) {
      const code = text(cell(inventory, 1, r))
      const tipo = text(cell(inventory, 4, r))
      const qty = number(cell(inventory, 5, r)) ?? 0
      const sold = number(cell(inventory, 6, r)) ?? 0
      const asset = number(cell(inventory, 10, r)) ?? 0
      if (isTotal(code)) continue
      if (/^(INVERSION|SALDO A FAVOR)\b/i.test(code)) {
        if (asset > 0) {
          const locationRaw = text(cell(inventory, 0, r)).toUpperCase()
          const location = /^(ARRIBA|ABAJO|BODEGA)$/.test(locationRaw) ? locationRaw : ''
          investments.push({
            row: r + 1,
            supplier: displayName(code.replace(/^(INVERSION|SALDO A FAVOR)\s+/i, '')) || displayName(code),
            amount: Math.round(asset),
            location,
            label: code,
          })
        }
        continue
      }
      const buyer = text(cell(inventory, 14, r))
      if (buyer && !/^vendid/i.test(buyer)) buyers.push(buyer)
      if (!code && !tipo) continue
      if (qty > 5) continue
      if (qty - sold <= 0) continue
      const sourceColor = text(cell(inventory, 2, r))
      const sourceSize = text(cell(inventory, 3, r))
      const color = normalizeColor(sourceColor)
      const size = normalizeSize(sourceSize)
      const cost = Math.round(number(cell(inventory, 9, r)) ?? (qty - sold > 0 ? asset / (qty - sold) : 0))
      const price = Math.round(number(cell(inventory, 11, r)) ?? 0)
      const locationRaw = text(cell(inventory, 0, r)).toUpperCase()
      const location = /^(ARRIBA|ABAJO|BODEGA)$/.test(locationRaw) ? titleCase(locationRaw) : ''
      const parsed = parseCode(code)
      const name = tipo ? `${titleCase(tipo)} ${code}`.trim() : displayName(code)
      const category = tipo ? titleCase(tipo) : 'Sin tipo'
      const key = [code.toUpperCase(), color.value.toUpperCase(), size.value.toUpperCase(), cost, price].join('|')
      const current = groups.get(key)
      if (current) {
        current.stock += qty - sold
        if (location && !current.location.includes(location)) current.location = [current.location, location].filter(Boolean).join(', ')
      } else {
        groups.set(key, {
          key,
          sku: code.toUpperCase() || `GR-${groups.size + 1}`,
          name,
          category,
          color: color.value,
          sourceColor,
          size: size.value,
          sourceSize,
          cost,
          price: price > 0 ? price : Math.max(cost, 1),
          stock: qty - sold,
          location,
          brand: parsed.brand,
          design: parsed.design,
          colorReview: color.review,
          sizeReview: size.review,
          count: 1,
        })
      }
    }
  }

  const used = new Set<string>()
  const products: ProductDraft[] = []
  const codeCount = new Map<string, number>()
  for (const draft of groups.values()) codeCount.set(draft.sku, (codeCount.get(draft.sku) ?? 0) + 1)
  for (const draft of groups.values()) {
    let sku = draft.sku || `GR-${products.length + 1}`
    if ((codeCount.get(draft.sku) ?? 0) > 1 || used.has(sku)) {
      const suffix = [draft.color, draft.size].filter((part) => part && part !== 'Sin definir' && part !== 'U').join('-')
      sku = suffix ? `${draft.sku}-${suffix}` : `${draft.sku}-${products.length + 1}`
    }
    let unique = sku.toUpperCase().replace(/\s+/g, '')
    let n = 2
    while (used.has(unique)) {
      unique = `${sku}-${n}`.toUpperCase().replace(/\s+/g, '')
      n += 1
    }
    used.add(unique)
    products.push({ ...draft, sku: unique })
  }

  const receivables: ReceivableDraft[] = []
  if (cxc) {
    for (let r = 0; r < 80; r += 1) {
      const name = text(cell(cxc, 1, r))
      const amount = number(cell(cxc, 2, r))
      if (!name || amount == null || amount === 0 || isTotal(name)) continue
      const due = cell(cxc, 3, r)
      const source = text(due)
      const dueDate = due?.v instanceof Date ? dateOnly(due.v) : /^\d{4}-\d{2}-\d{2}/.test(source) ? source.slice(0, 10) : null
      const marker = source.toUpperCase()
      const kind: ReceivableKind = marker.includes('SEPA') ? 'separe' : marker.includes('PREST') || NON_PERSON.test(name) ? 'prestamo' : 'credito'
      receivables.push({ row: r + 1, name: displayName(name), amount: Math.round(amount), kind, dueDate, source })
    }
  } else warnings.push('No está la hoja CxC')

  const payables: PayableDraft[] = []
  if (cxp) {
    for (let r = 0; r < 80; r += 1) {
      const creditor = text(cell(cxp, 1, r))
      const amount = number(cell(cxp, 2, r))
      if (!creditor || amount == null || amount === 0 || isTotal(creditor)) continue
      const label = creditor.toUpperCase()
      const kind: PayableKind = /SUELDO/.test(label) ? 'sueldo' : /LUZ|SERVICIO/.test(label) ? 'servicio' : /INYEC/.test(label) ? 'capital' : 'otro'
      payables.push({ row: r + 1, creditor: displayName(creditor), amount: Math.round(amount), kind, concept: displayName(creditor) })
    }
  } else warnings.push('No está la hoja CxP')

  const cash: CashDraft[] = []
  if (cashSheet) {
    for (const name of ['Nequi', 'Efectivo', 'Bancolombia']) {
      const found = findRow(cashSheet, name, 6)
      cash.push({ name, balance: found ? lastBalance(cashSheet, found.c + 3, found.r + 2) : 0 })
      if (!found) warnings.push(`No se encontró la caja ${name}`)
    }
  } else warnings.push('No está la hoja Neq o Efe')

  let openingPnl: WorkbookPreview['openingPnl'] = null
  if (pnl) {
    let sales = 0
    let cogs = 0
    for (let r = 0; r < 20; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const label = norm(text(cell(pnl, c, r)))
        if (label.startsWith('venta')) sales = Math.round(number(cell(pnl, c + 2, r)) ?? number(cell(pnl, c + 1, r)) ?? sales)
        if (label.startsWith('costo')) cogs = Math.round(number(cell(pnl, c + 2, r)) ?? number(cell(pnl, c + 1, r)) ?? cogs)
      }
    }
    if (sales || cogs) openingPnl = { sales, cogs, profit: sales - cogs }
  }

  let workbookEquity: number | null = null
  if (balance) {
    for (let r = 0; r < 25; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        if (norm(text(cell(balance, c, r))) !== 'patrimonio') continue
        for (let look = c + 1; look < c + 5; look += 1) {
          const value = number(cell(balance, look, r))
          if (value != null) workbookEquity = Math.round(value)
        }
      }
    }
  }

  const names = [...buyers, ...receivables.filter((row) => row.kind !== 'prestamo' || !NON_PERSON.test(row.name)).map((row) => row.name)]
  const excludedMap = new Map<string, ExcludeDraft>()
  for (const name of names) {
    if (!NON_PERSON.test(name)) continue
    const clean = displayName(name)
    excludedMap.set(compactName(clean), { name: clean, reason: 'No parece una persona' })
  }
  const people = names.filter((name) => !NON_PERSON.test(name))
  const merges = suggestMerges(people)

  const suppliers = [...new Set(investments.map((item) => item.supplier).filter(Boolean))]
  if (products.some((item) => item.colorReview)) warnings.push('Hay colores que no son colores. Quedaron como "Sin definir" para que los corrijas.')
  if (products.some((item) => item.sizeReview)) warnings.push('Hay tallas que parecen códigos. Quedaron en U para que las corrijas.')
  if (merges.length) warnings.push('Hay nombres parecidos. No se unen solos: marca Unir solo si son la misma persona.')

  return {
    products,
    buyers: [...new Set(people.map(displayName))],
    merges,
    excluded: [...excludedMap.values()],
    receivables,
    payables,
    investments,
    suppliers,
    cash,
    openingPnl,
    workbookEquity,
    warnings,
  }
}

export function defaultDecisions(preview: WorkbookPreview): ImportDecisions {
  return {
    products: preview.products.map((product) => ({
      key: product.key,
      sku: product.sku,
      name: product.name,
      category: product.category,
      color: product.color,
      size: product.size,
      include: true,
    })),
    merges: preview.merges.map((merge) => ({ id: merge.id, accept: false })),
    excluded: preview.excluded.map((item) => ({ name: item.name, exclude: true })),
    receivables: preview.receivables.map((row) => ({ row: row.row, kind: row.kind, dueDate: row.dueDate, name: row.name })),
    includeInvestments: true,
    includePayables: true,
    includeCash: true,
    includeOpeningPnl: true,
    openingPnlDate: '2025-04-18',
  }
}

function canonicalName(name: string, merges: MergeDraft[], accepted: Set<string>) {
  let current = displayName(name)
  const seen = new Set<string>()
  while (!seen.has(compactName(current))) {
    seen.add(compactName(current))
    const merge = merges.find((item) => accepted.has(item.id) && compactName(item.from) === compactName(current))
    if (!merge) break
    current = merge.into
  }
  return current
}

export function importBook(preview: WorkbookPreview, decisions: ImportDecisions, actor?: Actor | null): State {
  const state = emptyState()
  const accepted = new Set(decisions.merges.filter((item) => item.accept).map((item) => item.id))
  const excluded = new Set(decisions.excluded.filter((item) => item.exclude).map((item) => compactName(item.name)))
  const productDecisions = new Map(decisions.products.map((item) => [item.key, item]))
  const stamp = { createdBy: actor?.id ?? null, createdByName: actor?.name ?? null }

  if (decisions.includeCash) {
    state.accounts = state.accounts.map((account) => {
      const found = preview.cash.find((item) => norm(item.name) === norm(account.name))
      return found ? { ...account, openingBalance: found.balance } : account
    })
  }

  const supplierIds = new Map<string, string>()
  for (const name of preview.suppliers) {
    const id = uid()
    supplierIds.set(compactName(name), id)
    state.suppliers.push({ id, name, contact: '', phone: '', city: '', specialty: 'Mercancía', ...stamp })
  }

  const categories = new Set<string>(CATEGORIES)
  const colors = new Set<string>(COLORS)
  for (const draft of preview.products) {
    const decision = productDecisions.get(draft.key)
    if (decision && !decision.include) continue
    const sku = (decision?.sku || draft.sku).trim().toUpperCase()
    const category = (decision?.category || draft.category).trim()
    const color = (decision?.color || draft.color).trim()
    const product: Product = {
      id: uid(),
      sku,
      name: (decision?.name || draft.name).trim(),
      category,
      color,
      size: (decision?.size || draft.size).trim(),
      cost: draft.cost,
      price: draft.price,
      stock: draft.stock,
      reserved: 0,
      minStock: 1,
      active: true,
      location: draft.location,
      brand: draft.brand,
      design: draft.design,
      ...stamp,
    }
    state.products.push(product)
    if (category) categories.add(category)
    if (color) colors.add(color)
  }
  state.settings = { ...state.settings, categories: [...categories], colors: [...colors] }

  const customers = new Map<string, { id: string; name: string }>()
  const ensureCustomer = (name: string) => {
    const clean = canonicalName(name, preview.merges, accepted)
    if (!clean || excluded.has(compactName(clean))) return null
    const key = compactName(clean)
    const existing = customers.get(key)
    if (existing) return existing
    const created = { id: uid(), name: clean }
    customers.set(key, created)
    state.customers.push({
      id: created.id,
      name: clean,
      phone: '',
      email: '',
      city: '',
      creditLimit: 0,
      balance: 0,
      since: new Date().toISOString(),
      ...stamp,
    })
    return created
  }
  for (const buyer of preview.buyers) ensureCustomer(buyer)

  const receivableDecisions = new Map(decisions.receivables.map((item) => [item.row, item]))
  let saleNumber = 1
  for (const row of preview.receivables) {
    const decision = receivableDecisions.get(row.row) ?? row
    const name = decision.name || row.name
    if (decision.kind === 'prestamo') {
      const person = NON_PERSON.test(name) ? 'Préstamo sin nombre' : canonicalName(name, preview.merges, accepted)
      const customer = NON_PERSON.test(name) ? null : ensureCustomer(name)
      state.loans.push({
        id: uid(),
        date: new Date().toISOString(),
        person,
        customerId: customer?.id ?? null,
        original: row.amount,
        balance: row.amount,
        dueDate: decision.dueDate,
        note: 'Préstamo importado de CxC',
        ...stamp,
      })
      continue
    }
    const customer = ensureCustomer(name)
    if (!customer) continue
    if (decision.kind === 'separe') {
      state.layaways.push({
        id: uid(),
        number: `S-${String(state.seq.layaway).padStart(4, '0')}`,
        date: new Date().toISOString(),
        dueDate: decision.dueDate,
        customerId: customer.id,
        customerName: customer.name,
        lines: [],
        total: row.amount,
        deposited: 0,
        balance: row.amount,
        status: 'abierto',
        note: 'Plan separe importado. El libro no dice qué prenda es, así que no se reservó stock.',
        ...stamp,
      })
      state.seq.layaway += 1
      continue
    }
    const when = decision.dueDate ? `${decision.dueDate}T12:00:00.000-05:00` : new Date().toISOString()
    state.sales.push({
      id: uid(),
      number: `V-${saleNumber}`,
      date: when,
      customerId: customer.id,
      customerName: customer.name,
      lines: [{ productId: '', sku: '', name: 'Saldo inicial', color: '', size: '', qty: 1, price: row.amount, cost: 0, returnedQty: 0 }],
      discount: 0,
      total: row.amount,
      method: 'credito',
      paid: 0,
      balance: row.amount,
      tendered: null,
      note: 'Saldo importado de CxC',
      accountId: null,
      cashIn: 0,
      dueDate: decision.dueDate,
      kind: 'opening',
      voided: false,
      affectsStock: false,
      ...stamp,
    })
    saleNumber += 1
    const holder = state.customers.find((item) => item.id === customer.id)
    if (holder) holder.balance += row.amount
  }
  for (const customer of state.customers) {
    if (customer.creditLimit < customer.balance) customer.creditLimit = customer.balance
  }
  state.seq.sale = saleNumber

  if (decisions.includePayables) {
    for (const row of preview.payables) {
      state.payables.push({
        id: uid(),
        date: new Date().toISOString(),
        creditor: row.creditor,
        supplierId: supplierIds.get(compactName(row.creditor)) ?? null,
        concept: row.concept,
        kind: row.kind,
        category: row.kind === 'sueldo' ? 'Sueldos' : row.kind === 'servicio' ? 'Servicios' : row.kind === 'capital' ? 'Capital' : 'Otros',
        original: row.amount,
        balance: row.amount,
        note: 'Importado de CxP',
        ...stamp,
      })
    }
  }

  if (decisions.includeInvestments) {
    for (const row of preview.investments) {
      const supplierId = supplierIds.get(compactName(row.supplier)) ?? null
      state.investments.push({
        id: uid(),
        date: new Date().toISOString(),
        supplierId,
        supplierName: row.supplier,
        amount: row.amount,
        allocated: 0,
        accountId: null,
        payableId: null,
        note: row.label,
        location: row.location,
        ...stamp,
      })
    }
  }

  if (decisions.includeOpeningPnl && preview.openingPnl) {
    state.openingPnl = {
      sales: preview.openingPnl.sales,
      cogs: preview.openingPnl.cogs,
      asOf: decisions.openingPnlDate || '2025-04-18',
      note: 'Totales históricos de Perd y Gan. No tienen fecha por prenda.',
    }
  }

  state.meta = { origin: 'import', importedAt: new Date().toISOString() }
  return state
}
