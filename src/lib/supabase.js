import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useMcp = import.meta.env.VITE_SUPABASE_USE_MCP === 'true';
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF || '';

// Validar que las variables de entorno estén configuradas
if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  
  const errorMsg = `Missing required environment variables: ${missing.join(', ')}. ` +
    `Please check your .env file or Vercel environment variables.`;
  
  console.error(errorMsg);
  
  // En desarrollo, mostrar un error más visible
  if (import.meta.env.DEV) {
    throw new Error(errorMsg);
  }
}

// Construir la URL del cliente: usar MCP si está habilitado y se proporcionó project ref
const clientUrl = (useMcp && projectRef)
  ? `https://mcp.supabase.com/mcp?project_ref=${projectRef}`
  : supabaseUrl || '';

// Crear una única instancia de Supabase
export const supabase = createClient(clientUrl, supabaseAnonKey || '', {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      Accept: 'application/json'
    }
  }
});
