import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import {
  Loader2, Search, Filter, CheckCircle2, AlertCircle,
  Package, DollarSign, Star, Trophy, PieChart,
  Upload, PlusCircle, X, XCircle, Trash2, FileText, Plus, Edit, RefreshCw, Users, List, ShoppingBag, Tag, LayoutGrid, ArrowUpDown, Eye, EyeOff, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProductModal from '../../products/components/ProductModal';
import CategoryModal from '../../products/components/CategoryModal';
import AdminSidebar from '../components/AdminSidebar';
import AdminKanban from '../components/AdminKanban';
import ManualOrderModal from '../components/ManualOrderModal';
import InventoryCard from '../components/InventoryCard';
import AdminHistoryTable from '../components/AdminHistoryTable';
import AdminClients from '../components/AdminClients';
import AdminInventory from '../components/AdminInventory';
import AdminSettings from '../components/AdminSettings';
import AdminAnalytics from '../components/AdminAnalytics';
import AdminDangerZone from '../components/AdminDangerZone';
import AdminCompanyData from '../components/AdminCompanyData';
import ClientDetailsPanel from '../components/ClientDetailsPanel';
import { supabase } from '../../../lib/supabase';
import { TABLES } from '../../../lib/supabaseTables';
import { uploadImage } from '../../../shared/utils/cloudinary';
import CashManager from '../components/caja/CashManager';
import { useCashSystem } from '../hooks/useCashSystem';
import '../../../styles/AdminLayout.css';
import '../../../styles/AdminAnalytics.css';
import '../../../styles/AdminShared.css';
import '../../../styles/AdminCategories.css';
import ScopeSelectionModal from '../components/ScopeSelectionModal';


// --- CAPA DE SANEAMIENTO (EL PORTERO) ---
const sanitizeOrder = (rawOrder) => {
  let cleanItems = [];
  if (rawOrder.items) {
    if (Array.isArray(rawOrder.items)) {
      cleanItems = rawOrder.items;
    } else if (typeof rawOrder.items === 'string') {
      try {
        const parsed = JSON.parse(rawOrder.items);
        cleanItems = Array.isArray(parsed) ? parsed : [];
      } catch {
        cleanItems = [];
      }
    }
  }
  return {
    ...rawOrder,
    items: cleanItems,
    total: Number(rawOrder.total) || 0,
    client_name: rawOrder.client_name || 'Cliente Desconocido',
    client_rut: rawOrder.client_rut || 'Sin RUT',
    client_phone: rawOrder.client_phone || '',
    status: rawOrder.status || 'pending',
    created_at: rawOrder.created_at || new Date().toISOString()
  };
};

const AdminContext = createContext(null);

const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

const AdminProvider = ({ children }) => {
  const navigate = useNavigate();

  // --- ESTADOS DE DATOS ---
  const [activeTab, setActiveTab] = useState('orders');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);

  // --- ESTADOS DE INTERFAZ ---
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [mobileTab, setMobileTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, paused
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [sortOrder, setSortOrder] = useState('name-asc'); // name-asc, price-asc, price-desc
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  // --- MODALES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [notification, setNotification] = useState(null);

  // --- MODALES COMPROBANTE Y PEDIDO MANUAL ---
  const [receiptModalOrder, setReceiptModalOrder] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // --- MODAL DE ALCANCE (GLOBAL VS LOCAL) ---
  const [scopeModal, setScopeModal] = useState({ isOpen: false, item: null, type: 'product' });

  // --- ROL (solo admin ve "Datos de la empresa") ---
  const [userRole, setUserRole] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  // --- CRM & REPORTES ---
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClientOrders, setSelectedClientOrders] = useState([]);
  const [clientHistoryLoading, setClientHistoryLoading] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Anti-zoom: bloquear Ctrl+Scroll y Ctrl+/- en el panel admin
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    const handleKeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  const showNotify = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // --- SISTEMA DE CAJA ---
  const cashSystem = useCashSystem(showNotify, selectedBranch?.id);

  // --- [MEJORA SEGURIDAD] VERIFICACIÓN DE ROL ---
  useEffect(() => {
    const verifyAdminAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email);
          // Verificar si el email está en la tabla de admins
          const { data: adminUser } = await supabase
            .from(TABLES.admin_users)
            .select('role')
            .eq('email', user.email)
            .maybeSingle();
  
          if (!adminUser) {
            console.warn("⚠️ ALERTA: Tu usuario no está en la tabla 'admin_users'. Se permite el acceso temporalmente.");
            setUserRole(null);
            // Cuando hayas agregado tu email a la base de datos, descomenta esto para activar la seguridad real:
            // await supabase.auth.signOut();
            // navigate('/login');
            // showNotify('No tienes permisos de administrador', 'error');
          } else {
            setUserRole(adminUser.role || null);
          }
        }
    };
    verifyAdminAccess();
  }, [navigate, showNotify]);

  // --- CARGA DE SUCURSALES ---
  useEffect(() => {
    const loadBranches = async () => {
      const { data, error } = await supabase.from(TABLES.branches).select('*').order('name');
      if (!error && data?.length > 0) {
        setBranches(data);
        // [FIX] Seleccionar automáticamente la primera sucursal si no hay ninguna seleccionada
        if (!selectedBranch || selectedBranch.id === 'all') {
          setSelectedBranch(data[0]);
        }
      }
    };
    loadBranches();
  }, []);

  // --- VALIDACIÓN DE SUCURSAL ACTIVA ---
  // Si no estamos en Analytics, forzar selección de una sucursal real (no 'all')
  useEffect(() => {
    if (branches.length === 0) return;

    if (activeTab !== 'analytics') {
      // Si es 'all' o nulo, cambiar a la primera sucursal
      if (!selectedBranch || selectedBranch.id === 'all') {
        setSelectedBranch(branches[0]);
      }
    }
  }, [activeTab, branches, selectedBranch]);

  // --- 1. CARGA DE DATOS ---
  const loadData = useCallback(async (isRefresh = false) => {
    if (!selectedBranch) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const isAllBranches = selectedBranch.id === 'all';

      // 1. Cargar datos base
      const promises = [
        supabase.from(TABLES.categories).select('*').order('order'),
        supabase.from(TABLES.products).select('*').order('name'),
        isAllBranches 
          ? supabase.from(TABLES.orders).select('*').order('created_at', { ascending: false })
          : supabase.from(TABLES.orders).select('*').eq('branch_id', selectedBranch.id).order('created_at', { ascending: false }),
        supabase.from(TABLES.clients).select('*').order('last_order_at', { ascending: false })
      ];

      if (!isAllBranches) {
        promises.push(supabase.from(TABLES.product_prices).select('*').eq('branch_id', selectedBranch.id));
        promises.push(supabase.from(TABLES.product_branch).select('*').eq('branch_id', selectedBranch.id));
      }

      const results = await Promise.all(promises);
      const [catsRes, globalProductsRes, ordsRes, cltsRes] = results;
      const pricesRes = !isAllBranches ? results[4] : { data: [] };
      const branchStatusRes = !isAllBranches ? results[5] : { data: [] };

      if (catsRes.error) throw catsRes.error;
      if (globalProductsRes.error) throw globalProductsRes.error;
      if (ordsRes.error) throw ordsRes.error;
      if (cltsRes.error) throw cltsRes.error;

      if (!isAllBranches) {
        if (pricesRes.error) throw pricesRes.error;
        if (branchStatusRes.error) throw branchStatusRes.error;
      }

      // 2. Fusionar productos con datos de la sucursal
      const branchPrices = pricesRes.data || [];
      const branchStatuses = branchStatusRes.data || [];
      
      const mergedProducts = (globalProductsRes.data || []).map(prod => {
        // Si estamos viendo "Todas", usamos los datos globales directos
        if (isAllBranches) return prod;

        const priceData = branchPrices.find(p => p.product_id === prod.id);
        const statusData = branchStatuses.find(s => s.product_id === prod.id);

        return {
          ...prod,
          // STRICT MODE: Usar SOLO datos de la sucursal. Si no existe configuración, es 0/inactivo.
          price: priceData ? priceData.price : 0,
          has_discount: priceData ? priceData.has_discount : false,
          discount_price: priceData ? priceData.discount_price : 0,
          // Si no hay registro en product_branch, asumimos que NO está activo en esta sucursal
          is_active: statusData ? statusData.is_active : false,
          is_special: statusData ? statusData.is_special : false,
          // Guardar IDs de relación para updates
          price_id: priceData?.id,
          branch_relation_id: statusData?.id
        };
      });

      const cleanOrders = (ordsRes.data || []).map(sanitizeOrder);

      // Filtrar clientes por sucursal: solo los que tienen pedidos en la vista actual
      const clientIdsInOrders = new Set(cleanOrders.map(o => o.client_id).filter(Boolean));
      const filteredClients = (cltsRes.data || []).filter(c => clientIdsInOrders.has(c.id));

      setCategories(catsRes.data || []);
      setProducts(mergedProducts);
      setOrders(cleanOrders);
      setClients(filteredClients);

    } catch (error) {
      console.error("Error cargando datos:", error);
      showNotify("Error de conexión", 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showNotify, selectedBranch]);

  const loadClientHistory = async (client) => {
    if (!client) return;
    setClientHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.orders)
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const cleanHistory = (data || []).map(sanitizeOrder);
      setSelectedClientOrders(cleanHistory);

    } catch {
      showNotify('Error al cargar historial', 'error');
    } finally {
      setClientHistoryLoading(false);
    }
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    loadClientHistory(client);
  };

  // --- MANEJO DE REALTIME (OPTIMISTA) ---
  const handleRealtimeEvent = useCallback((payload) => {
    console.log('🔔 Evento Realtime:', payload);
    
    if (payload.eventType === 'INSERT') {
      const newOrder = sanitizeOrder(payload.new);
      setOrders(prev => [newOrder, ...prev]);
      showNotify(`Nuevo pedido #${newOrder.id.toString().slice(-4)}`, 'success');
      // Si es un pedido nuevo, también podríamos querer actualizar clientes si es relevante
    } 
    else if (payload.eventType === 'UPDATE') {
      const updatedOrder = sanitizeOrder(payload.new);
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    } 
    else if (payload.eventType === 'DELETE') {
      setOrders(prev => prev.filter(o => o.id !== payload.old.id));
    }
  }, [showNotify]);

  useEffect(() => {
    loadData();

    // Configurar Realtime
    const channel = supabase
      .channel('table-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: selectedBranch && selectedBranch.id !== 'all' ? `branch_id=eq.${selectedBranch.id}` : undefined
        },
        handleRealtimeEvent
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscrito a cambios en tiempo real');
        }
      });

    // Fallback: Polling cada 15 segundos (más rápido por si falla Realtime)
    const intervalId = setInterval(() => {
      // Solo recargamos si NO estamos editando algo activamente para no interrumpir
      if (!isModalOpen && !editingProduct) {
         console.log('🔄 Sincronizando datos...');
         loadData(true); 
      }
    }, 15000);

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [loadData, handleRealtimeEvent, isModalOpen, editingProduct, selectedBranch]);

  // --- 2. GESTIÓN DE PEDIDOS ---
  const moveOrder = async (orderId, nextStatus) => {
    const previousOrders = [...orders];
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));

    try {
      const { error } = await supabase.from(TABLES.orders).update({ status: nextStatus }).eq('id', orderId);
      if (error) throw error;
      
      // [FIX] Registrar venta en caja si se completa/entrega
      if ((nextStatus === 'completed' || nextStatus === 'picked_up') && activeTab === 'orders') {
          const targetOrder = previousOrders.find(o => o.id === orderId);
          if (targetOrder) {
             cashSystem.registerSale(targetOrder);
          }
      }

      // [FIX] Registrar devolución si se cancela una orden previamente completada
      if (nextStatus === 'cancelled') {
        const targetOrder = previousOrders.find(o => o.id === orderId);
        // Solo si estaba completada o entregada (ya sumó a caja)
        if (targetOrder && (targetOrder.status === 'completed' || targetOrder.status === 'picked_up')) {
            cashSystem.registerRefund(targetOrder);
        }
      }

      showNotify('Pedido actualizado');
    } catch {
      setOrders(previousOrders);
      showNotify("Error al actualizar", "error");
    }
  };

  const uploadReceiptToOrder = async (orderId, file) => {
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const receiptUrl = await uploadImage(file, 'receipts');

      const { error } = await supabase.from(TABLES.orders).update({ payment_ref: receiptUrl }).eq('id', orderId);
      if (error) throw error;

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_ref: receiptUrl } : o));
      if (selectedClient) {
        setSelectedClientOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_ref: receiptUrl } : o));
      }

      showNotify('Comprobante agregado');
      setReceiptModalOrder(null);
      setReceiptPreview(null);
    } catch (error) {
      showNotify('Error al subir comprobante: ' + error.message, 'error');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  // --- 3. GESTIÓN DE PRODUCTOS ---
  const handleSaveProduct = async (formData, localFile) => {
    if (!selectedBranch) return;

    setRefreshing(true);
    try {
      let finalImageUrl = formData.image_url;
      if (localFile) {
        finalImageUrl = await uploadImage(localFile, 'menu');
      }

      const isAllBranches = selectedBranch.id === 'all';

      // 1. Guardar/Actualizar Producto Global
      const productPayload = { 
        name: formData.name,
        description: formData.description,
        category_id: formData.category_id,
        image_url: finalImageUrl,
        // MEJORA LÓGICA: Si es un producto NUEVO o estamos en "Todas",
        // guardamos los datos base (precio/estado) en la tabla global para que sirvan de fallback.
        ...((!editingProduct || isAllBranches) && {
          price: parseInt(formData.price) || 0,
          is_special: formData.is_special || false,
          has_discount: formData.has_discount || false,
          discount_price: formData.has_discount ? (parseInt(formData.discount_price) || 0) : null
        })
      };

      // Si estamos en una sucursal específica, aseguramos que el producto tenga company_id si es nuevo
      if (!isAllBranches) {
          productPayload.company_id = selectedBranch.company_id;
      }
      else if (branches.length > 0) {
          // Fallback: Si es "Todas", usar el company_id de la primera sucursal real
          productPayload.company_id = branches[0].company_id;
      }

      let productId = editingProduct?.id;

      if (editingProduct) {
        await supabase.from(TABLES.products).update(productPayload).eq('id', productId);
      } else {
        const { data: newProd, error } = await supabase.from(TABLES.products).insert(productPayload).select().single();
        if (error) throw error;
        productId = newProd.id;
      }

      // 2. Guardar/Actualizar Precios ESPECÍFICOS (Solo si NO es "Todas las sucursales")
      if (!isAllBranches) {
          const pricePayload = {
            product_id: productId,
            branch_id: selectedBranch.id,
            company_id: selectedBranch.company_id,
            price: parseInt(formData.price) || 0,
            has_discount: formData.has_discount || false,
            discount_price: formData.has_discount ? (parseInt(formData.discount_price) || 0) : null,
            is_active: true
          };

          const { error: priceError } = await supabase.from(TABLES.product_prices).upsert(
            { ...pricePayload, id: editingProduct?.price_id },
            { onConflict: 'product_id, branch_id' }
          );
          if (priceError) throw priceError;

          // 3. Guardar/Actualizar Estado en Sucursal
          const branchPayload = {
            product_id: productId,
            branch_id: selectedBranch.id,
            // Si estamos editando, mantener estado actual. Si es nuevo, activo por defecto.
            is_active: editingProduct ? editingProduct.is_active : true,
            is_special: formData.is_special || false
          };

          const { error: branchError } = await supabase.from(TABLES.product_branch).upsert(
            { ...branchPayload, id: editingProduct?.branch_relation_id },
            { onConflict: 'product_id, branch_id' }
          );
          if (branchError) throw branchError;
      }

      showNotify(editingProduct ? "Producto actualizado" : "Producto creado");
      setIsModalOpen(false);
      loadData(true);
    } catch (error) {
      showNotify("Error: " + error.message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('¿Eliminar producto?')) return;
    try {
      // MEJORA LÓGICA: Limpieza manual de relaciones para evitar errores de FK
      await supabase.from(TABLES.product_prices).delete().eq('product_id', id);
      await supabase.from(TABLES.product_branch).delete().eq('product_id', id);
      await supabase.from(TABLES.products).delete().eq('id', id);
      
      showNotify("Producto eliminado");
      loadData(true);
    } catch {
      showNotify("No se puede eliminar (tiene ventas asociadas)", 'error');
    }
  };

  // --- 3.1 TOGGLE CON CONFIRMACIÓN DE ALCANCE ---
  const toggleProductActive = async (product, e) => {
    e.stopPropagation();
    if (!selectedBranch) return;
    
    // Abrir modal para decidir alcance
    setScopeModal({
      isOpen: true,
      item: product,
      type: 'product'
    });
  };

  const handleScopeConfirm = async (scope) => {
    const { item, type } = scopeModal;
    setScopeModal({ ...scopeModal, isOpen: false });

    if (!item) return;

    const newActive = !item.is_active;

    // Actualización optimista en UI
    if (type === 'product') {
      setProducts(prev => prev.map(p => p.id === item.id ? { ...p, is_active: newActive } : p));
    }

    try {
      if (scope === 'global' || selectedBranch.id === 'all') {
        // Actualizar GLOBALMENTE (Tabla products)
        await supabase.from(TABLES.products).update({ is_active: newActive }).eq('id', item.id);
        showNotify(newActive ? 'Activado en todos los locales' : 'Desactivado en todos los locales');
      } else {
        // Actualizar LOCALMENTE (Tabla product_branch)
        await supabase.from(TABLES.product_branch).upsert({
          product_id: item.id,
          branch_id: selectedBranch.id,
          is_active: newActive
        }, { onConflict: 'product_id, branch_id' });
        showNotify(newActive ? 'Activado en este local' : 'Desactivado en este local');
      }
    } catch {
      loadData(true);
      showNotify('Error al cambiar estado', 'error');
    }
  };

  const handleSaveCategory = async (formData) => {
    try {
      const payload = { 
        name: formData.name, 
        order: parseInt(formData.order), 
        is_active: formData.is_active 
      };

      // Asignar company_id (necesario por la nueva BD)
      if (selectedBranch && selectedBranch.id !== 'all') {
        payload.company_id = selectedBranch.company_id;
      } else if (branches.length > 0) {
        payload.company_id = branches[0].company_id;
      }

      if (editingCategory) {
        await supabase.from(TABLES.categories).update(payload).eq('id', editingCategory.id);
      } else {
        // Dejar que la base de datos genere el UUID
        await supabase.from(TABLES.categories).insert(payload);
      }
      setIsCategoryModalOpen(false);
      loadData(true);
      showNotify('Categoría guardada');
    } catch (error) {
      console.error(error);
      showNotify('Error al guardar: ' + error.message, 'error');
    }
  };


  // --- 6. ESTADÍSTICAS AVANZADAS ---


  const kanbanColumns = useMemo(() => ({
    pending: orders.filter(o => o.status === 'pending'),
    active: orders.filter(o => o.status === 'active'),
    completed: orders.filter(o => o.status === 'completed'),
    cancelled: orders.filter(o => o.status === 'cancelled'), // Nueva columna visible
    history: orders.filter(o => o.status === 'picked_up' || o.status === 'cancelled')
  }), [orders]);

  // --- LÓGICA DE FILTRADO Y ORDENAMIENTO DE PRODUCTOS ---
  const processedProducts = useMemo(() => {
    let result = products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (filterCategory === 'all' || p.category_id === filterCategory) &&
      (filterStatus === 'all' || (filterStatus === 'active' ? p.is_active : !p.is_active))
    );

    return result.sort((a, b) => {
      if (sortOrder === 'name-asc') return a.name.localeCompare(b.name);
      if (sortOrder === 'price-asc') return a.price - b.price;
      if (sortOrder === 'price-desc') return b.price - a.price;
      return 0;
    });
  }, [products, searchQuery, filterCategory, filterStatus, sortOrder]);

  // Estadísticas rápidas de productos
  const productStats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter(p => p.is_active).length,
      paused: products.filter(p => !p.is_active).length
    };
  }, [products]);

  const value = useMemo(() => ({
    navigate,
    activeTab, setActiveTab,
    products, setProducts,
    categories, setCategories,
    orders, setOrders,
    clients, setClients,
    branches, setBranches,
    selectedBranch, setSelectedBranch,
    isHistoryView, setIsHistoryView,
    mobileTab, setMobileTab,
    searchQuery, setSearchQuery,
    filterCategory, setFilterCategory,
    filterStatus, setFilterStatus,
    viewMode, setViewMode,
    sortOrder, setSortOrder,
    loading, setLoading,
    refreshing, setRefreshing,
    isMobile, setIsMobile,
    isModalOpen, setIsModalOpen,
    editingProduct, setEditingProduct,
    isCategoryModalOpen, setIsCategoryModalOpen,
    editingCategory, setEditingCategory,
    notification, setNotification,
    receiptModalOrder, setReceiptModalOrder,
    receiptPreview, setReceiptPreview,
    isManualOrderModalOpen, setIsManualOrderModalOpen,
    uploadingReceipt, setUploadingReceipt,
    selectedClient, setSelectedClient,
    selectedClientOrders, setSelectedClientOrders,
    clientHistoryLoading, setClientHistoryLoading,
    userRole,
    showNotify,
    cashSystem,
    loadData,
    handleSelectClient,
    moveOrder,
    uploadReceiptToOrder,
    handleReceiptFileChange,
    handleSaveProduct,
    deleteProduct,
    toggleProductActive,
    scopeModal,
    handleScopeConfirm,
    setScopeModal,
    handleSaveCategory,
    kanbanColumns,
    processedProducts,
    productStats,
    userEmail,
  }), [
    navigate,
    activeTab,
    products,
    categories,
    orders,
    clients,
    branches,
    selectedBranch,
    isHistoryView,
    mobileTab,
    searchQuery,
    filterCategory,
    filterStatus,
    viewMode,
    sortOrder,
    loading,
    refreshing,
    isMobile,
    isModalOpen,
    editingProduct,
    isCategoryModalOpen,
    editingCategory,
    notification,
    receiptModalOrder,
    receiptPreview,
    isManualOrderModalOpen,
    uploadingReceipt,
    selectedClient,
    selectedClientOrders,
    clientHistoryLoading,
    userRole,
    showNotify,
    cashSystem, // Ahora es estable gracias al fix en useCashSystem
    loadData,
    handleSelectClient,
    moveOrder,
    uploadReceiptToOrder,
    handleReceiptFileChange,
    handleSaveProduct,
    deleteProduct,
    toggleProductActive,
    scopeModal,
    handleScopeConfirm,
    setScopeModal,
    handleSaveCategory,
    kanbanColumns,
    processedProducts,
    productStats,
    userEmail
  ]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

const AdminComponent = () => {
  const {
    navigate,
    activeTab, setActiveTab,
    products,
    categories,
    orders,
    clients,
    branches,
    selectedBranch, setSelectedBranch,
    isHistoryView, setIsHistoryView,
    mobileTab, setMobileTab,
    searchQuery, setSearchQuery,
    filterCategory, setFilterCategory,
    filterStatus, setFilterStatus,
    viewMode, setViewMode,
    sortOrder, setSortOrder,
    loading,
    refreshing,
    isMobile,
    isModalOpen, setIsModalOpen,
    editingProduct, setEditingProduct,
    isCategoryModalOpen, setIsCategoryModalOpen,
    editingCategory, setEditingCategory,
    notification,
    receiptModalOrder, setReceiptModalOrder,
    receiptPreview, setReceiptPreview,
    isManualOrderModalOpen, setIsManualOrderModalOpen,
    uploadingReceipt,
    selectedClient, setSelectedClient,
    selectedClientOrders,
    clientHistoryLoading,
    showNotify,
    cashSystem,
    loadData,
    handleSelectClient,
    moveOrder,
    uploadReceiptToOrder,
    handleReceiptFileChange,
    handleSaveProduct,
    deleteProduct,
    toggleProductActive,
    scopeModal,
    handleScopeConfirm,
    setScopeModal,
    handleSaveCategory,
    kanbanColumns,
    processedProducts,
    productStats,
    userRole,
    userEmail,
  } = useAdmin();

  if (loading && !refreshing && products.length === 0 && orders.length === 0) return (
    <div className="admin-layout flex-center" style={{ height: '100vh', background: '#0a0a0a', flexDirection: 'column', gap: 20 }}>
      <Loader2 className="animate-spin" size={60} color="#e63946" />
      <h3 style={{ color: 'white' }}>Cargando Sistema...</h3>
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

      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobile={isMobile}
        kanbanColumns={kanbanColumns}
        userRole={userRole}
        userEmail={userEmail}
        branchName={selectedBranch?.name}
        onLogout={async () => {
          await supabase.auth.signOut();
          navigate('/login');
        }}
      />

      <main className="admin-content">
        <header className="content-header">
          <h1>
            {activeTab === 'orders' ? (isHistoryView ? 'Historial' : 'Cocina en Vivo') :
              activeTab === 'products' ? 'Inventario' :
                activeTab === 'analytics' ? 'Rendimiento' :
                  activeTab === 'clients' ? 'Clientes' :
                    activeTab === 'caja' ? 'Caja y Turnos' :
                      activeTab === 'settings' ? 'Herramientas' :
                      activeTab === 'company' ? 'Datos de la empresa' : 'Categorías'}
          </h1>

          <div className="header-actions">
            <button onClick={() => loadData(true)} className="btn-icon-refresh" disabled={refreshing}>
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </button>

            {/* SELECTOR DE SUCURSAL */}
            <div className="branch-selector-wrapper" style={{ marginRight: 10 }}>
              <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: 8, gap: 8 }}>
                <MapPin size={16} className="text-accent" />
                <select 
                  value={selectedBranch?.id || ''} 
                  onChange={(e) => {
                    if (e.target.value === 'all') {
                      setSelectedBranch({ id: 'all', name: 'Todas las sucursales' });
                    } else {
                      const branch = branches.find(b => b.id === e.target.value);
                      setSelectedBranch(branch);
                    }
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  {branches.map(b => <option key={b.id} value={b.id} style={{color: 'black'}}>{b.name}</option>)}
                  {activeTab === 'analytics' && (
                    <option value="all" style={{color: 'black', fontWeight: 'bold'}}>Todas las sucursales</option>
                  )}
                </select>
              </div>
            </div>

            {activeTab === 'orders' && (
              <>
                <button className={`btn ${isHistoryView ? 'btn-primary' : 'btn-secondary'}`} 
                        onClick={() => setIsHistoryView(!isHistoryView)}
                        style={!isHistoryView ? { background: 'white', color: '#1a1a1a', border: '1px solid #e5e7eb' } : {}}
                >
                  {isHistoryView ? 'Ver Tablero' : 'Ver Historial'}
                </button>
                <button
                  onClick={() => setIsManualOrderModalOpen(true)}
                  className="btn btn-primary"
                  disabled={selectedBranch?.id === 'all' || !selectedBranch}
                  title={selectedBranch?.id === 'all' ? 'Selecciona una sucursal' : undefined}
                >
                  <PlusCircle size={18} /> Pedido Manual
                </button>
              </>
            )}
            {activeTab === 'products' && (
              <button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="btn btn-primary"><Plus size={18} /> Nuevo Plato</button>
            )}
            {activeTab === 'categories' && (
              <button onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true); }} className="btn btn-primary"><Plus size={18} /> Nueva Categ.</button>
            )}
          </div>
        </header>

        {/* 1. PEDIDOS */}
        {activeTab === 'orders' && (
          !isHistoryView ? (
            <AdminKanban
              columns={kanbanColumns}
              isMobile={isMobile}
              mobileTab={mobileTab}
              setMobileTab={setMobileTab}
              moveOrder={moveOrder}
              setReceiptModalOrder={setReceiptModalOrder}
            />
          ) : (
            <AdminHistoryTable orders={kanbanColumns.history} setReceiptModalOrder={setReceiptModalOrder} />
          )
        )}

        {/* 2. INVENTARIO */}
        {activeTab === 'products' && (
          <div className="products-view animate-fade">
            
            {/* BARRA DE ESTADÍSTICAS */}
            <div className="stats-bar glass" style={{ display: 'flex', gap: 20, padding: '15px 20px', marginBottom: 20, borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 8 }}><Package size={18} /></div>
                <div><span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>Total Platos</span><strong style={{ fontSize: '1.1rem' }}>{productStats.total}</strong></div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(37, 211, 102, 0.1)', color: '#25d366', padding: 8, borderRadius: 8 }}><Eye size={18} /></div>
                <div><span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>Activos</span><strong style={{ fontSize: '1.1rem', color: '#25d366' }}>{productStats.active}</strong></div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: 8, borderRadius: 8 }}><EyeOff size={18} /></div>
                <div><span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>Pausados</span><strong style={{ fontSize: '1.1rem', color: '#ef4444' }}>{productStats.paused}</strong></div>
              </div>
            </div>

            <div className="admin-toolbar glass">
              <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                <div className="search-box" style={{ flex: 1 }}>
                  <Search size={18} />
                  <input placeholder="Buscar plato..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                
                <div className="filter-box">
                  <Filter size={18} />
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="all">Todas las categorías</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="filter-box">
                  <Eye size={18} />
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">Todos los estados</option>
                    <option value="active">Solo Activos</option>
                    <option value="paused">Solo Pausados</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 10 }}>
                 <div className="filter-box" style={{ minWidth: 'auto' }}>
                    <ArrowUpDown size={18} />
                    <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                      <option value="name-asc">Nombre (A-Z)</option>
                      <option value="price-asc">Precio (Menor a Mayor)</option>
                      <option value="price-desc">Precio (Mayor a Menor)</option>
                    </select>
                 </div>
                 <button className={`btn-icon-toggle ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Vista Grilla">
                    <LayoutGrid size={18} />
                 </button>
                 <button className={`btn-icon-toggle ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="Vista Lista">
                    <List size={18} />
                 </button>
              </div>
            </div>
            
            <div className={`inventory-grid ${viewMode === 'list' ? 'list-mode' : ''}`}>
              {processedProducts.map(p => (
                  <InventoryCard
                    key={p.id}
                    product={p}
                    viewMode={viewMode}
                    toggleProductActive={toggleProductActive}
                    setEditingProduct={setEditingProduct}
                    setIsModalOpen={setIsModalOpen}
                    deleteProduct={deleteProduct}
                  />
                ))
              }
            </div>
          </div>
        )}

        {/* 2.5 NUEVO INVENTARIO (INSUMOS) */}
        {activeTab === 'inventory' && (
            <AdminInventory showNotify={showNotify} branchId={selectedBranch?.id} />
        )}

        {/* 3. REPORTES */}
        {activeTab === 'analytics' && (
          <AdminAnalytics 
            orders={orders} 
            products={products} 
            clients={clients} 
            branches={branches.filter(b => b.id !== 'all')}
            selectedBranch={selectedBranch}
          />
        )}

        {/* 4. CLIENTES */}
        {activeTab === 'clients' && (
          <AdminClients 
            clients={clients}
            orders={orders}
            onSelectClient={handleSelectClient}
            onClientCreated={() => loadData(true)}
            showNotify={showNotify}
          />
        )}

        {/* 4.5 CAJA */}
        {activeTab === 'caja' && (
          <CashManager showNotify={showNotify} selectedBranchId={selectedBranch?.id} />
        )}

        {/* 5. CATEGORÍAS */}
        {activeTab === 'categories' && (
          <div className="cat-container">
            <div className="cat-header">
              <div className="cat-header-left">
                <h2 className="cat-title">Categorías</h2>
                <p className="cat-subtitle">Gestiona tus categorías de productos</p>
              </div>
              <div className="cat-header-actions">
                {categories.length > 0 && (
                  <button onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true) }} className="btn btn-primary">
                    <Plus size={18} /> Nueva Categoría
                  </button>
                )}
              </div>
            </div>
            
            <div className="cat-grid">
              {categories.map(c => {
                const categoryProducts = products.filter(p => p.category_id === c.id);
                const activeProducts = categoryProducts.filter(p => p.is_active);
                const totalRevenue = categoryProducts.reduce((sum, p) => sum + (p.price || 0), 0);
                
                return (
                  <div key={c.id} className="cat-card glass">
                    <div className="cat-card-header">
                      <div className="cat-icon-wrapper">
                        <Tag size={24} />
                      </div>
                      <div className="cat-status-badge">
                        <span className={`cat-status-dot ${c.is_active ? 'active' : 'inactive'}`}></span>
                        <span className="cat-status-text">{c.is_active ? 'Activa' : 'Inactiva'}</span>
                      </div>
                    </div>
                    
                    <div className="cat-card-body">
                      <h3 className="cat-name">{c.name}</h3>
                      
                      <div className="cat-stats">
                        <div className="cat-stat">
                          <span className="cat-stat-label">Productos</span>
                          <span className="cat-stat-value">{categoryProducts.length}</span>
                        </div>
                        <div className="cat-stat">
                          <span className="cat-stat-label">Activos</span>
                          <span className="cat-stat-value">{activeProducts.length}</span>
                        </div>
                      </div>
                      
                      <div className="cat-revenue">
                        <span className="cat-revenue-label">Ingresos totales</span>
                        <span className="cat-revenue-value">${totalRevenue.toLocaleString('es-CL')}</span>
                      </div>
                      
                      <div className="cat-progress-wrapper">
                        <div className="cat-progress-bar">
                          <div 
                            className="cat-progress-fill" 
                            style={{ width: `${products.length > 0 ? (categoryProducts.length / products.length) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="cat-progress-text">
                          {products.length > 0 ? Math.round((categoryProducts.length / products.length) * 100) : 0}% del catálogo
                        </span>
                      </div>
                    </div>
                    
                    <div className="cat-card-footer">
                      <button 
                        onClick={() => { setEditingCategory(c); setIsCategoryModalOpen(true) }} 
                        className="cat-btn-edit"
                      >
                        <Edit size={16} />
                        Editar
                      </button>
                      <button 
                        onClick={() => setActiveTab('products')}
                        className="cat-btn-view"
                      >
                        <ShoppingBag size={16} />
                        Ver productos
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {categories.length === 0 && (
                <div className="cat-empty-state">
                  <div className="cat-empty-icon">
                    <List size={48} />
                  </div>
                  <h3 className="cat-empty-title">No hay categorías</h3>
                  <p className="cat-empty-text">Crea tu primera categoría para organizar tus productos</p>
                  <button 
                    onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true) }} 
                    className="btn btn-primary"
                  >
                    <Plus size={18} /> Crear Categoría
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. HERRAMIENTAS */}
        {activeTab === 'settings' && (
          <div className="settings-view animate-fade">
             <AdminSettings showNotify={showNotify} isMobile={isMobile} selectedBranch={selectedBranch} />

             {/* ZONA DE PELIGRO (FUNCIONES AVANZADAS) */}
             <AdminDangerZone 
                orders={orders} 
                showNotify={showNotify} 
                loadData={loadData} 
                isMobile={isMobile}
                selectedBranch={selectedBranch}
             />
          </div>
        )}

        {/* 7. DATOS DE LA EMPRESA (solo rol admin) */}
        {activeTab === 'company' && (
          <div className="settings-view animate-fade">
            <AdminCompanyData showNotify={showNotify} isMobile={isMobile} branches={branches} />
          </div>
        )}
      </main>

      {/* PANEL CLIENTE LATERAL (MODULARIZADO) */}
      <ClientDetailsPanel
        selectedClient={selectedClient}
        setSelectedClient={setSelectedClient}
        clientHistoryLoading={clientHistoryLoading}
        selectedClientOrders={selectedClientOrders}
        setReceiptModalOrder={setReceiptModalOrder}
      />



      {/* MODAL COMPROBANTE (EXISTENTE) */}
      {receiptModalOrder && (
        <div className="admin-panel-overlay" onClick={() => { setReceiptModalOrder(null); setReceiptPreview(null); }}>
          <div className="admin-side-panel glass animate-slide-in" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
            <div className="admin-side-header">
              <h3>Comprobante de Pago</h3>
              <button onClick={() => { setReceiptModalOrder(null); setReceiptPreview(null); }} className="btn-close-sidepanel"><X size={24} /></button>
            </div>
            <div className="admin-side-body">
              {receiptModalOrder.payment_ref && receiptModalOrder.payment_ref.startsWith('http') && !receiptPreview && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ marginBottom: 10, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Comprobante actual:</p>
                  <a href={receiptModalOrder.payment_ref} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: 15 }}>
                    <img src={receiptModalOrder.payment_ref} alt="Comprobante" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--card-border)' }} />
                  </a>
                </div>
              )}

              <div className="form-group">
                <label>Subir nuevo comprobante</label>
                <div className="upload-box" onClick={() => document.getElementById('receipt-upload-modal').click()} style={{ borderColor: receiptPreview ? '#25d366' : 'var(--card-border)' }}>
                  <input type="file" id="receipt-upload-modal" accept="image/*" hidden onChange={handleReceiptFileChange} />
                  {receiptPreview ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15, justifyContent: 'center', position: 'relative' }}>
                      <img src={receiptPreview} alt="Preview" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid white' }} />
                      <div style={{ textAlign: 'left' }}>
                        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'white' }}>Imagen Seleccionada</span>
                        <span style={{ fontSize: '0.75rem', color: '#25d366' }}>Click para cambiar</span>
                        <button 
                          type="button" 
                          className="btn-text" 
                          style={{ color: '#ff4444', fontSize: '0.75rem', padding: 0, marginTop: 4 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setReceiptPreview(null);
                            document.getElementById('receipt-upload-modal').value = '';
                          }}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <Upload size={24} />
                      <span>Subir imagen</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="admin-side-footer">
              <button
                className="btn btn-primary btn-block"
                onClick={() => {
                  const fileInput = document.getElementById('receipt-upload-modal');
                  if (fileInput?.files[0]) {
                    uploadReceiptToOrder(receiptModalOrder.id, fileInput.files[0]);
                  } else {
                    showNotify('Selecciona una imagen', 'error');
                  }
                }}
                disabled={uploadingReceipt || !receiptPreview}
              >
                {uploadingReceipt ? 'Subiendo...' : 'Guardar Comprobante'}
              </button>
            </div>
          </div>
        </div>
      )}


      <ManualOrderModal
        isOpen={isManualOrderModalOpen}
        onClose={() => setIsManualOrderModalOpen(false)}
        products={products}
        categories={categories}
        onOrderSaved={() => loadData(true)}
        isMobile={isMobile}
        showNotify={showNotify}
        registerSale={cashSystem.registerSale}
        branch={selectedBranch} // Pass selected branch
      />

      {isModalOpen && (
        <ProductModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveProduct} 
          product={editingProduct} 
          categories={categories} 
          saving={refreshing}
        />
      )}

      {/* MODAL DE SELECCIÓN DE ALCANCE */}
      <ScopeSelectionModal
        isOpen={scopeModal.isOpen}
        onClose={() => setScopeModal({ ...scopeModal, isOpen: false })}
        onConfirm={handleScopeConfirm}
        branchName={selectedBranch?.name || 'Sucursal'}
        actionType={scopeModal.item?.is_active ? 'deactivate' : 'activate'}
      />

      <CategoryModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} onSave={handleSaveCategory} category={editingCategory} />
    </div>
  );
};

const Admin = () => (
  <AdminProvider>
    <AdminComponent />
  </AdminProvider>
);

export default Admin;
