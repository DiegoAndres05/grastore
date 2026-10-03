import type { PayMethod } from '../types'

export const CATEGORIES = [
  'Camisetas',
  'Hoodies',
  'Jeans',
  'Gorras',
  'Tenis',
  'Accesorios',
] as const

export const COLORS = [
  'Marfil',
  'Negro',
  'Arena',
  'Olivo',
  'Burdeos',
  'Blanco',
  'Índigo',
  'Café',
  'Cielo',
  'Camel',
]

export const SWATCH: Record<string, string> = {
  Marfil: '#efe6d6',
  Negro: '#1c1c1c',
  Arena: '#d9c7a6',
  Olivo: '#5d6848',
  Burdeos: '#6f3038',
  Blanco: '#f4f4f1',
  Índigo: '#2c3e66',
  Café: '#6b4b34',
  Cielo: '#b7c9d6',
  Camel: '#c4a574',
}

export const METHOD_LABEL: Record<PayMethod, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito',
}

export function swatch(color: string) {
  return SWATCH[color] ?? '#c4b39a'
}

export function nextSku(skus: string[]) {
  const nums = skus.map((sku) => Number(sku.replace(/[^\d]/g, ''))).filter((n) => Number.isFinite(n))
  const max = nums.length ? Math.max(...nums) : 100
  return `GR-${max + 1}`
}

export function norm(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}
