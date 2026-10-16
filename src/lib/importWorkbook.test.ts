import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { balanceSheet, profitAndLoss } from './accounting'
import { defaultDecisions, importBook, parseWorkbook } from './importWorkbook'

function sheetBook() {
  const inventory = XLSX.utils.aoa_to_sheet([
    [],
    [],
    [],
    [],
    [],
    ['', 'PRODUCTO', 'COLOR', 'TALLA', 'TIPO', 'CANTIDAD', 'VENTAS', 'SALDO', 'COSTO DE VENTA', 'PRECIO X UNID', '$ COMPRADO', '$ ESPERADO', '', '$ VENDIDO', 'COMPRADOR'],
    ['', '#S%UN(A)@L', 'NEGRO', 'L', 'SUETER', 1, 0, 1, 0, 58_000, 58_000, 95_000],
    ['', '#S%UN(A)@L', 'NEGRO', 'L', 'SUETER', 1, 0, 1, 0, 58_000, 58_000, 95_000],
    ['', '#S%UN(A)@M', 'ROJA', 'M', 'SUETER', 1, 0, 1, 0, 40_000, 40_000, 80_000],
    ['', '#S%UN(A)@L', 'NEGRO', 'L', 'SUETER', 1, 1, 0, 58_000, 58_000, 0, 95_000, '', 70_000, 'Andres Suare'],
    ['', 'GORRA', 'NEGRO', 'U', 'GORRA', 1, 1, 0, 10_000, 10_000, 0, 20_000, '', 20_000, 'PAGO TATUAJE'],
    ['BODEGA', 'PANTALONETA DEPORTIVA ECONOMIC', 'ECONOMIC', 'ECONOMIC', 'PANTALONETA', 1, 0, 1, 0, 20_000, 20_000, 35_000],
    ['', 'INVERSION PRAGA', '', '', '', '', '', '', '', '', 100_000],
    ['', '', '', '', '', 4, 1, 3, 0, 0, 276_000, 0, '', 70_000],
  ])
  const cxc = XLSX.utils.aoa_to_sheet([
    [],
    [],
    ['', 'Andres Suarez', 50_000, new Date('2026-10-30T00:00:00Z')],
    ['', 'Willy', 20_000, 'PLAN SEPA'],
    ['', 'Aponte', 10_000, 'PRESTAMO'],
    ['', 'PAGO TATUAJE', 0, ''],
    ['', 'CxC', 80_000],
  ])
  const cxp = XLSX.utils.aoa_to_sheet([
    [],
    [],
    ['', 'Luz', 15_000],
    ['', 'Inyec Tio', 30_000],
    ['', 'Total', 45_000],
  ])
  const cash = XLSX.utils.aoa_to_sheet([
    [],
    ['', '', 'NEQUI', '', '', '', '', '', '', 'EFECTIVO', '', '', '', '', '', '', 'BANCOLOMBIA'],
    [],
    ['', '', '', 'CONSIGNACIONES', 'RETIROS', 'SALDO', '', '', '', '', 'MONTO', 'RETIROS', 'SALDO', '', '', '', '', 'MONTO', 'RETIROS', 'SALDO'],
    ['', '', '', '', '', 8_000, '', '', '', '', '', '', 2_000, '', '', '', '', '', '', 0],
  ])
  const pnl = XLSX.utils.aoa_to_sheet([
    [],
    [],
    [],
    [],
    ['', '', 'VENTAS', '', 70_000],
    [],
    ['', '', 'COSTO DE V', '', 58_000],
    [],
    ['', '', 'GANANCIA', '', 12_000],
  ])
  const balance = XLSX.utils.aoa_to_sheet([[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], ['', 'PATRIMONIO', '', '', 321_000]])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, inventory, 'Inv Actual')
  XLSX.utils.book_append_sheet(book, cxc, 'CxC')
  XLSX.utils.book_append_sheet(book, cxp, 'CxP')
  XLSX.utils.book_append_sheet(book, cash, 'Neq o Efe')
  XLSX.utils.book_append_sheet(book, pnl, 'Perd y Gan')
  XLSX.utils.book_append_sheet(book, balance, 'Balance')
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('importador', () => {
  it('arma inventario, cartera, deudas y un balance que cuadra', () => {
    const preview = parseWorkbook(sheetBook())
    expect(preview.products).toHaveLength(3)
    const negro = preview.products.find((item) => item.color === 'Negro' && item.size === 'L')
    expect(negro?.stock).toBe(2)
    expect(negro?.sku).not.toBe(preview.products.find((item) => item.size === 'M')?.sku)
    expect(preview.products.some((item) => item.color === 'Sin definir')).toBe(true)
    expect(preview.merges.some((item) => item.from === 'Andres Suare' && item.into === 'Andres Suarez')).toBe(true)
    expect(preview.excluded.some((item) => item.name === 'Pago Tatuaje')).toBe(true)
    expect(preview.workbookEquity).toBe(321_000)

    const state = importBook(preview, defaultDecisions(preview))
    expect(state.products.reduce((sum, product) => sum + product.stock, 0)).toBe(4)
    expect(state.customers.map((customer) => customer.name)).toContain('Andres Suarez')
    expect(state.customers.map((customer) => customer.name)).not.toContain('Andres Suare')
    expect(state.customers.map((customer) => customer.name)).not.toContain('Pago Tatuaje')
    expect(state.suppliers.map((supplier) => supplier.name)).toContain('Praga')
    expect(state.layaways).toHaveLength(1)
    expect(state.loans).toHaveLength(1)
    expect(state.sales.some((sale) => sale.kind === 'opening')).toBe(true)

    const sheet = balanceSheet(state)
    expect(sheet.inventory.garments).toBe(58_000 * 2 + 40_000 + 20_000)
    expect(sheet.inventory.investments).toBe(100_000)
    expect(sheet.cash).toBe(10_000)
    expect(sheet.receivable.total).toBe(80_000)
    expect(sheet.liabilities).toBe(45_000)
    expect(sheet.equity).toBe(sheet.assets - sheet.liabilities)
    expect(sheet.equity).toBe(321_000)

    const report = profitAndLoss(state, { from: '2025-01-01', to: '2025-12-31' })
    expect(report.openingSales).toBe(70_000)
    expect(report.profit).toBe(12_000)
  })
})

const workbookPath = process.env.GRASTORE_XLSX

describe.skipIf(!workbookPath)('libro real', () => {
  it('cuadra el patrimonio con el balance del Excel', () => {
    const preview = parseWorkbook(readFileSync(workbookPath!))
    const state = importBook(preview, defaultDecisions(preview))
    const sheet = balanceSheet(state)
    expect(sheet.equity).toBe(22_545_000)
    expect(sheet.assets).toBe(38_808_000)
    expect(sheet.liabilities).toBe(16_263_000)
    expect(sheet.cash).toBe(3_564_000)
    expect(sheet.receivable.total).toBe(7_720_000)
    expect(sheet.inventory.total).toBe(27_524_000)
  })
})
