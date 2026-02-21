-- ============================================================
-- DESACTIVAR RLS EN TODAS LAS TABLAS QUE USA LA APP
-- Así podrás: crear órdenes, guardar Herramientas, clientes, caja, etc.
-- Ejecuta en Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Tablas que usa la app (según src/lib/supabaseTables.js)
DO $$
DECLARE
  t text;
  pol RECORD;
  tables text[] := ARRAY[
    'business_info', 'branches', 'categories', 'products', 'product_prices', 'product_branch',
    'orders', 'clients', 'cash_shifts', 'cash_movements',
    'admin_users', 'inventory_items', 'inventory_branch'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      -- Borrar todas las políticas de la tabla
      FOR pol IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      -- Desactivar RLS
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'RLS desactivado: %', t;
    ELSE
      RAISE NOTICE 'Tabla no existe (se omite): %', t;
    END IF;
  END LOOP;
END $$;

-- Confirmar estado
SELECT
  c.relname AS tabla,
  CASE WHEN c.relrowsecurity THEN 'RLS ON' ELSE 'RLS OFF' END AS estado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'business_info', 'branches', 'categories', 'products', 'product_prices', 'product_branch',
    'orders', 'clients', 'cash_shifts', 'cash_movements',
    'admin_users', 'inventory_items', 'inventory_branch'
  )
ORDER BY c.relname;

SELECT 'Listo. Ya puedes crear órdenes, guardar Herramientas y usar la app.' AS resultado;
