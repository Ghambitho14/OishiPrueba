-- Agregar columnas de configuración a la tabla branches para paridad con business_info
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS schedule text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS account_type text,
ADD COLUMN IF NOT EXISTS account_number text,
ADD COLUMN IF NOT EXISTS account_rut text,
ADD COLUMN IF NOT EXISTS account_email text,
ADD COLUMN IF NOT EXISTS account_holder text;

-- Nota: 'instagram_url' ya existe en branches, se mapeará desde 'instagram' en el frontend.