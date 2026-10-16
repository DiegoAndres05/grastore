import * as XLSX from 'xlsx'
import { backupPayload } from './book'
import { balanceSheet, profitAndLoss, type Range } from './accounting'
import { METHOD_LABEL } from './catalog'
import { ledgerRows } from './money'
import type { State } from '../types'

export type SheetRows = { name: string; rows: Record<string, string | number>[] }

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function workbookBlob(sheets: SheetRows[]) {
  const book = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const rows = sheet.rows.length ? sheet.rows : [{ Nota: 'Sin datos' }]
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), sheet.name.slice(0, 31))
  }
  const data = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function csvBlob(rows: Record<string, string | number>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nota: 'Sin datos' }])
  return new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8' })
}

export function saveXlsx(filename: string, sheets: SheetRows[]) {
  download(filename, workbookBlob(sheets))
}

export function downloadBackup(state: State) {
  const blob = new Blob([JSON.stringify(backupPayload(state), null, 2)], { type: 'application/json' })
  download(`grastore-respaldo-${new Date().toISOString().slice(0, 10)}.json`, blob)
}

export function saveCsv(filename: string, rows: Record<string, string | number>[]) {
  download(filename, csvBlob(rows))
}

export function inventoryRows(state: State) {
  return state.products.map((product) => ({
    SKU: product.sku,
    Nombre: product.name,
    Tipo: product.category,
    Color: product.color,
    Talla: product.size,
    Costo: product.cost,
    Precio: product.price,
    Existencias: product.stock,
    Apartadas: product.reserved ?? 0,
    Ubicacion: product.location ?? '',
    Marca: product.brand ?? '',
    Activa: product.active ? 'Sí' : 'No',
  }))
}

export function salesRows(state: State) {
  return state.sales.map((sale) => ({
    Ticket: sale.number,
    Fecha: sale.date,
    Cliente: sale.customerName,
    Total: sale.total,
    Pagado: sale.paid,
    Saldo: sale.balance,
    Medio: METHOD_LABEL[sale.method] ?? sale.method,
    Estado: sale.voided ? 'Anulada' : sale.kind === 'opening' ? 'Saldo inicial' : sale.balance > 0 ? 'Por cobrar' : 'Pagada',
    Corte: sale.dueDate ?? '',
    Nota: sale.note,
  }))
}

export function receivableRows(state: State) {
  const sales = state.sales
    .filter((sale) => !sale.voided && sale.balance > 0)
    .map((sale) => ({
      Tipo: sale.kind === 'opening' ? 'Saldo inicial' : 'Venta',
      Quien: sale.customerName,
      Documento: sale.number,
      Saldo: sale.balance,
      Corte: sale.dueDate ?? '',
    }))
  const layaways = state.layaways
    .filter((item) => item.status === 'abierto' && item.balance > 0)
    .map((item) => ({ Tipo: 'Plan separe', Quien: item.customerName, Documento: item.number, Saldo: item.balance, Corte: item.dueDate ?? '' }))
  const loans = state.loans
    .filter((loan) => loan.balance > 0)
    .map((loan) => ({ Tipo: 'Préstamo', Quien: loan.person, Documento: loan.id.slice(0, 8), Saldo: loan.balance, Corte: loan.dueDate ?? '' }))
  return [...sales, ...layaways, ...loans]
}

export function payableRows(state: State) {
  return state.payables.map((payable) => ({
    Acreedor: payable.creditor,
    Concepto: payable.concept,
    Clase: payable.kind,
    Original: payable.original,
    Saldo: payable.balance,
    Fecha: payable.date,
  }))
}

export function ledgerRowsExport(state: State) {
  return state.accounts.flatMap((account) => {
    const opening = [{ Cuenta: account.name, Fecha: '', Tipo: 'Saldo inicial', Entra: account.openingBalance, Sale: 0, Saldo: account.openingBalance, Detalle: '' }]
    let shown = account.openingBalance
    const moves = ledgerRows(state, account.id).map((movement) => {
      shown = movement.balance
      return {
        Cuenta: account.name,
        Fecha: movement.date,
        Tipo: movement.kind,
        Entra: movement.direction === 'in' ? movement.amount : 0,
        Sale: movement.direction === 'out' ? movement.amount : 0,
        Saldo: shown,
        Detalle: `${movement.counterparty} ${movement.note}`.trim(),
      }
    })
    return [...opening, ...moves]
  })
}

export function pnlRows(state: State, range: Range) {
  const report = profitAndLoss(state, range)
  const sheet = balanceSheet(state)
  return [
    { Concepto: 'Ventas', Valor: report.netSales },
    { Concepto: 'Costo de venta', Valor: report.cogs },
    { Concepto: 'Utilidad bruta', Valor: report.grossProfit },
    { Concepto: 'Gastos', Valor: report.expenseTotal },
    { Concepto: 'Utilidad', Valor: report.profit },
    { Concepto: 'Caja y bancos', Valor: sheet.cash },
    { Concepto: 'Cartera', Valor: sheet.receivable.total },
    { Concepto: 'Inventario', Valor: sheet.inventory.total },
    { Concepto: 'Por pagar', Valor: sheet.liabilities },
    { Concepto: 'Patrimonio', Valor: sheet.equity },
  ]
}
