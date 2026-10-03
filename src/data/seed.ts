import type { Customer, PayMethod, Product, Purchase, Sale, State, Supplier } from '../types'

function iso(daysAgo: number, hour: number, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const products: Product[] = [
  { id: 'p01', sku: 'GR-104', name: 'Camiseta oversized Flow', category: 'Camisetas', color: 'Marfil', size: 'M', cost: 72_000, price: 189_000, stock: 8, minStock: 3, active: true },
  { id: 'p02', sku: 'GR-105', name: 'Camiseta oversized Flow', category: 'Camisetas', color: 'Negro', size: 'M', cost: 72_000, price: 189_000, stock: 5, minStock: 3, active: true },
  { id: 'p03', sku: 'GR-106', name: 'Camiseta oversized Flow', category: 'Camisetas', color: 'Arena', size: 'S', cost: 72_000, price: 189_000, stock: 2, minStock: 3, active: true },
  { id: 'p04', sku: 'GR-130', name: 'Camiseta básica Grasa', category: 'Camisetas', color: 'Blanco', size: 'M', cost: 28_000, price: 89_000, stock: 14, minStock: 4, active: true },
  { id: 'p05', sku: 'GR-131', name: 'Camiseta básica Grasa', category: 'Camisetas', color: 'Negro', size: 'L', cost: 28_000, price: 89_000, stock: 11, minStock: 4, active: true },
  { id: 'p06', sku: 'GR-150', name: 'Camiseta rayas Puerto', category: 'Camisetas', color: 'Cielo', size: 'L', cost: 68_000, price: 179_000, stock: 0, minStock: 2, active: true },
  { id: 'p07', sku: 'GR-210', name: 'Jean baggy Olivo', category: 'Jeans', color: 'Olivo', size: '32', cost: 98_000, price: 259_000, stock: 6, minStock: 2, active: true },
  { id: 'p08', sku: 'GR-211', name: 'Jean baggy Olivo', category: 'Jeans', color: 'Negro', size: '30', cost: 98_000, price: 259_000, stock: 4, minStock: 2, active: true },
  { id: 'p09', sku: 'GR-240', name: 'Jean recto Índigo', category: 'Jeans', color: 'Índigo', size: '30', cost: 88_000, price: 229_000, stock: 6, minStock: 2, active: true },
  { id: 'p10', sku: 'GR-241', name: 'Jean recto Índigo', category: 'Jeans', color: 'Índigo', size: '32', cost: 88_000, price: 229_000, stock: 3, minStock: 2, active: true },
  { id: 'p11', sku: 'GR-330', name: 'Hoodie pesado Miel', category: 'Hoodies', color: 'Burdeos', size: 'S', cost: 175_000, price: 460_000, stock: 3, minStock: 1, active: true },
  { id: 'p12', sku: 'GR-331', name: 'Hoodie pesado Miel', category: 'Hoodies', color: 'Negro', size: 'M', cost: 175_000, price: 460_000, stock: 2, minStock: 1, active: true },
  { id: 'p13', sku: 'GR-340', name: 'Hoodie liso Costa', category: 'Hoodies', color: 'Arena', size: 'M', cost: 110_000, price: 310_000, stock: 4, minStock: 1, active: true },
  { id: 'p14', sku: 'GR-410', name: 'Bomber Noir', category: 'Hoodies', color: 'Negro', size: 'M', cost: 210_000, price: 560_000, stock: 4, minStock: 1, active: true },
  { id: 'p15', sku: 'GR-411', name: 'Bomber Noir', category: 'Hoodies', color: 'Arena', size: 'S', cost: 210_000, price: 560_000, stock: 1, minStock: 1, active: true },
  { id: 'p16', sku: 'GR-430', name: 'Hoodie boxy Invierno', category: 'Hoodies', color: 'Camel', size: 'M', cost: 280_000, price: 720_000, stock: 2, minStock: 1, active: true },
  { id: 'p17', sku: 'GR-520', name: 'Gorra corona GS', category: 'Gorras', color: 'Marfil', size: 'U', cost: 64_000, price: 175_000, stock: 7, minStock: 2, active: true },
  { id: 'p18', sku: 'GR-521', name: 'Gorra corona GS', category: 'Gorras', color: 'Negro', size: 'U', cost: 64_000, price: 175_000, stock: 5, minStock: 2, active: true },
  { id: 'p19', sku: 'GR-610', name: 'Tenis chunky Bruma', category: 'Tenis', color: 'Café', size: '38', cost: 120_000, price: 320_000, stock: 2, minStock: 2, active: true },
  { id: 'p20', sku: 'GR-611', name: 'Tenis chunky Bruma', category: 'Tenis', color: 'Negro', size: '37', cost: 120_000, price: 320_000, stock: 4, minStock: 1, active: true },
  { id: 'p21', sku: 'GR-710', name: 'Cinturón hebilla oro', category: 'Accesorios', color: 'Café', size: 'U', cost: 35_000, price: 98_000, stock: 9, minStock: 3, active: true },
  { id: 'p22', sku: 'GR-720', name: 'Cadena gruesa Sol', category: 'Accesorios', color: 'Burdeos', size: 'U', cost: 22_000, price: 72_000, stock: 1, minStock: 3, active: true },
]

const people: Customer[] = [
  { id: 'c-valentina', name: 'Valentina Rojas', phone: '310 482 1190', email: 'vale.rojas@correo.com', city: 'Bogotá', creditLimit: 2_500_000, balance: 0, since: iso(420, 10) },
  { id: 'c-camilo', name: 'Camilo Herrera', phone: '315 220 8841', email: 'camilo.herrera@correo.com', city: 'Medellín', creditLimit: 1_500_000, balance: 0, since: iso(300, 10) },
  { id: 'c-mariana', name: 'Mariana Duque', phone: '301 778 4412', email: 'mariana.duque@correo.com', city: 'Bogotá', creditLimit: 1_000_000, balance: 0, since: iso(180, 10) },
  { id: 'c-andres', name: 'Andrés Peña', phone: '320 664 9033', email: 'andres.pena@correo.com', city: 'Cali', creditLimit: 800_000, balance: 0, since: iso(90, 10) },
  { id: 'c-luisa', name: 'Luisa Cárdenas', phone: '312 909 2276', email: 'luisa.cardenas@correo.com', city: 'Bogotá', creditLimit: 1_800_000, balance: 0, since: iso(260, 10) },
  { id: 'c-sofia', name: 'Sofía Beltrán', phone: '318 441 7750', email: 'sofia.beltran@correo.com', city: 'Cartagena', creditLimit: 1_200_000, balance: 0, since: iso(40, 10) },
  { id: 'c-julian', name: 'Julián Mora', phone: '304 118 6629', email: 'julian.mora@correo.com', city: 'Bucaramanga', creditLimit: 1_000_000, balance: 0, since: iso(70, 10) },
  { id: 'c-elena', name: 'Elena Vargas', phone: '316 550 2284', email: 'elena.vargas@correo.com', city: 'Bogotá', creditLimit: 900_000, balance: 0, since: iso(150, 10) },
  { id: 'c-mateo', name: 'Mateo Gil', phone: '311 673 4408', email: 'mateo.gil@correo.com', city: 'Medellín', creditLimit: 700_000, balance: 0, since: iso(20, 10) },
]

const suppliers: Supplier[] = [
  { id: 's-valle', name: 'Textiles del Valle', contact: 'Helena Ortiz', phone: '602 555 0188', city: 'Cali', specialty: 'Lino y algodón' },
  { id: 's-luna', name: 'Confecciones Luna', contact: 'Pedro Nieto', phone: '604 555 0144', city: 'Medellín', specialty: 'Vestidos y faldas' },
  { id: 's-cueros', name: 'Cueros Andinos', contact: 'Rita Salas', phone: '601 555 0170', city: 'Bogotá', specialty: 'Calzado y cinturones' },
  { id: 's-seda', name: 'Seda Oriente', contact: 'Ana Kim', phone: '601 555 0192', city: 'Bogotá', specialty: 'Seda y abrigos' },
]

type Draft = {
  daysAgo: number
  hour: number
  minute?: number
  customerId?: string
  method: PayMethod
  paid?: number
  lines: { sku: string; qty: number }[]
}

const drafts: Draft[] = [
  { daysAgo: 13, hour: 11, minute: 20, method: 'efectivo', lines: [{ sku: 'GR-210', qty: 1 }, { sku: 'GR-130', qty: 1 }] },
  { daysAgo: 13, hour: 17, minute: 5, customerId: 'c-mariana', method: 'tarjeta', lines: [{ sku: 'GR-104', qty: 1 }] },
  { daysAgo: 12, hour: 12, minute: 40, customerId: 'c-mateo', method: 'tarjeta', lines: [{ sku: 'GR-331', qty: 1 }] },
  { daysAgo: 11, hour: 11, minute: 10, method: 'efectivo', lines: [{ sku: 'GR-710', qty: 1 }, { sku: 'GR-131', qty: 1 }] },
  { daysAgo: 11, hour: 16, minute: 30, customerId: 'c-luisa', method: 'efectivo', lines: [{ sku: 'GR-520', qty: 1 }] },
  { daysAgo: 10, hour: 13, minute: 15, customerId: 'c-elena', method: 'transferencia', lines: [{ sku: 'GR-105', qty: 1 }, { sku: 'GR-211', qty: 1 }] },
  { daysAgo: 9, hour: 15, customerId: 'c-camilo', method: 'tarjeta', lines: [{ sku: 'GR-410', qty: 1 }] },
  { daysAgo: 8, hour: 12, minute: 10, customerId: 'c-andres', method: 'efectivo', lines: [{ sku: 'GR-240', qty: 1 }] },
  { daysAgo: 8, hour: 18, minute: 20, method: 'efectivo', lines: [{ sku: 'GR-521', qty: 1 }] },
  { daysAgo: 7, hour: 11, minute: 45, method: 'efectivo', lines: [{ sku: 'GR-105', qty: 1 }, { sku: 'GR-106', qty: 1 }] },
  { daysAgo: 7, hour: 16, minute: 50, customerId: 'c-sofia', method: 'tarjeta', lines: [{ sku: 'GR-611', qty: 1 }] },
  { daysAgo: 6, hour: 12, minute: 30, customerId: 'c-julian', method: 'credito', paid: 0, lines: [{ sku: 'GR-340', qty: 1 }] },
  { daysAgo: 5, hour: 15, minute: 10, customerId: 'c-valentina', method: 'credito', paid: 0, lines: [{ sku: 'GR-411', qty: 1 }, { sku: 'GR-720', qty: 1 }] },
  { daysAgo: 4, hour: 11, method: 'efectivo', lines: [{ sku: 'GR-211', qty: 1 }] },
  { daysAgo: 4, hour: 17, minute: 40, customerId: 'c-mateo', method: 'tarjeta', lines: [{ sku: 'GR-106', qty: 1 }, { sku: 'GR-520', qty: 1 }] },
  { daysAgo: 3, hour: 16, minute: 5, customerId: 'c-luisa', method: 'credito', paid: 200_000, lines: [{ sku: 'GR-330', qty: 1 }] },
  { daysAgo: 2, hour: 12, minute: 25, customerId: 'c-camilo', method: 'tarjeta', lines: [{ sku: 'GR-610', qty: 1 }, { sku: 'GR-710', qty: 1 }] },
  { daysAgo: 2, hour: 18, minute: 10, method: 'efectivo', lines: [{ sku: 'GR-105', qty: 1 }] },
  { daysAgo: 1, hour: 11, minute: 30, customerId: 'c-andres', method: 'tarjeta', lines: [{ sku: 'GR-210', qty: 1 }] },
  { daysAgo: 1, hour: 15, minute: 45, method: 'efectivo', lines: [{ sku: 'GR-131', qty: 2 }] },
  { daysAgo: 1, hour: 19, minute: 5, customerId: 'c-elena', method: 'transferencia', lines: [{ sku: 'GR-340', qty: 1 }] },
  { daysAgo: 0, hour: 10, minute: 20, method: 'efectivo', lines: [{ sku: 'GR-104', qty: 1 }, { sku: 'GR-710', qty: 1 }] },
  { daysAgo: 0, hour: 12, minute: 50, customerId: 'c-sofia', method: 'tarjeta', lines: [{ sku: 'GR-410', qty: 1 }] },
  { daysAgo: 0, hour: 14, minute: 15, method: 'transferencia', lines: [{ sku: 'GR-240', qty: 1 }, { sku: 'GR-130', qty: 1 }] },
  { daysAgo: 0, hour: 16, minute: 40, customerId: 'c-mariana', method: 'efectivo', lines: [{ sku: 'GR-520', qty: 1 }, { sku: 'GR-720', qty: 1 }] },
]

function mustProduct(sku: string) {
  const product = products.find((item) => item.sku === sku)
  if (!product) throw new Error(`SKU de muestra no encontrado: ${sku}`)
  return product
}

function mix(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function buildHistory(): Sale[] {
  const skus = ['GR-104', 'GR-130', 'GR-131', 'GR-210', 'GR-240', 'GR-330', 'GR-410', 'GR-520', 'GR-611', 'GR-710']
  const methods: PayMethod[] = ['efectivo', 'tarjeta', 'transferencia']
  const buyers = [undefined, 'c-camilo', 'c-sofia', 'c-mateo', 'c-elena', 'c-andres', 'c-mariana']
  const sales: Sale[] = []

  for (let daysAgo = 800; daysAgo >= 14; daysAgo -= 1) {
    const when = new Date(iso(daysAgo, 12))
    const weekend = when.getDay() === 0 || when.getDay() === 6
    const wave = 0.45 + 0.35 * Math.sin(daysAgo / 17)
    if (mix(daysAgo) > (weekend ? wave + 0.25 : wave)) continue
    const count = 1 + Math.floor(mix(daysAgo + 4) * (weekend ? 3 : 2))
    for (let index = 0; index < count; index += 1) {
      const product = mustProduct(skus[Math.floor(mix(daysAgo * 13 + index) * skus.length)])
      const qty = mix(daysAgo + index * 9) > 0.86 ? 2 : 1
      const method = methods[Math.floor(mix(daysAgo + index * 3) * methods.length)]
      const customerId = buyers[Math.floor(mix(daysAgo * 5 + index) * buyers.length)]
      const customer = people.find((item) => item.id === customerId)
      const total = product.price * qty
      sales.push({
        id: `sale-h-${daysAgo}-${index}`,
        number: `V-${860 + sales.length}`,
        date: iso(daysAgo, 11 + index * 3, Math.floor(mix(daysAgo + index) * 50)),
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? 'Mostrador',
        lines: [{
          productId: product.id,
          sku: product.sku,
          name: product.name,
          color: product.color,
          size: product.size,
          qty,
          price: product.price,
          cost: product.cost,
        }],
        discount: 0,
        total,
        method,
        paid: total,
        balance: 0,
        tendered: method === 'efectivo' ? total : null,
        note: '',
      })
    }
  }

  return sales
}

function buildSales(): Sale[] {
  return drafts.map((draft, index) => {
    const lines = draft.lines.map((line) => {
      const product = mustProduct(line.sku)
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        color: product.color,
        size: product.size,
        qty: line.qty,
        price: product.price,
        cost: product.cost,
      }
    })
    const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
    const customer = people.find((item) => item.id === draft.customerId)
    const paid = draft.method === 'credito' ? (draft.paid ?? 0) : total
    return {
      id: `sale-${index + 1}`,
      number: `V-${1040 + index}`,
      date: iso(draft.daysAgo, draft.hour, draft.minute ?? 0),
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? 'Mostrador',
      lines,
      discount: 0,
      total,
      method: draft.method,
      paid,
      balance: total - paid,
      tendered: draft.method === 'efectivo' ? total : null,
      note: '',
    }
  })
}

type BuyDraft = {
  daysAgo: number
  hour: number
  supplierId: string
  note: string
  lines: { sku: string; qty: number }[]
}

const buyDrafts: BuyDraft[] = [
  { daysAgo: 12, hour: 9, supplierId: 's-seda', note: 'Seda y abrigos de temporada', lines: [{ sku: 'GR-720', qty: 8 }, { sku: 'GR-430', qty: 2 }] },
  { daysAgo: 8, hour: 9, supplierId: 's-valle', note: 'Reposición de lino', lines: [{ sku: 'GR-104', qty: 6 }, { sku: 'GR-210', qty: 4 }] },
  { daysAgo: 6, hour: 10, supplierId: 's-luna', note: 'Pedido de vestidos y faldas', lines: [{ sku: 'GR-330', qty: 3 }, { sku: 'GR-520', qty: 5 }] },
  { daysAgo: 2, hour: 9, supplierId: 's-cueros', note: 'Calzado y cinturones', lines: [{ sku: 'GR-610', qty: 4 }, { sku: 'GR-710', qty: 6 }] },
]

function buildPurchases(): Purchase[] {
  return buyDrafts.map((draft, index) => {
    const supplier = suppliers.find((item) => item.id === draft.supplierId)
    if (!supplier) throw new Error('Proveedor de muestra no encontrado')
    const lines = draft.lines.map((line) => {
      const product = mustProduct(line.sku)
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        color: product.color,
        size: product.size,
        qty: line.qty,
        cost: product.cost,
      }
    })
    return {
      id: `buy-${index + 1}`,
      number: `C-${String(180 + index).padStart(4, '0')}`,
      date: iso(draft.daysAgo, draft.hour),
      supplierId: supplier.id,
      supplierName: supplier.name,
      lines,
      total: lines.reduce((sum, line) => sum + line.cost * line.qty, 0),
      note: draft.note,
    }
  })
}

export function createSeed(): State {
  const sales = [...buildHistory(), ...buildSales()]
  sales.forEach((sale, index) => {
    sale.number = `V-${1000 + index}`
  })
  const customers = people.map((customer) => ({
    ...customer,
    balance: sales.filter((sale) => sale.customerId === customer.id).reduce((sum, sale) => sum + sale.balance, 0),
  }))
  const collections = sales
    .filter((sale) => sale.method === 'credito' && sale.paid > 0 && sale.customerId)
    .map((sale) => ({
      id: `col-${sale.id}`,
      date: sale.date,
      customerId: sale.customerId as string,
      customerName: sale.customerName,
      amount: sale.paid,
      method: 'efectivo' as const,
      note: 'Abono inicial',
      saleId: sale.id,
    }))

  return {
    products,
    customers,
    suppliers,
    sales: [...sales].reverse(),
    purchases: [...buildPurchases()].reverse(),
    collections,
    seq: { sale: 1000 + sales.length, purchase: 180 + buyDrafts.length },
  }
}
