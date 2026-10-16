# La Grasita Store

Caja, inventario y contabilidad de La Grasita Store (Cartagena), en pesos colombianos. Reemplaza el libro de Excel: inventario, cartera, Nequi, efectivo, Bancolombia, deudas, gastos, balance y pérdidas y ganancias.

La interfaz está en español. Sin configurar un servidor, la app sigue funcionando en **modo local**: todo queda en este navegador, con un aviso arriba. Así el sitio publicado no se cae antes de crear el proyecto de Supabase.

## Qué puede hacer

- Vender con precio por prenda (por encima o por debajo de la lista), fecha, Nequi, efectivo, Bancolombia, tarjeta o crédito con corte del 15 o del 30.
- Apartar con plan separe: el abono reserva la prenda y no se puede vender hasta entregar o cancelar.
- Anular, corregir precios y devolver.
- Ajustar inventario con un motivo. Categorías y colores se editan.
- Compras con detalle, o una inversión por un valor sin prendas (como las filas `INVERSION` del Excel).
- Caja con saldo corrido y traslados entre cuentas.
- Gastos (sueldos, domicilios, envíos, servicios, comida), deudas y sus pagos.
- Aportes y préstamos de capital. Préstamos a terceros, aparte de las ventas.
- Balance: caja + cartera + inventario − por pagar = patrimonio.
- Pérdidas y ganancias por fechas, cierre mensual con sueldo (25% de la utilidad, configurable) y vista por día.
- Importar el `.xlsx` de contabilidad, con vista previa para unir nombres, corregir colores y decidir qué entra.
- Exportar inventario, ventas, cartera, deudas, caja y P y G a Excel o CSV.
- Descargar y restaurar un respaldo JSON.
- Varias personas en el mismo libro cuando Supabase está configurado. Cada registro guarda quién lo creó.

La muestra inventada ya no se carga sola. Solo aparece el botón «Cargar muestra» si el libro está vacío.

## Puesta en marcha para Javier y Emeli

Hace falta una cuenta en [Supabase](https://supabase.com) y acceso al proyecto de Vercel donde está publicado https://grastore.vercel.app.

1. Entra a Supabase y crea un proyecto. Elige una región cercana y guarda la clave de la base de datos.
2. En **SQL Editor**, pega y ejecuta el archivo `supabase/migrations/0001_init.sql`. Crea el libro compartido, los perfiles y las reglas para que solo entre quien tenga usuario.
3. En **Authentication → Sign In / Providers → Email**, déjalo activo. Para entrar apenas se cree la cuenta, apaga **Confirm email**. Si lo dejas encendido, cada persona tiene que abrir el correo antes de poder entrar.
4. En **Project Settings → API** copia:
   - Project URL
   - anon public key (la clave pública, no la `service_role`)
5. En el proyecto de Vercel: **Settings → Environment Variables**. Crea, para Production (y Preview si quieren probar):
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la anon key
6. Redeploy el proyecto (Deployments → el último → Redeploy). Vite mete esas variables en el momento de construir; no basta con guardarlas.
7. Abre https://grastore.vercel.app. Crea la cuenta de Javier y la de Emeli con **Crear una cuenta nueva** (nombre, correo y clave de al menos 6 caracteres). Las dos ven el mismo libro.
8. En **Importar**, sube el Excel de contabilidad. Revisa inventario, nombres y cartera. Al confirmar, el patrimonio debe quedar en **22.545.000** si no cambias los saldos, las deudas ni las inversiones. Descarga antes un respaldo JSON por si acaso.

En local, copia `.env.example` a `.env`, pon las mismas dos variables y corre `npm run dev`.

### Si algo no sincroniza

- El aviso de arriba debe decir «Libro compartido» y el nombre, no «Modo local». Si dice modo local, faltan las variables o no se volvió a desplegar.
- Las dos personas tienen que haber entrado con correo y clave. En modo local cada navegador tiene su propio libro.
- En Supabase → Database → Publications, la tabla `books` debe estar en `supabase_realtime`. El SQL ya la agrega.

## Importar el Excel

El asistente lee las seis hojas (`Inv Actual`, `CxC`, `CxP`, `Neq o Efe`, `Perd y Gan`, `Balance`):

| Del Excel | En GraStore |
|---|---|
| Prendas con ventas = 0 | Fichas con existencias. El código repetido gana un sufijo de color y talla. El nombre se arma con el tipo. |
| Colores que no son colores (`P`, `ECONOMIC`, `JEAN`…) | Quedan en «Sin definir» para corregirlos en la vista previa. `ROJA` y `ROJO` se unen. |
| Compradores y nombres de CxC | Clientes, sin espacios de más. Los parecidos (`Andres Suare` / `Andres Suarez`) se proponen para unir. `PAGO TATUAJE`, `PAUTA`, `PRESTAMO` y similares no entran como personas. |
| Saldo de CxC | Venta a crédito de saldo inicial, con el corte del 15 o del 30. No baja inventario. |
| Plan separe | Apartado con el saldo. El Excel no dice la prenda, así que no reserva stock. |
| Préstamo | Cuenta por cobrar aparte de las ventas. |
| Filas `INVERSION` y `SALDO A FAVOR` | Proveedor por nombre e inversión sin detalle. Entran al inventario del balance, separadas de las prendas. |
| Último saldo de Nequi, efectivo y Bancolombia | Saldo inicial de cada cuenta. No se copian los mil movimientos. |
| CxP | Deudas. `INYEC` queda como capital, `SUELDO` como sueldo, `LUZ` como servicio. |
| Perd y Gan | Opcional. Ventas y costo históricos, con fecha 18 abr 2025 para no mezclarlos con el mes en curso. |

El balance del libro usa el inventario de la celda K, que **suma las prendas en existencia y las filas de inversión**. Esas inversiones no son prendas contadas una a una. GraStore las muestra aparte; la suma es la que cuadra con el Excel.

Con el libro de octubre de 2026, sin cambiar decisiones, la importación da:

| | |
|---|---|
| Efectivo | 212.000 |
| Bancolombia | 0 |
| Nequi | 3.352.000 |
| Caja | 3.564.000 |
| Cartera (crédito + plan separe + préstamos) | 7.720.000 |
| Prendas a costo | 19.565.000 |
| Inversión sin detalle | 7.959.000 |
| Inventario | 27.524.000 |
| Activos | 38.808.000 |
| Por pagar | 16.263.000 |
| Patrimonio | 22.545.000 |

## Desarrollo

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

La lógica de ventas, caja, balance e importación está en `src/lib/logic.ts`, `src/lib/books.ts`, `src/lib/accounting.ts` y `src/lib/importWorkbook.ts`. Las pruebas usan datos sintéticos. No subas el Excel real ni un JSON exportado de la tienda: el repositorio es público y el archivo tiene nombres y cifras de clientes.
