# Crear archivo Markdown con instrucciones detalladas para Antigravity

import pypandoc

contenido = """

# 🔥 Guía Paso a Paso para Arreglar la Lógica de Caja en Antigravity

Este documento está diseñado específicamente para trabajar dentro de Antigravity.  
Está escrito de forma clara, directa y detallada para evitar errores.

⚠️ Sigue el orden exacto. No saltes pasos.

---

## 🎯 OBJETIVO

Corregir los errores críticos de la lógica de caja sin salir de Antigravity:

- Evitar múltiples cajas abiertas
- Evitar descuadres
- Evitar manipulaciones
- Hacer el sistema estable

---

# ✅ FASE 1 — Validar que no existan múltiples cajas abiertas

## Problema

Actualmente el sistema permite abrir varias cajas.

Esto genera fraude, errores y descuadres.

## Qué debes hacer en Antigravity

### Paso 1

Abre el flujo donde se crea una nueva caja (Open Shift).

### Paso 2

ANTES del paso que crea la caja:
Agrega una consulta a la base de datos:

Buscar registros en `cash_shifts` donde:

- status = "open"
- branch_id = sucursal actual
- opened_by = usuario actual

### Paso 3

Si el resultado NO está vacío:

- Mostrar error:
  "Ya existe una caja abierta."
- Detener el flujo.

### Resultado esperado

Nunca existirá más de una caja abierta por usuario y sucursal.

---

# ✅ FASE 2 — Corregir la caja activa

## Problema

El sistema puede traer una caja abierta incorrecta.

## Qué hacer

En todos los flujos donde uses “caja activa”:

Agregar filtros:

- branch_id
- opened_by

Nunca buscar solo por status.

---

# ✅ FASE 3 — Evitar descuadres (el error más peligroso)

## Problema

El balance se actualiza con:

1. Leer balance
2. Sumar o restar
3. Guardar

Esto falla cuando hay ventas simultáneas.

## Qué hacer en Antigravity

En vez de leer el balance:

Usar una actualización directa:

Actualizar `expected_balance` con una operación matemática:

Ejemplo:
expected_balance = expected_balance + monto

Esto debe hacerse en UN solo paso.

⚠️ Nunca:

- Leer primero.
- Luego calcular.

Siempre:
Actualizar directamente.

---

# ✅ FASE 4 — No confiar en el total enviado

## Problema

El sistema usa el total del frontend.

Esto puede ser manipulado.

## Qué hacer

Cuando registres una venta:

1. Obtener los productos del pedido.
2. Calcular el total dentro del flujo.
3. Usar ese total para la caja.

Nunca confiar en valores externos.

---

# ✅ FASE 5 — Manejar devoluciones

## Problema

Las devoluciones no ajustan la caja.

## Qué hacer

Crear un flujo nuevo:

### Refund

Este flujo debe:

- Buscar la venta.
- Ver método de pago.
- Si fue efectivo:
  Restar el monto al balance.
- Registrar movimiento.

Si fue tarjeta:
No tocar la caja física.

---

# ✅ FASE 6 — Validaciones obligatorias

Agregar en todos los flujos:

✔ Monto debe ser mayor que 0  
✔ Tipo de movimiento válido  
✔ Caja abierta  
✔ Usuario autorizado  
✔ Método de pago correcto

Si falla algo:
Bloquear acción.

---

# ✅ FASE 7 — Bloquear movimientos después del cierre

## Problema

Se pueden registrar movimientos después de cerrar.

## Qué hacer

Antes de cualquier movimiento:
Buscar la caja.

Si status != "open":
Bloquear.

---

# ✅ FASE 8 — Auditoría básica

En cada movimiento guardar:

- Usuario
- Fecha
- Motivo
- Tipo
- Método de pago

Esto protege contra fraude.

---

# ✅ FASE 9 — Test manual de estrés

Haz esta prueba:

1. Abre una caja.
2. Desde 2 dispositivos:
   - Registra 10 ventas al mismo tiempo.
3. Revisa el balance.

Debe coincidir exactamente.

Si no:
Algo sigue mal.

---

# 🚀 RESULTADO FINAL

Si todo está correcto:

- No habrá descuadres.
- No habrá múltiples cajas.
- No habrá manipulaciones.
- El sistema será estable.
- Listo para producción.

---

# ⚠️ CONSEJO FINAL

No intentes automatizar todo en Antigravity.

Usa la plataforma solo para:

- Flujos
- UI
- Automatizaciones

Pero mantén siempre control lógico.

Este enfoque evita perder tiempo y dinero.

"""

ruta = "/mnt/data/instrucciones_antigravity_caja.md"

pypandoc.convert_text(
contenido,
'md',
format='md',
outputfile=ruta,
extra_args=['--standalone']
)
