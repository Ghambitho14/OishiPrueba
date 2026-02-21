-- ============================================================
-- DIAGNÓSTICO Y CORRECCIÓN: tabla business_info (Herramientas)
-- Ejecuta este script en Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. DIAGNÓSTICO: ver estado de RLS y políticas
SELECT
  'RLS activo' AS check_type,
  relname AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'business_info';

SELECT
  'Políticas' AS check_type,
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE tablename = 'business_info';

-- Ver filas actuales (si hay)
SELECT id, name, phone FROM public.business_info LIMIT 2;

-- 2. CORRECCIÓN: quitar RLS para que el guardado funcione
-- (business_info es un solo registro de configuración pública)
ALTER TABLE public.business_info DISABLE ROW LEVEL SECURITY;

-- Borrar todas las políticas por si quedó alguna
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'business_info'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.business_info', pol.policyname);
  END LOOP;
END $$;

-- 3. Asegurar que exista la columna account_holder (por si no existe)
ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS account_holder text;

-- 4. Una sola fila con el ID que usa la app (evita duplicados)
-- Si ya hay filas con otro id, copiamos los datos a la fila fija y borramos el resto
INSERT INTO public.business_info (
  id,
  name, phone, address, instagram, schedule,
  bank_name, account_type, account_number, account_rut, account_email, account_holder
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  name, phone, address, instagram, schedule,
  bank_name, account_type, account_number, account_rut, account_email, account_holder
FROM public.business_info
WHERE id != '00000000-0000-0000-0000-000000000001'::uuid
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  instagram = EXCLUDED.instagram,
  schedule = EXCLUDED.schedule,
  bank_name = EXCLUDED.bank_name,
  account_type = EXCLUDED.account_type,
  account_number = EXCLUDED.account_number,
  account_rut = EXCLUDED.account_rut,
  account_email = EXCLUDED.account_email,
  account_holder = EXCLUDED.account_holder;

DELETE FROM public.business_info WHERE id != '00000000-0000-0000-0000-000000000001'::uuid;

-- Si no había ninguna fila, insertar una vacía con el id fijo
INSERT INTO public.business_info (
  id, name, phone, address, instagram, schedule,
  bank_name, account_type, account_number, account_rut, account_email, account_holder
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
)
ON CONFLICT (id) DO NOTHING;

-- 5. Confirmar
SELECT 'Listo: RLS desactivado, una sola fila con id fijo' AS resultado;
SELECT id, name, phone FROM public.business_info;
