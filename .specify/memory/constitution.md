<!--
Sync Impact Report
Version: 1.0.0 → 1.0.0
Rationale: generación validada contra la plantilla activa; no se realizaron cambios
  semánticos de gobierno.
Modified principles: none
Added sections: none
Removed sections: none
Deferred TODOs: none
Remove this HTML comment before committing the constitution.
-->

# La Grasita Store Constitution

## Core Principles

### I. Un hecho, un asiento

Cada hecho del negocio MUST actualizar, una sola vez, todos los libros que le corresponden.

- Una venta baja el stock, guarda el ticket y el costo de ese momento, entra a caja solo el dinero recibido y deja en cartera el saldo.
- Un abono baja la cartera, entra a la cuenta elegida y MUST NOT crear otra venta.
- Una compra sube el stock y promedia el costo. Si se paga, sale de la caja. Si queda fiada, nace una cuenta por pagar.
- Un pago a proveedor baja esa deuda y la caja. MUST NOT crear otra compra ni un gasto cuando la deuda es de mercancía.
- Un gasto baja la caja y la ganancia neta. Un retiro del dueño baja la caja y MUST NOT contarse como gasto.
- Una transferencia mueve el mismo valor entre dos cuentas y MUST NOT cambiar la plata total.
- Una devolución devuelve la prenda al costo del ticket, cancela lo que se debía y saca de la caja lo ya cobrado.

Rationale: el Excel mezcla celdas sueltas. Si un peso entra en un libro y no en el otro, el balance miente.

### II. Vender no es cobrar

El ingreso MUST ser el total del ticket, con el descuento ya restado. La caja MUST moverse solo cuando entra o sale dinero. El saldo fiado MUST vivir en cartera, no en una cuenta de efectivo, Nequi, Bancolombia o tarjeta.

Los informes de «cómo pagan» MUST separar lo cobrado por cuenta de lo que sigue fiado. El ranking de prendas MUST usar el valor neto después del descuento del ticket.

Rationale: una venta de $100.000 con abono de $40.000 es ingreso de $100.000, caja de $40.000 y cartera de $60.000. Sumar el ticket entero al medio de pago infla la caja.

### III. El inventario es mercancía

El inventario MUST valorarse como unidades activas por su costo. Inversiones, préstamos y saldos personales MUST NOT guardarse como prendas.

El costo y el stock de una prenda ya publicada MUST cambiar solo por compras, ventas y devoluciones. La ficha MUST NOT reescribir esas cifras a mano. Al crear una prenda, el stock inicial MAY registrarse como apertura.

Cada línea de venta MUST conservar el precio y el costo del momento de la venta. La ganancia bruta MUST ser ventas menos ese costo. La columna de «ganancia esperada» del Excel, que resta el saldo del inventario al precio esperado, MUST NOT usarse como utilidad.

Rationale: el total de inventario del Excel incluye cadenas de inversión. Copiarlo como mercancía infla el patrimonio.

### IV. El libro sobrevive al computador

Los libros MUST poder recuperarse fuera del perfil de un navegador. Mientras los datos vivan solo en `localStorage`, el gestor MUST NOT declararse listo para reemplazar el Excel.

El repositorio y los datos de muestra MUST NOT incluir cifras reales del negocio, nombres de deudores del Excel, teléfonos reales ni secretos. La muestra MUST usar personas y montos ficticios.

Rationale: el miedo del negocio es perder el computador. Una pantalla nueva no resuelve esa pérdida.

### V. La historia no se reescribe

Una venta MUST anularse con una devolución, no borrándose. Los abonos y los pagos MUST conservar su registro.

Cambiar el nombre de un cliente MAY actualizar el nombre visible en sus ventas. MUST NOT alterar montos, costos ni pagos ya guardados. MUST NOT eliminar un cliente con saldo ni un proveedor con deuda abierta.

Rationale: corregir un maestro no puede reescribir lo que ya pasó en caja.

## Reglas del libro

La interfaz MUST estar en español de Colombia. El dinero MUST guardarse en pesos enteros, redondeados. La marca visible MUST ser «LA GRASITA STORE».

Las cuentas de dinero son efectivo, Nequi, Bancolombia y tarjeta. Una transferencia nueva MUST nombrar la cuenta de origen y la de destino. Las ventas históricas de la muestra que decían «transferencia» quedan en Nequi solo como dato de demostración.

El sueldo del 25 % MUST NOT calcularse sobre las ventas ni sobre la ganancia bruta. En el Excel es el 25 % de la suma de aumentos diarios de patrimonio del periodo. MUST NOT implementarse hasta que esa base quede confirmada en una especificación.

MUST NOT copiarse la fórmula de patrimonio que resta una celda vacía, ni el ajuste de $328.000 cuyo concepto no está explicado en el libro.

La lógica de venta, abono, compra, pago, gasto, retiro, transferencia y devolución MUST vivir en funciones puras, comprobables sin abrir el navegador.

## Forma de trabajo

Un cambio visible para quien vende MUST probarse en el navegador, en el flujo real, antes de darse por terminado.

Un cambio en esas funciones de libros MUST quedar cubierto por los casos de contado, crédito con abono, abono posterior, compra, pago a proveedor, transferencia, gasto frente a retiro, y devolución.

Una especificación, un plan o una implementación que contradiga un MUST de esta constitución está fuera de cumplimiento. Primero se enmienda la constitución.

## Governance

Esta constitución manda sobre la comodidad de una pantalla y sobre las celdas rotas del Excel.

Las enmiendas se escriben en este archivo. La versión sube así: MAJOR si se quita o se redefine un principio, MINOR si se agrega un principio o una sección, PATCH si solo se aclara el texto. La fecha de ratificación no cambia. La fecha de última enmienda es el día del cambio. El informe de sincronización va al inicio mientras se revisa la enmienda y se retira antes de confirmar el commit.

Toda revisión MUST comprobar que el cambio no deja un peso en un solo libro.

**Version**: 1.0.0 | **Ratified**: 2026-10-12 | **Last Amended**: 2026-10-12
