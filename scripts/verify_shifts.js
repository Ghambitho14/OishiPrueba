/**
 * Script de utilidad para revisar turnos de caja cerrados.
 * Uso: node scripts/verify_shifts.js
 * Requiere .env.local con VITE_PRUEBA_SUPABASE_URL y VITE_PRUEBA_SUPABASE_ANON_KEY.
 * Cargar env manualmente (ej. dotenv) según tu entorno.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_PRUEBA_SUPABASE_URL;
const key = process.env.VITE_PRUEBA_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Faltan VITE_PRUEBA_SUPABASE_URL o VITE_PRUEBA_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkShifts() {
  const { data, error } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('status', 'closed')
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Closed shifts found:', data?.length ?? 0);
}

checkShifts();
