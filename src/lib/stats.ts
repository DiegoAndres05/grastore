import { isRetailSale } from './format'
import type { Sale } from '../types'

export type Grain = 'dia' | 'semana' | 'mes'

export type Bucket = {
  start: Date
  end: Date
  label: string
  total: number
  tickets: number
  units: number
  cost: number
}

const spans: Record<Grain, number[]> = {
  dia: [7, 14, 30],
  semana: [4, 8, 12],
  mes: [3, 6, 12],
}

export function spanOptions(grain: Grain) {
  return spans[grain]
}

export function defaultSpan(grain: Grain) {
  return grain === 'dia' ? 14 : grain === 'semana' ? 8 : 6
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date: Date) {
  const next = startOfDay(date)
  const day = next.getDay()
  next.setDate(next.getDate() - (day === 0 ? 6 : day - 1))
  return next
}

function inRange(iso: string, start: Date, end: Date) {
  const time = new Date(iso).getTime()
  return time >= start.getTime() && time < end.getTime()
}

function monthLabel(date: Date, withYear: boolean) {
  const raw = new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(date).replace('.', '')
  const month = raw.charAt(0).toUpperCase() + raw.slice(1)
  return withYear ? `${month} ${String(date.getFullYear()).slice(2)}` : month
}

export function buildBuckets(grain: Grain, count: number, now = new Date()) {
  if (grain === 'dia') {
    const today = startOfDay(now)
    return Array.from({ length: count }, (_, index) => {
      const start = addDays(today, -(count - 1 - index))
      return {
        start,
        end: addDays(start, 1),
        label: new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(start),
      }
    })
  }

  if (grain === 'semana') {
    const thisWeek = startOfWeek(now)
    return Array.from({ length: count }, (_, index) => {
      const start = addDays(thisWeek, -(count - 1 - index) * 7)
      return {
        start,
        end: addDays(start, 7),
        label: new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(start),
      }
    })
  }

  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const months = Array.from({ length: count }, (_, index) => {
    const start = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - (count - 1 - index), 1)
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) }
  })
  const years = new Set(months.map((month) => month.start.getFullYear()))
  return months.map((month) => ({
    ...month,
    label: monthLabel(month.start, years.size > 1),
  }))
}

function fill(sales: Sale[], frame: { start: Date; end: Date; label: string }): Bucket {
  const inside = sales.filter((sale) => isRetailSale(sale) && inRange(sale.date, frame.start, frame.end))
  return {
    ...frame,
    total: inside.reduce((sum, sale) => sum + sale.total, 0),
    tickets: inside.length,
    units: inside.reduce((sum, sale) => sum + sale.lines.reduce((qty, line) => qty + line.qty, 0), 0),
    cost: inside.reduce((sum, sale) => sum + sale.lines.reduce((cost, line) => cost + line.cost * line.qty, 0), 0),
  }
}

export function series(sales: Sale[], grain: Grain, count: number, now = new Date()) {
  const frames = buildBuckets(grain, count, now)
  const buckets = frames.map((frame) => fill(sales, frame))
  const start = frames[0].start
  const end = frames[frames.length - 1].end
  const span = end.getTime() - start.getTime()
  const previousFrames = buildBuckets(grain, count, new Date(start.getTime() - 1))
  const previous = previousFrames.map((frame) => fill(sales, frame))
  const currentSales = sales.filter((sale) => inRange(sale.date, start, end))
  return { buckets, previous, currentSales, start, end: new Date(end.getTime() - 1), span }
}

export function rangeLabel(start: Date, end: Date) {
  const format = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
  return `${format.format(start)} – ${format.format(end)}`
}

export function topProducts(sales: Sale[], limit = 5) {
  const map = new Map<string, { name: string; detail: string; total: number; units: number }>()
  for (const sale of sales.filter(isRetailSale)) {
    for (const line of sale.lines) {
      const key = `${line.productId}`
      const current = map.get(key) ?? { name: line.name, detail: `${line.color} · ${line.size}`, total: 0, units: 0 }
      current.total += line.price * line.qty
      current.units += line.qty
      map.set(key, current)
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit)
}

export function byMethod(sales: Sale[]) {
  const map = new Map<string, number>()
  for (const sale of sales.filter(isRetailSale)) {
    if (sale.payments && sale.payments.length > 0) {
      for (const part of sale.payments) map.set(part.method, (map.get(part.method) ?? 0) + part.amount)
      if (sale.balance > 0) map.set('credito', (map.get('credito') ?? 0) + sale.balance)
    } else {
      map.set(sale.method, (map.get(sale.method) ?? 0) + sale.total)
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export function byCategory(sales: Sale[], categories: Map<string, string>) {
  const map = new Map<string, number>()
  for (const sale of sales.filter(isRetailSale)) {
    for (const line of sale.lines) {
      const category = categories.get(line.productId) ?? 'Otras'
      map.set(category, (map.get(category) ?? 0) + line.qty * line.price)
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}
