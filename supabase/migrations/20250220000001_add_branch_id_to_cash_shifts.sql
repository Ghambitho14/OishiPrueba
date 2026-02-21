-- Migración: Agregar branch_id a cash_shifts
-- La caja del admin está diseñada para trabajar por sucursal, pero la tabla no tenía esta columna.
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.

-- 1. Agregar columna branch_id (nullable para no romper turnos existentes)
ALTER TABLE public.cash_shifts 
ADD COLUMN IF NOT EXISTS branch_id text;

-- 2. Si tienes tabla branches con UUID, cambia a: branch_id uuid REFERENCES branches(id)
-- Si usas IDs tipo texto (ej: 'san-joaquin'), la columna text es correcta.

-- 3. (Opcional) Para turnos existentes, asigna el primer branch si solo tienes uno
-- UPDATE public.cash_shifts SET branch_id = (SELECT id FROM branches LIMIT 1) WHERE branch_id IS NULL;

COMMENT ON COLUMN public.cash_shifts.branch_id IS 'Sucursal a la que pertenece este turno de caja';
