-- Todos los correos como rol 'admin', excepto cajero@gmail.com (rol 'cashier')
UPDATE public.admin_users
SET role = 'admin'
WHERE email IS NULL OR LOWER(TRIM(email)) != 'cajero@gmail.com';

UPDATE public.admin_users
SET role = 'cashier'
WHERE LOWER(TRIM(email)) = 'cajero@gmail.com';
