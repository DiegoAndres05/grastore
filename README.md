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
- Varias personas en el mismo libro cuando Supabase está configurado. Hay un dueño, administradores y trabajadores. Cada registro guarda quién lo creó.

La muestra inventada ya no se carga sola. Solo aparece el botón «Cargar muestra» si el libro está vacío.

## Puesta en marcha

Hace falta una cuenta en [Supabase](https://supabase.com) y acceso al proyecto de Vercel donde está publicado https://grastore.vercel.app. Si ya ejecutaste `0001_init.sql` y todavía no pusiste variables en Vercel, sigue desde el paso 2.

1. En Supabase crea el proyecto si aún no existe.
2. En **SQL Editor**, pega y ejecuta `supabase/migrations/0002_roles.sql`. Si el proyecto está nuevo, ejecuta antes `0001_init.sql`. El `0002` agrega roles, cierra el registro público después del primer dueño y, si ya había un libro JSON, lo pasa a tablas. No borres la fila vieja a mano.
3. En **Authentication → Sign In / Providers → Email**, déjalo activo. Para entrar apenas se cree la cuenta, apaga **Confirm email**.
4. En **Project Settings → API** copia:
   - Project URL
   - anon public key
   - service_role key (secreta; no va en el navegador)
5. En Vercel → **Settings → Environment Variables**, para Production (y Preview si quieren probar):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key
6. Redeploy (Deployments → el último → Redeploy). Vite mete las `VITE_` al construir. Las funciones `api/book` y `api/users` leen la service_role solo en el servidor. Sin ese redeploy, el sitio sigue en modo local.
7. Abre https://grastore.vercel.app. La primera persona que use **Crear la cuenta del dueño** queda como dueño. A partir de ahí el registro público se cierra: el dueño crea al resto en **Usuarios**, con clave inicial o invitación.
8. En **Importar**, sube el Excel. El patrimonio debe coincidir con la celda PATRIMONIO de la hoja Balance. Descarga antes un respaldo JSON.

En local, copia `.env.example` a `.env` con las tres variables y corre `npm run dev`. El servidor de Vite atiende `/api/book` y `/api/users`. La service_role no lleva prefijo `VITE_`.

### Roles

| | Dueño | Administrador | Trabajador |
|---|---|---|---|
| Vender, apartar, abonar, clientes, ver existencias | sí | sí | sí |
| Costos, márgenes, caja, gastos, deudas, compras, anular y corregir ventas, ajustes, contabilidad | sí | sí | no |
| Importar, restaurar el libro, vaciarlo | sí | no | no |
| Crear usuarios y cambiar permisos | sí | no | no |

El dueño puede cambiar la matriz de Administrador y Trabajador, y dar o quitar un permiso a una persona. No puede quitarse el rol ni desactivarse. El dueño siempre conserva todos los permisos.

Un trabajador que llame la API no recibe costos, saldos de caja, gastos ni contabilidad: las tablas no se leen desde el navegador. `book_snapshot` arma el libro y lo recorta. Las escrituras pasan por `api/book`, que vuelve a comprobar el permiso con la clave de servicio.

### Si algo no sincroniza

- El aviso de arriba debe decir «Libro compartido» y el nombre, no «Modo local». Si dice modo local, faltan las `VITE_` o no se volvió a desplegar.
- Si entrar funciona pero guardar dice que falta la clave del servidor, falta `SUPABASE_SERVICE_ROLE_KEY` o no se redeployó.
- En modo local cada navegador tiene su propio libro y entra como dueño.
- En Supabase → Database → Publications, la tabla `book_signal` debe estar en `supabase_realtime`. El SQL ya la agrega.
- Si el login dice que el registro está cerrado y en Authentication → Users no hay nadie, la pantalla antigua trataba un error de `signup_open()` como si ya hubiera dueño. Corre `supabase/migrations/0003_signup_open.sql` y vuelve a desplegar. Para ver el estado actual, en el SQL Editor:

```sql
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.profiles where role_id = 'dueno') as duenos,
  public.signup_open() as signup_open;

select
  has_function_privilege('anon', 'public.signup_open()', 'execute') as anon_can_call,
  has_schema_privilege('anon', 'public', 'usage') as anon_can_use_schema;

select id, email, role_id, display_name
from public.profiles
order by created_at;

begin;
set local role anon;
select public.signup_open() as signup_open_as_anon;
rollback;
```

`signup_open` y `signup_open_as_anon` tienen que ser `true` cuando no hay dueño. Si el segundo falla con `permission denied`, falta el `grant` de `0003`.

## Importar el Excel

El asistente lee las seis hojas (`Inv Actual`, `CxC`, `CxP`, `Neq o Efe`, `Perd y Gan`, `Balance`):

| Del Excel | En GraStore |
|---|---|
| Prendas con ventas = 0 | Fichas con existencias. El código repetido gana un sufijo de color y talla. El nombre se arma con el tipo. |
| Colores que no son colores (una nota, una tela, una marca) | Quedan en «Sin definir» para corregirlos en la vista previa. `ROJA` y `ROJO` se unen. |
| Compradores y nombres de CxC | Clientes, sin espacios de más. Los parecidos (`Cliente Ejempl` / `Cliente Ejemplo`) se proponen para unir. `PAGO TATUAJE`, `PAUTA`, `PRESTAMO` y similares no entran como personas. |
| Saldo de CxC | Venta a crédito de saldo inicial, con el corte del 15 o del 30. No baja inventario. |
| Plan separe | Apartado con el saldo. El Excel no dice la prenda, así que no reserva stock. |
| Préstamo | Cuenta por cobrar aparte de las ventas. |
| Filas `INVERSION` y `SALDO A FAVOR` | Proveedor por nombre e inversión sin detalle. Entran al inventario del balance, separadas de las prendas. |
| Último saldo de Nequi, efectivo y Bancolombia | Saldo inicial de cada cuenta. No se copian los mil movimientos. |
| CxP | Deudas. `INYEC` queda como capital, `SUELDO` como sueldo, `LUZ` como servicio. |
| Perd y Gan | Opcional. Ventas y costo históricos, con una fecha anterior al mes en curso para no mezclarlos con lo que se venda ahora. |

El balance del libro usa el inventario de la celda K, que **suma las prendas en existencia y las filas de inversión**. Esas inversiones no son prendas contadas una a una. GraStore las muestra aparte; la suma es la que debe coincidir con el patrimonio de la hoja Balance.

## Desarrollo

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

La lógica de ventas, caja, balance e importación está en `src/lib/logic.ts`, `src/lib/books.ts`, `src/lib/accounting.ts` y `src/lib/importWorkbook.ts`. Las pruebas usan datos sintéticos. No subas el Excel real ni un JSON exportado de la tienda: el repositorio es público y el archivo tiene nombres y cifras de clientes.
