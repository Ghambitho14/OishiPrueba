import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, List, Settings, Plus, Edit, Trash, LogOut, 
  ExternalLink, Loader2, Search, Filter,
  CheckCircle2, AlertCircle, Image as ImageIcon,
  Eye, EyeOff, BarChart3, TrendingUp, Package, DollarSign,
  ChefHat, Clock, BellRing, UserCheck, XCircle, RefreshCw, 
  ArrowRight, Phone, Trophy, PieChart, Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProductModal from '../components/ProductModal';
import CategoryModal from '../components/CategoryModal';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.png'; 

const Admin = () => {
  const navigate = useNavigate();
  
  // --- ESTADOS GLOBALES ---
  const [activeTab, setActiveTab] = useState('orders'); 
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]); 
  
  // Estados de Interfaz
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [mobileTab, setMobileTab] = useState('pending');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [notification, setNotification] = useState(null);

  // Hook de Responsividad
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showNotify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- CARGA DE DATOS ---
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: cats } = await supabase.from('categories').select('*').order('order');
      const { data: prods } = await supabase.from('products').select('*').order('name');
      
      // Cargamos más pedidos para que las estadísticas sean útiles (últimos 200)
      const { data: ords } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (cats) setCategories(cats);
      if (prods) setProducts(prods);
      if (ords) setOrders(ords);

    } catch (error) {
      showNotify("Error de conexión", 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { 
    loadData(); 
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // --- ACCIONES DE PEDIDOS ---
  const moveOrder = async (orderId, nextStatus) => {
    const previousOrders = [...orders];
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));

    try {
      const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
      if (error) throw error;
      showNotify('Estado actualizado');
    } catch (error) {
      setOrders(previousOrders);
      showNotify("Error al actualizar", "error");
    }
  };

  // --- ACCIONES DE PRODUCTOS ---
  const handleSaveProduct = async (formData, localFile) => {
    setLoading(true); // Bloquear UI mientras guarda
    try {
      let finalImageUrl = formData.image_url;
      
      if (localFile) {
        const fileExt = localFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: upErr } = await supabase.storage.from('images').upload(`menu/${fileName}`, localFile);
        
        if (upErr) throw upErr;
        
        const { data } = supabase.storage.from('images').getPublicUrl(`menu/${fileName}`);
        finalImageUrl = data.publicUrl;
      }
      
      const payload = { ...formData, image_url: finalImageUrl, price: parseInt(formData.price) };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        showNotify("Producto actualizado");
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        showNotify("Producto creado");
      }
      
      setIsModalOpen(false);
      loadData(true);
    } catch (error) {
      showNotify("Error al guardar: " + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id) => {
    if(!window.confirm('¿Estás seguro de eliminar este producto?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      showNotify("Producto eliminado");
      loadData(true);
    } catch (error) {
      showNotify("Error: Probablemente esté en un pedido histórico", 'error');
    }
  };

  const toggleProductActive = async (product, e) => {
    e.stopPropagation(); // Evitar abrir el modal de edición
    const newActive = !product.is_active;
    
    // Optimistic UI
    setProducts(prev => prev.map(p => p.id === product.id ? {...p, is_active: newActive} : p));
    
    try {
      await supabase.from('products').update({ is_active: newActive }).eq('id', product.id);
      showNotify(newActive ? 'Producto activado' : 'Producto pausado');
    } catch (error) {
      loadData(true); // Revertir
      showNotify('Error al cambiar estado', 'error');
    }
  };

  // --- ACCIONES CATEGORÍAS ---
  const handleSaveCategory = async (formData) => {
    try {
      const payload = { name: formData.name, order: parseInt(formData.order), is_active: formData.is_active };
      
      if (editingCategory) {
        await supabase.from('categories').update(payload).eq('id', editingCategory.id);
        showNotify('Categoría actualizada');
      } else {
        const id = formData.name.toLowerCase().replace(/\s+/g, '-').slice(0, 20); // ID simple
        await supabase.from('categories').insert({...payload, id});
        showNotify('Categoría creada');
      }
      setIsCategoryModalOpen(false);
      loadData(true);
    } catch (error) {
      showNotify('Error al guardar categoría', 'error');
    }
  };

  // --- LÓGICA DE ESTADÍSTICAS AVANZADAS ---
  const analyticsData = useMemo(() => {
    if (!orders.length) return null;

    // 1. Ingresos Totales (Solo completados/entregados)
    const validOrders = orders.filter(o => o.status === 'completed' || o.status === 'picked_up');
    const totalIncome = validOrders.reduce((acc, o) => acc + o.total, 0);

    // 2. Productos Más Vendidos (Top 5)
    const productCounts = {};
    validOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productCounts[item.name]) productCounts[item.name] = 0;
        productCounts[item.name] += item.quantity;
      });
    });

    const sortedProducts = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // 3. Ventas por Método de Pago
    const payments = { online: 0, tienda: 0 };
    validOrders.forEach(o => {
      if (o.payment_type === 'online') payments.online++;
      else payments.tienda++;
    });

    return { totalIncome, sortedProducts, payments, totalOrders: validOrders.length };
  }, [orders]);


  // --- CLASIFICACIÓN KANBAN ---
  const kanbanColumns = useMemo(() => {
    const pending = orders.filter(o => o.status === 'pending');
    const active = orders.filter(o => o.status === 'active');
    const completed = orders.filter(o => o.status === 'completed');
    const history = orders.filter(o => o.status === 'picked_up' || o.status === 'canceled');
    return { pending, active, completed, history };
  }, [orders]);

  const getTimeElapsed = (dateString) => {
    const diff = new Date() - new Date(dateString);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  // --- COMPONENTES UI INTERNOS ---
  
  // Tarjeta de Pedido (Kanban)
  const OrderCard = ({ order }) => (
    <div className={`kanban-card glass animate-slide-up ${order.status === 'pending' ? 'urgent-pulse' : ''}`}>
      <div className="card-header-row">
        <span className="order-time"><Clock size={12}/> {getTimeElapsed(order.created_at)}</span>
        <span className="payment-badge">{order.payment_type === 'online' ? 'Transf.' : 'Efectivo'}</span>
      </div>
      <div className="card-client">
        <h4>{order.client_name}</h4>
        <div className="client-phone"><Phone size={12}/> {order.client_phone}</div>
      </div>
      <div className="card-items">
        {order.items.map((item, idx) => (
          <div key={idx} className="order-item-row">
            <span className="qty-circle">{item.quantity}</span>
            <span className="item-name">{item.name}</span>
          </div>
        ))}
      </div>
      {order.note && <div className="card-note">📝 {order.note}</div>}
      {order.payment_ref && order.payment_ref.includes('http') && (
        <a href={order.payment_ref} target="_blank" rel="noreferrer" className="receipt-link"><ImageIcon size={14}/> Ver Pago</a>
      )}
      <div className="card-total">Total: ${order.total.toLocaleString('es-CL')}</div>
      <div className="card-actions">
        {order.status === 'pending' && (
          <>
            <button onClick={() => moveOrder(order.id, 'canceled')} className="btn-icon-action cancel"><XCircle size={20}/></button>
            <button onClick={() => moveOrder(order.id, 'active')} className="btn-action primary">A Cocina</button>
          </>
        )}
        {order.status === 'active' && <button onClick={() => moveOrder(order.id, 'completed')} className="btn-action success">¡Listo!</button>}
        {order.status === 'completed' && <button onClick={() => moveOrder(order.id, 'picked_up')} className="btn-action info">Entregado</button>}
      </div>
    </div>
  );

  // Tarjeta de Producto (Inventario Nuevo)
  const InventoryCard = ({ product }) => (
    <div className={`inventory-card glass ${!product.is_active ? 'inactive' : ''}`} onClick={() => {setEditingProduct(product); setIsModalOpen(true)}}>
      <div className="inv-img-wrapper">
        <img src={product.image_url || logo} alt={product.name} onError={(e) => e.target.src = logo} />
        <div className="inv-status-toggle" onClick={(e) => toggleProductActive(product, e)}>
          {product.is_active ? <Eye size={16}/> : <EyeOff size={16}/>}
        </div>
      </div>
      <div className="inv-info">
        <div className="inv-header">
          <h4>{product.name}</h4>
          <span className="inv-price">${product.price.toLocaleString('es-CL')}</span>
        </div>
        <span className="inv-cat">{categories.find(c => c.id === product.category_id)?.name || 'Sin Categoría'}</span>
        <div className="inv-actions">
          <span className={`status-badge ${product.is_active ? 'active' : 'paused'}`}>
            {product.is_active ? 'En Venta' : 'Pausado'}
          </span>
          <button onClick={(e) => { e.stopPropagation(); deleteProduct(product.id); }} className="btn-trash-sm"><Trash size={14}/></button>
        </div>
      </div>
    </div>
  );

  if (loading && !refreshing && products.length === 0) return (
    <div className="admin-layout flex-center" style={{height:'100vh', flexDirection:'column', gap:20}}>
      <Loader2 className="animate-spin" size={60} color="#e63946" />
      <h3 style={{color:'white'}}>Cargando Sistema...</h3>
    </div>
  );

  return (
    <div className="admin-layout">
      {notification && (
        <div className={`admin-notification ${notification.type} animate-slide-up`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="admin-sidebar glass">
        <div className="sidebar-top">
          <div className="logo-circle"><img src={logo} alt="Logo" /></div>
          {!isMobile && <h3 className="brand-title">Oishi Admin</h3>}
        </div>
        <nav className="sidebar-menu">
          <button onClick={() => setActiveTab('orders')} className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}>
            <ChefHat size={22} /> {!isMobile && 'Pedidos'}
            {kanbanColumns.pending.length > 0 && <span className="badge-count">{kanbanColumns.pending.length}</span>}
          </button>
          <button onClick={() => setActiveTab('products')} className={`nav-item ${activeTab === 'products' ? 'active' : ''}`}>
            <ShoppingBag size={22} /> {!isMobile && 'Inventario'}
          </button>
          <button onClick={() => setActiveTab('analytics')} className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}>
            <BarChart3 size={22} /> {!isMobile && 'Reportes'}
          </button>
          <button onClick={() => setActiveTab('categories')} className={`nav-item ${activeTab === 'categories' ? 'active' : ''}`}>
            <List size={22} /> {!isMobile && 'Categorías'}
          </button>
        </nav>
        <button onClick={() => navigate('/')} className="nav-item logout">
          <LogOut size={22} /> {!isMobile && 'Salir'}
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-content">
        <header className="content-header">
          <div>
            <h1>
              {activeTab === 'orders' ? (isHistoryView ? 'Historial' : 'Cocina en Vivo') : 
               activeTab === 'products' ? 'Inventario de Platos' : 
               activeTab === 'analytics' ? 'Rendimiento' : 'Categorías'}
            </h1>
            <p className="subtitle">
              {activeTab === 'orders' ? 'Controla el flujo de pedidos.' : 
               activeTab === 'products' ? 'Gestiona precios y disponibilidad.' : 'Estadísticas clave del negocio.'}
            </p>
          </div>
          
          <div className="header-actions">
            <button onClick={() => loadData(true)} className="btn-icon-refresh" disabled={refreshing}>
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {activeTab === 'orders' && (
              <button className={`btn ${isHistoryView ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIsHistoryView(!isHistoryView)}>
                {isHistoryView ? 'Ver Tablero' : 'Ver Historial'}
              </button>
            )}
            {activeTab === 'products' && (
               <button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="btn btn-primary">
                 <Plus size={18} /> Nuevo Plato
               </button>
            )}
             {activeTab === 'categories' && (
               <button onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true); }} className="btn btn-primary">
                 <Plus size={18} /> Nueva Categ.
               </button>
            )}
          </div>
        </header>

        {/* --- 1. VISTA DE PEDIDOS (KANBAN) --- */}
        {activeTab === 'orders' && (
          !isHistoryView ? (
            <>
              <div className="mobile-tabs">
                <button onClick={() => setMobileTab('pending')} className={mobileTab === 'pending' ? 'active' : ''}>Entrantes ({kanbanColumns.pending.length})</button>
                <button onClick={() => setMobileTab('active')} className={mobileTab === 'active' ? 'active' : ''}>Cocina ({kanbanColumns.active.length})</button>
                <button onClick={() => setMobileTab('completed')} className={mobileTab === 'completed' ? 'active' : ''}>Listos ({kanbanColumns.completed.length})</button>
              </div>
              <div className="kanban-board">
                <div className={`kanban-column col-pending ${isMobile && mobileTab !== 'pending' ? 'hidden' : ''}`}>
                  <div className="column-header"><span className="dot dot-orange"></span><h3>ENTRANTES</h3><span className="count">{kanbanColumns.pending.length}</span></div>
                  <div className="column-body">
                    {kanbanColumns.pending.length === 0 ? <div className="empty-zone">Sin pedidos</div> : kanbanColumns.pending.map(o => <OrderCard key={o.id} order={o} />)}
                  </div>
                </div>
                <div className={`kanban-column col-active ${isMobile && mobileTab !== 'active' ? 'hidden' : ''}`}>
                  <div className="column-header"><span className="dot dot-red"></span><h3>COCINANDO</h3><span className="count">{kanbanColumns.active.length}</span></div>
                  <div className="column-body">
                    {kanbanColumns.active.length === 0 ? <div className="empty-zone">Cocina libre</div> : kanbanColumns.active.map(o => <OrderCard key={o.id} order={o} />)}
                  </div>
                </div>
                <div className={`kanban-column col-completed ${isMobile && mobileTab !== 'completed' ? 'hidden' : ''}`}>
                  <div className="column-header"><span className="dot dot-green"></span><h3>LISTOS</h3><span className="count">{kanbanColumns.completed.length}</span></div>
                  <div className="column-body">
                    {kanbanColumns.completed.length === 0 ? <div className="empty-zone">Nada listo</div> : kanbanColumns.completed.map(o => <OrderCard key={o.id} order={o} />)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="history-view glass animate-fade">
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead>
                <tbody>
                  {kanbanColumns.history.map(o => (
                    <tr key={o.id}>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>{o.client_name}</td>
                      <td><span className={`status-pill ${o.status}`}>{o.status === 'picked_up' ? 'Entregado' : 'Cancelado'}</span></td>
                      <td>${o.total.toLocaleString('es-CL')}</td>
                    </tr>
                  ))}
                  {!kanbanColumns.history.length && <tr><td colSpan="4" style={{textAlign:'center', padding:20}}>Historial vacío</td></tr>}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* --- 2. VISTA DE INVENTARIO (NUEVA GRID) --- */}
        {activeTab === 'products' && (
           <div className="products-view animate-fade">
             {/* Barra de Filtros */}
             <div className="admin-toolbar glass">
               <div className="search-box">
                  <Search size={18} />
                  <input placeholder="Buscar plato..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
               </div>
               <div className="filter-box">
                  <Filter size={18} />
                  <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
                    <option value="all">Todas las categorías</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
               </div>
               <div className="stats-mini">
                 <span><b>{products.length}</b> Platos Total</span>
                 <span style={{color:'#25d366'}}><b>{products.filter(p=>p.is_active).length}</b> Activos</span>
               </div>
             </div>

             {/* Grid de Productos */}
             <div className="inventory-grid">
               {products
                 .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                 .filter(p => filterCategory === 'all' || p.category_id === filterCategory)
                 .map(p => <InventoryCard key={p.id} product={p} />)
               }
             </div>
           </div>
        )}

        {/* --- 3. VISTA DE REPORTES (NUEVA VISUAL) --- */}
        {activeTab === 'analytics' && analyticsData && (
          <div className="analytics-view animate-fade">
            {/* KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card glass">
                <div className="kpi-icon money"><DollarSign size={24}/></div>
                <div>
                   <h4>Ingresos Totales</h4>
                   <span className="kpi-value">${analyticsData.totalIncome.toLocaleString('es-CL')}</span>
                </div>
              </div>
              <div className="kpi-card glass">
                <div className="kpi-icon orders"><Package size={24}/></div>
                <div>
                   <h4>Pedidos Completados</h4>
                   <span className="kpi-value">{analyticsData.totalOrders}</span>
                </div>
              </div>
              <div className="kpi-card glass">
                <div className="kpi-icon star"><Star size={24}/></div>
                <div>
                   <h4>Ticket Promedio</h4>
                   <span className="kpi-value">
                     ${analyticsData.totalOrders ? Math.round(analyticsData.totalIncome / analyticsData.totalOrders).toLocaleString('es-CL') : 0}
                   </span>
                </div>
              </div>
            </div>

            <div className="charts-grid">
              {/* Top Productos */}
              <div className="chart-card glass">
                <div className="chart-header">
                  <Trophy size={20} color="#f4a261"/>
                  <h3>Platos Más Vendidos</h3>
                </div>
                <div className="top-products-list">
                  {analyticsData.sortedProducts.map((p, idx) => (
                    <div key={idx} className="top-product-item">
                      <div className="rank-num">#{idx+1}</div>
                      <div className="rank-info">
                        <div className="rank-name">{p.name}</div>
                        <div className="rank-bar-bg">
                           <div className="rank-bar-fill" style={{width: `${(p.count / analyticsData.sortedProducts[0].count) * 100}%`}}></div>
                        </div>
                      </div>
                      <div className="rank-count">{p.count}</div>
                    </div>
                  ))}
                  {analyticsData.sortedProducts.length === 0 && <div className="empty-chart">Aún no hay ventas suficientes</div>}
                </div>
              </div>

              {/* Métodos de Pago */}
              <div className="chart-card glass">
                <div className="chart-header">
                  <PieChart size={20} color="#38bdf8"/>
                  <h3>Métodos de Pago</h3>
                </div>
                <div className="payment-stats">
                  <div className="pay-stat-row">
                     <span>Transferencia</span>
                     <div className="pay-bar">
                       <div className="pay-fill online" style={{width: `${(analyticsData.payments.online / (analyticsData.totalOrders || 1)) * 100}%`}}></div>
                     </div>
                     <span>{analyticsData.payments.online}</span>
                  </div>
                  <div className="pay-stat-row">
                     <span>Local (Efec/Tarj)</span>
                     <div className="pay-bar">
                       <div className="pay-fill store" style={{width: `${(analyticsData.payments.tienda / (analyticsData.totalOrders || 1)) * 100}%`}}></div>
                     </div>
                     <span>{analyticsData.payments.tienda}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 4. VISTA CATEGORÍAS (SIMPLE) --- */}
        {activeTab === 'categories' && (
           <div className="categories-list glass animate-fade">
             {categories.map(c => (
               <div key={c.id} className="cat-row-item">
                 <div className="cat-drag-handle">#{c.order}</div>
                 <div className="cat-name-lg">{c.name}</div>
                 <span className={`status-badge ${c.is_active ? 'active' : 'paused'}`}>
                    {c.is_active ? 'Visible' : 'Oculta'}
                 </span>
                 <button onClick={() => {setEditingCategory(c); setIsCategoryModalOpen(true)}} className="btn-icon-action">
                    <Edit size={18}/>
                 </button>
               </div>
             ))}
           </div>
        )}

      </main>

      {/* MODALES */}
      <ProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveProduct}
        product={editingProduct}
        categories={categories}
      />
      <CategoryModal 
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        category={editingCategory}
      />
    </div>
  );
};

export default Admin;