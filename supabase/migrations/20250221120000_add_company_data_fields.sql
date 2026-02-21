-- Campos adicionales para datos de la empresa (no por local)
-- Usado en Admin > Datos de la empresa (solo rol admin)

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS legal_rut text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.companies.legal_rut IS 'RUT o identificación legal de la empresa';
COMMENT ON COLUMN public.companies.address IS 'Dirección fiscal o legal';
COMMENT ON COLUMN public.companies.phone IS 'Teléfono de contacto empresa';
COMMENT ON COLUMN public.companies.email IS 'Email de contacto empresa';
