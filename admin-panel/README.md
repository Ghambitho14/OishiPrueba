# Panel Admin (base de prueba)

Panel independiente para gestionar **usuarios** (Cajeros / Admin), **empresas** y **locales** (sucursales por empresa). Usa la **base de datos de prueba** de Supabase.

## Requisitos

- Node 18+
- Proyecto Supabase de **prueba** con las tablas `admin_users`, `companies`, `branches`

## Configuración

1. Copia `.env.example` a `.env`.
2. En `.env` pon la **URL** y la **anon key** del proyecto Supabase de **prueba** (las mismas que usa la app principal en modo prueba, p. ej. `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del repo raíz).

## Instalación y ejecución

```bash
cd admin-panel
npm install
npm run dev
```

Abre la URL que muestre Vite (p. ej. `http://localhost:5174`).

## Funcionalidad

- **Login**: Solo usuarios con rol **Nameku** (dueños de la app) pueden entrar. El rol se obtiene con la RPC `get_user_role`; debe devolver `nameku`.
- **Usuarios**: Ver, agregar, editar (rol) y eliminar registros en `admin_users`. Roles: **Nameku (dueño)**, Admin, Cajero.
- **Empresas**: CRUD de empresas (`companies`).
- **Locales**: CRUD de locales/sucursales (`branches`), filtro por empresa. Cada local pertenece a una empresa.

## Notas

- Si la base de prueba tiene RLS (Row Level Security), puede que tengas que definir políticas que permitan a usuarios con rol `admin` leer/escribir en `admin_users`, `companies` y `branches`. Si usas solo la anon key y no hay RLS en esas tablas, funcionará tal cual.
- Para **agregar** un usuario nuevo: se crea la fila en `admin_users` con email y rol. La persona debe registrarse después con ese mismo email en la app (Supabase Auth) para poder iniciar sesión.
- La columna `role` de `admin_users` debe aceptar el valor `nameku` (además de `admin` y `cajero`). Si tienes un CHECK en la tabla, actualízalo para permitir `'nameku'`.
