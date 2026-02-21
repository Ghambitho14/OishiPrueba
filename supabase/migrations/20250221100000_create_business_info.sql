-- Tabla de configuración del negocio/local (Herramientas en Admin)
-- Si la tabla ya existe en tu proyecto, no ejecutes este archivo o adapta con IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.business_info (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    phone text,
    address text,
    instagram text,
    schedule text,
    bank_name text,
    account_type text,
    account_number text,
    account_rut text,
    account_email text,
    account_holder text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Permitir que cualquiera pueda leer (para la tienda pública)
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read business_info" ON public.business_info;
CREATE POLICY "Allow public read business_info" ON public.business_info
    FOR SELECT USING (true);

-- Permitir insert/update a usuarios autenticados (admin)
DROP POLICY IF EXISTS "Allow authenticated full access business_info" ON public.business_info;
CREATE POLICY "Allow authenticated full access business_info" ON public.business_info
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permitir insert/update a anon por si el admin usa anon key (ej. login con email/password pero rol anon)
DROP POLICY IF EXISTS "Allow anon full access business_info" ON public.business_info;
CREATE POLICY "Allow anon full access business_info" ON public.business_info
    FOR ALL TO anon USING (true) WITH CHECK (true);

COMMENT ON TABLE public.business_info IS 'Datos del local/negocio (Herramientas en Admin)';
