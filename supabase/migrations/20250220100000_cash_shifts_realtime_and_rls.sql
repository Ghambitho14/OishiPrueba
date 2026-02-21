-- 1. Habilitar Realtime para cash_shifts (para que el cliente reciba cambios al instante)
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_shifts;

-- 2. Permitir que usuarios anónimos (clientes) lean turnos abiertos para saber qué sucursales aceptan pedidos
-- Sin esto, getBranchesWithOpenCaja() devuelve vacío para visitantes del menú
CREATE POLICY "Allow anon read open shifts" ON public.cash_shifts
  FOR SELECT TO anon
  USING (status = 'open');

-- 3. (Opcional) Replica identity full para recibir 'old' en UPDATE/DELETE y actualizar UI al cerrar caja
ALTER TABLE public.cash_shifts REPLICA IDENTITY FULL;
