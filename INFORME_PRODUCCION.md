# Informe de readiness para producción

**Proyecto:** Oishi (React + Vite + Supabase)  
**Fecha de revisión:** 2026-02-21  
**Resultado ejecutivo:** ❌ **No está listo para producción** en su estado actual.

## Alcance de la revisión

Se revisó el estado de build, calidad estática, riesgos de seguridad y operabilidad básica usando:

- `npm ci`
- `npm run lint`
- `npm run build`
- `npm audit --omit=dev` (con limitación de entorno)
- revisión manual de archivos críticos de auth, configuración y despliegue.

## Hallazgos clave

## 1) Calidad de código bloqueante

`npm run lint` reporta **11 errores** y **12 warnings**. Con este estado, la base no cumple un estándar mínimo de salida a producción.

Errores relevantes detectados:

- `src/context/BusinessContext.jsx`: setState dentro de `useEffect` (riesgo de renders en cascada).
- `src/context/CashContext.jsx`: exportación no compatible con fast refresh.
- `src/features/admin/components/AdminAnalytics.jsx`: componente creado durante render + variable sin uso.
- `src/features/admin/components/AdminClients.jsx`: setState directo dentro de `useEffect`.
- `src/features/admin/components/AdminDangerZone.jsx`: variables `year` y `month` no definidas.
- `src/features/products/components/ProductModal.jsx`: prop `isOpen` declarada pero no usada.

Además, hay múltiples warnings de dependencias de hooks y estabilidad de callbacks en `Admin.jsx`/`AdminSettings.jsx`/`useCashSystem.js`.

**Impacto:** alto (mantenibilidad, bugs de runtime, deuda técnica).

## 2) Riesgo de seguridad / control de acceso admin

En `src/features/admin/pages/Admin.jsx`, cuando el usuario no existe en `admin_users`, actualmente se **permite acceso temporal** y solo se deja un comentario para endurecerlo después.

Esto representa un riesgo directo de autorización incompleta en producción si esa rama queda activa.

**Impacto:** crítico (acceso indebido al panel administrativo).

## 3) Build productivo compila, pero con señal de performance

`npm run build` completa correctamente, pero Vite reporta chunk JS principal grande:

- `dist/assets/index-*.js` ≈ **822 KB** (gzip ≈ 246 KB).

Se recomienda code splitting por rutas y/o `manualChunks`.

**Impacto:** medio (tiempo de carga y experiencia en red móvil).

## 4) Operabilidad y observabilidad insuficientes

Se detecta uso extendido de `console.log/warn/error` en múltiples módulos (admin, pedidos, caja, auth, utilidades) sin estrategia de logging estructurado/centralizado.

**Impacto:** medio (ruido en producción, trazabilidad limitada).

## 5) Riesgo de configuración de entorno

`src/lib/supabase.js` solo advierte en desarrollo si faltan variables de entorno, pero no hay estrategia clara de fail-fast para entornos mal configurados en despliegue.

**Impacto:** medio (fallas silenciosas o degradación funcional en runtime).

## 6) Gobierno del proyecto (documentación y pruebas)

- `README.md` no contiene documentación operativa real.
- No se observa suite de tests automatizados (unitarios/integración/e2e) en la estructura actual.

**Impacto:** alto (difícil validar cambios y operar incidentes con confianza).

## 7) Auditoría de dependencias no verificable en este entorno

`npm audit --omit=dev` falla con `403 Forbidden` del endpoint de advisories del registry, por lo que no fue posible confirmar postura de vulnerabilidades desde esta sesión.

**Impacto:** medio (visibilidad parcial de seguridad de dependencias).

---

## Matriz de readiness (resumen)

- **Seguridad de acceso (RBAC):** ❌
- **Calidad estática (lint):** ❌
- **Compilación de producción:** ⚠️ (compila, pero con warning de tamaño)
- **Performance de bundle:** ⚠️
- **Observabilidad/logging:** ⚠️
- **Documentación operativa:** ❌
- **Testing automatizado:** ❌
- **Higiene de dependencias:** ⚠️ (sin evidencia completa por limitación de audit)

## Recomendaciones priorizadas

### Prioridad 0 (bloqueante antes de go-live)

1. Corregir todos los errores de ESLint y dejar `npm run lint` en verde.
2. Cerrar el bypass de acceso admin en `Admin.jsx` (forzar logout/redirect si no hay rol válido).
3. Definir checklist mínimo de salida: lint + build + smoke test funcional.

### Prioridad 1 (muy recomendable antes de producción)

1. Implementar code splitting por rutas/pestañas del panel admin.
2. Reducir peso de assets críticos (ej. logo ~969 KB).
3. Estandarizar logging (niveles, contexto, posibilidad de desactivar debug en producción).
4. Agregar documentación operativa en `README.md` (variables, deploy, rollback, troubleshooting).

### Prioridad 2 (siguiente iteración)

1. Añadir tests mínimos:
   - smoke de rutas públicas/admin,
   - auth guard,
   - flujo de creación de pedido,
   - cálculo de totales.
2. Integrar CI con gates de calidad (`lint`, `build`, tests).
3. Ejecutar auditoría de dependencias en un entorno con acceso al registry de advisories.

---

## Conclusión

Hoy la aplicación **no debería pasar a producción** sin resolver primero los bloqueantes de lint y autorización en admin. Una vez cerrados esos puntos y con una base mínima de documentación + validación automática, el riesgo operativo bajará de forma importante.
