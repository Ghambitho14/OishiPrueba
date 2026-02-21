-- Agregar branch_id a orders para reportes por sucursal
-- Sin esta columna, no se puede filtrar ni agrupar por sucursal
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id text;

COMMENT ON COLUMN public.orders.branch_id IS 'Sucursal donde se realizó el pedido';
