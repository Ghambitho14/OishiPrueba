/**
 * Nombres de tablas de Supabase usados en la app.
 * Si tu base de datos usa otros nombres, cámbialos aquí para que todo el código
 * apunte a las tablas correctas.
 */
export const TABLES = {
  // Empresa (datos globales de la empresa, no por local)
  companies: 'companies',
  // Sucursales (cada local tiene su info aquí; multi-local)
  branches: 'branches',

  // Productos y precios
  categories: 'categories',
  products: 'products',
  product_prices: 'product_prices',
  product_branch: 'product_branch',

  // Pedidos y clientes
  orders: 'orders',
  clients: 'clients',

  // Caja
  cash_shifts: 'cash_shifts',
  cash_movements: 'cash_movements',

  // Admin y inventario
  admin_users: 'admin_users',
  inventory_items: 'inventory_items',
  inventory_branch: 'inventory_branch',
};
