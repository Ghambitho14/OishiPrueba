import { createClient } from '@supabase/supabase-js';

// Conexión a Supabase: siempre usar la URL real del proyecto (no MCP para el cliente)
const supabaseUrl = (import.meta.env.VITE_PRUEBA_SUPABASE_URL || '').replace(/\/$/, '');
const supabaseAnonKey = import.meta.env.VITE_PRUEBA_SUPABASE_ANON_KEY || '';

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[Supabase] Faltan variables de entorno. Asegúrate de tener en .env.local:\n' +
    '  VITE_PRUEBA_SUPABASE_URL=https://tu-proyecto.supabase.co\n' +
    '  VITE_PRUEBA_SUPABASE_ANON_KEY=eyJ...'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
