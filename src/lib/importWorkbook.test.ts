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
    ['', 'EJ-100', 'NEGRO', 'L', 'BUZO', 1, 0, 1, 0, 11_111, 11_111, 22_222],
    ['', 'EJ-100', 'NEGRO', 'L', 'BUZO', 1, 0, 1, 0, 11_111, 11_111, 22_222],
    ['', 'EJ-100', 'ROJA', 'M', 'BUZO', 1, 0, 1, 0, 33_333, 33_333, 44_444],
    ['', 'EJ-100', 'NEGRO', 'L', 'BUZO', 1, 1, 0, 11_111, 11_111, 0, 22_222, '', 18_181, 'Cliente Ejempl'],
    ['', 'ACCESORIO-EJ', 'NEGRO', 'U', 'ACCESORIO', 1, 1, 0, 7_777, 7_777, 0, 8_888, '', 8_888, 'PAGO TATUAJE'],
    ['BODEGA', 'SHORT-EJEMPLO', 'OK', 'OK', 'SHORT', 1, 0, 1, 0, 22_223, 22_223, 55_555],
    ['', 'INVERSION TALLER', '', '', '', '', '', '', '', '', 13_579],
  ])
  const cxc = XLSX.utils.aoa_to_sheet([
    [],
    [],
    ['', 'Cliente Ejemplo', 54_321, new Date('2026-10-30T00:00:00Z')],
    ['', 'Cliente Separe', 24_680, 'PLAN SEPA'],
    ['', 'Prestatario Ejemplo', 97_531, 'PRESTAMO'],
    ['', 'PAGO TATUAJE', 0, ''],
    ['', 'CxC', 176_532],
  ])
  const cxp = XLSX.utils.aoa_to_sheet([
    [],
    [],
    ['', 'Servicio local', 11_223],
    ['', 'Inyec Socio Ejemplo', 33_445],
    ['', 'Total', 44_668],
  ])
  const cash = XLSX.utils.aoa_to_sheet([
    [],
    ['', '', 'NEQUI', '', '', '', '', '', '', 'EFECTIVO', '', '', '', '', '', '', 'BANCOLOMBIA'],
    [],
    ['', '', '', 'CONSIGNACIONES', 'RETIROS', 'SALDO', '', '', '', '', 'MONTO', 'RETIROS', 'SALDO', '', '', '', '', 'MONTO', 'RETIROS', 'SALDO'],
    ['', '', '', '', '', 8_642, '', '', '', '', '', '', 1_357, '', '', '', '', '', '', 0],
  ])
  const pnl = XLSX.utils.aoa_to_sheet([
    [],
    [],
    [],
    [],
    ['', '', 'VENTAS', '', 67_890],
    [],
    ['', '', 'COSTO DE V', '', 55_555],
    [],
    ['', '', 'GANANCIA', '', 12_335],
  ])
  const balance = XLSX.utils.aoa_to_sheet([[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], ['', 'PATRIMONIO', '', '', 233_220]])
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
    expect(preview.merges.some((item) => item.from === 'Cliente Ejempl' && item.into === 'Cliente Ejemplo')).toBe(true)
    expect(preview.excluded.some((item) => item.name === 'Pago Tatuaje')).toBe(true)
    expect(preview.workbookEquity).toBe(233_220)

    const decisions = defaultDecisions(preview)
    expect(decisions.merges.every((item) => item.accept === false)).toBe(true)
    const state = importBook(preview, decisions)
    expect(state.products.reduce((sum, product) => sum + product.stock, 0)).toBe(4)
    expect(state.customers.map((customer) => customer.name)).toContain('Cliente Ejemplo')
    expect(state.customers.map((customer) => customer.name)).toContain('Cliente Ejempl')
    expect(state.customers.map((customer) => customer.name)).not.toContain('Pago Tatuaje')
    expect(state.suppliers.map((supplier) => supplier.name)).toContain('Taller')
    expect(state.layaways).toHaveLength(1)
    expect(state.loans).toHaveLength(1)
    expect(state.sales.some((sale) => sale.kind === 'opening')).toBe(true)

    const sheet = balanceSheet(state)
    expect(sheet.inventory.garments).toBe(11_111 * 2 + 33_333 + 22_223)
    expect(sheet.inventory.investments).toBe(13_579)
    expect(sheet.cash).toBe(8_642 + 1_357)
    expect(sheet.receivable.total).toBe(54_321 + 24_680 + 97_531)
    expect(sheet.liabilities).toBe(11_223 + 33_445)
    expect(sheet.equity).toBe(sheet.assets - sheet.liabilities)
    expect(sheet.equity).toBe(233_220)

    const merged = importBook(preview, { ...decisions, merges: decisions.merges.map((item) => ({ ...item, accept: true })) })
    expect(merged.customers.map((customer) => customer.name)).toContain('Cliente Ejemplo')
    expect(merged.customers.map((customer) => customer.name)).not.toContain('Cliente Ejempl')
    expect(balanceSheet(merged).equity).toBe(233_220)

    const report = profitAndLoss(state, { from: '2025-01-01', to: '2025-12-31' })
    expect(report.openingSales).toBe(67_890)
    expect(report.profit).toBe(12_335)
  })
})

const workbookPath = process.env.GRASTORE_XLSX

describe.skipIf(!workbookPath)('libro real', () => {
  it('cuadra el patrimonio con el balance del Excel', () => {
    const preview = parseWorkbook(readFileSync(workbookPath!))
    const state = importBook(preview, defaultDecisions(preview))
    const sheet = balanceSheet(state)
    expect(preview.workbookEquity).not.toBeNull()
    expect(sheet.equity).toBe(preview.workbookEquity)
    expect(sheet.equity).toBe(sheet.assets - sheet.liabilities)
  })
})
