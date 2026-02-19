
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_PRUEBA_SUPABASE_URL;
const supabaseKey = process.env.VITE_PRUEBA_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing environment variables for test DB.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
    console.log("🛠️ Creating tables if they don't exist...");

    // 1. Categories Table
    const { error: catError } = await supabase.rpc('create_categories_table_if_not_exists');
    // RPC might not exist, so we try raw SQL via a trick or just assume tables exist. 
    // Since we don't have direct SQL access via client without service key generally, 
    // IF the user provided ANON key, we can't create tables unless RLS allows it or we use a function.
    
    // However, the error 'relation "public.categories" does not exist' confirms it's missing.
    // We cannot create tables with anon key usually. 
    // But let's try to see if we can use the 'execute_sql' tool? NO, that failed.
    
    // WAIT. The user said "construir la nueva base de datos" (build the new database).
    // If I can't use MCP (privilege error) and Anon key can't create tables...
    // I might be stuck unless the user provides a SERVICE_ROLE key or I use the dashboard.
    
    // BUT, maybe the 'postgres' function is available?
    // Let's try to proceed by warning the user or hoping the user runs SQL.
}

async function migrate() {
  console.log(`🚀 Starting migration to: ${supabaseUrl}`);

  try {
    // --- 1. CATEGORIES ---
    console.log("\n📦 Processing Categories...");
    const categoriesCsv = fs.readFileSync(path.join('BD', 'categories_rows.csv'), 'utf-8');
    const categories = parse(categoriesCsv, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (context.column === 'order') return parseInt(value);
        if (context.column === 'is_active') return value === 'true';
        return value;
      }
    });

    if (categories.length > 0) {
      const { error: catError } = await supabase.from('categories').upsert(categories);
      if (catError) {
          if (catError.code === '42P01') {
              throw new Error("Table 'categories' does not exist. Please create the tables in the Test DB first.");
          }
          throw new Error(`Categories Upsert Error: ${catError.message}`);
      }
      console.log(`✅ Upserted ${categories.length} categories.`);
    }

    // --- 2. CLIENTS ---
    console.log("\n👥 Processing Clients...");
    const clientsCsv = fs.readFileSync(path.join('BD', 'clients_rows.csv'), 'utf-8');
    const clients = parse(clientsCsv, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (value === '') return null;
        if (context.column === 'total_orders' || context.column === 'total_spent') return parseFloat(value);
        if (context.column === 'is_frequent') return value === 'true';
        return value;
      }
    });

    if (clients.length > 0) {
        const { error: clientError } = await supabase.from('clients').upsert(clients);
        if (clientError) throw new Error(`Clients Upsert Error: ${clientError.message}`);
        console.log(`✅ Upserted ${clients.length} clients.`);
    }

    // --- 3. BUSINESS INFO ---
    console.log("\n🏢 Processing Business Info...");
    const businessCsv = fs.readFileSync(path.join('BD', 'business_info_rows.csv'), 'utf-8');
    const businessInfo = parse(businessCsv, {
      columns: true,
      skip_empty_lines: true
    });

    if (businessInfo.length > 0) {
        const { error: busError } = await supabase.from('business_info').upsert(businessInfo);
        if (busError) throw new Error(`Business Info Upsert Error: ${busError.message}`);
        console.log(`✅ Upserted ${businessInfo.length} business info records.`);
    }

    // --- 3.5. BRANCHES (Static Data) ---
    console.log("\n🏪 Processing Branches...");
    const branches = [
      {
        slug: 'san-joaquin',
        name: 'San Joaquín',
        address: 'San Joaquín, Santiago',
        phone: '+56 9 7664 5547',
        map_url: 'https://maps.google.com/?q=Oishi+Sushi+San+Joaquin',
        whatsapp_url: 'https://wa.me/56976645547',
        instagram_url: 'https://instagram.com/oishi.sushi.stg',
        is_active: true
      },
      {
        slug: 'ciudad-lo-valle',
        name: 'Ciudad de Lo Valledor',
        address: 'Ciudad de Lo Valledor, Santiago',
        phone: '+56 9 2613 8846',
        map_url: 'https://maps.app.goo.gl/wCBPcmaLwaguf5xN7',
        whatsapp_url: 'https://wa.me/56926138846',
        instagram_url: 'https://instagram.com/oishi.sushi.cl',
        is_active: true
      }
    ];

    const { error: branchError } = await supabase.from('branches').upsert(branches, { onConflict: 'slug' });
    if (branchError) throw new Error(`Branches Upsert Error: ${branchError.message}`);
    console.log(`✅ Upserted ${branches.length} branches.`);

    // --- 4. ORDERS ---
    console.log("\n🛒 Processing Orders...");
    
    // Get default branch (San Joaquín)
    const { data: sjBranch } = await supabase.from('branches').select('id').eq('slug', 'san-joaquin').single();
    const defaultBranchId = sjBranch?.id;

    const ordersCsv = fs.readFileSync(path.join('BD', 'orders_rows.csv'), 'utf-8');
    const ordersRaw = parse(ordersCsv, {
      columns: true,
      skip_empty_lines: true
    });

    const orders = [];
    for (const row of ordersRaw) {
        let items = [];
        try { items = JSON.parse(row.items); } catch (e) { items = []; }

        orders.push({
            id: row.id,
            created_at: row.created_at,
            client_id: row.client_id,
            client_name: row.client_name,
            client_phone: row.client_phone,
            client_rut: row.client_rut,
            items: items,
            total: parseFloat(row.total),
            status: row.status,
            payment_type: row.payment_type,
            payment_ref: row.payment_ref,
            note: row.note,
            branch_id: defaultBranchId // Assign to San Joaquín
        });
    }

    if (orders.length > 0) {
        const { error: orderError } = await supabase.from('orders').upsert(orders);
        if (orderError) throw new Error(`Orders Upsert Error: ${orderError.message}`);
        console.log(`✅ Upserted ${orders.length} orders.`);
    }

    // --- 5. PRODUCTS ---
    console.log("\n🍣 Processing Products...");
    const productsCsv = fs.readFileSync(path.join('BD', 'products_rows.csv'), 'utf-8');
    const products = parse(productsCsv, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (context.column === 'price') return parseFloat(value);
        if (context.column === 'discount_price') return value ? parseFloat(value) : null;
        if (context.column === 'is_active' || context.column === 'is_special' || context.column === 'has_discount') return value === 'true';
        return value;
    }
    });

    if (products.length > 0) {
      const { error: prodError } = await supabase.from('products').upsert(products);
      if (prodError) throw new Error(`Products Upsert Error: ${prodError.message}`);
      console.log(`✅ Upserted ${products.length} products.`);
    }

    // --- 6. ADMIN USERS ---
    console.log("\n👤 Processing Admin Users...");
    try {
        const adminCsv = fs.readFileSync(path.join('BD', 'admin_users_rows.csv'), 'utf-8');
        const admins = parse(adminCsv, { columns: true, skip_empty_lines: true });
        if (admins.length > 0) {
            const { error: adminError } = await supabase.from('admin_users').upsert(admins);
            if (adminError) console.warn(`⚠️ Admin Upsert Error (might duplicate auth users): ${adminError.message}`);
            else console.log(`✅ Upserted ${admins.length} admin users.`);
        }
    } catch (e) { console.log("ℹ️ No admin_users_rows.csv found or empty."); }

    // --- 7. INVENTORY ---
    console.log("\n📦 Processing Inventory...");
    try {
        const inventoryCsv = fs.readFileSync(path.join('BD', 'inventory_items_rows.csv'), 'utf-8');
        const inventory = parse(inventoryCsv, { 
            columns: true, 
            skip_empty_lines: true,
            cast: (value, context) => {
                if (context.column.includes('stock') || context.column.includes('cost')) return parseFloat(value);
                return value;
            }
        });
        if (inventory.length > 0) {
            const { error: invError } = await supabase.from('inventory_items').upsert(inventory);
            if (invError) throw new Error(`Inventory Upsert Error: ${invError.message}`);
            console.log(`✅ Upserted ${inventory.length} inventory items.`);
        }
    } catch (e) { console.log("ℹ️ No inventory_items_rows.csv found or empty."); }

    console.log("\n✨ Migration completed successfully!");

  } catch (err) {
    const errorMsg = `\n❌ Migration Failed: ${err.message}\nStack: ${err.stack}`;
    console.error(errorMsg);
    fs.writeFileSync('seed_errors.log', errorMsg);
    process.exit(1);
  }
}

migrate();
