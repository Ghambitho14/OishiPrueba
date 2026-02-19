import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_PRUEBA_SUPABASE_URL;
const supabaseKey = process.env.VITE_PRUEBA_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing environment variables for test DB.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
  // Try to select 1 row to see if table exists and we have read access
  const { data, error } = await supabase.from(tableName).select('count', { count: 'exact', head: true });
  
  if (error) {
    if (error.code === '42P01') { // undefined_table
      console.log(`❌ Table '${tableName}' DOES NOT exist.`);
      return false;
    } else {
      console.log(`⚠️ Error accessing '${tableName}':`, error.message);
      return false; // Treat access error as failure
    }
  } else {
    console.log(`✅ Table '${tableName}' exists and is accessible.`);
    return true;
  }
}

async function verify() {
  console.log(`Connecting to: ${supabaseUrl}`);
  
  const categoriesOk = await checkTable('categories');
  const clientsOk = await checkTable('clients');
  const ordersOk = await checkTable('orders');
  
  if (categoriesOk && clientsOk && ordersOk) {
    console.log("\n🎉 All required tables exist. Ready to migrate data.");
  } else {
    console.log("\n⚠️ Some tables are missing or inaccessible. Migration might fail.");
  }
}

verify();
