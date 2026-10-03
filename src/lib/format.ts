import type { Sale } from '../types'

export function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function longDate(date = new Date()) {
  const raw = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function dateTime(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function dayStamp(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(iso))
}

export function daysSince(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today - start) / 86_400_000)
}

export function relativeDay(iso: string) {
  const days = daysSince(iso)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

export function isSameDay(iso: string, ref = new Date()) {
  const date = new Date(iso)
  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth() &&
    date.getDate() === ref.getDate()
  )
}

export function isSameMonth(iso: string, ref = new Date()) {
  const date = new Date(iso)
  return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth()
}

export function percent(ratio: number) {
  return `${Math.round(ratio * 100)}%`
}

export function saleStatus(sale: Sale): { label: string; tone: 'ok' | 'warn' | 'danger' } {
  if (sale.balance <= 0) return { label: 'Pagada', tone: 'ok' }
  if (sale.paid > 0) return { label: 'Parcial', tone: 'warn' }
  return { label: 'Pendiente', tone: 'danger' }
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function lineCount(qty: number) {
  return qty === 1 ? '1 prenda' : `${qty} prendas`
}
