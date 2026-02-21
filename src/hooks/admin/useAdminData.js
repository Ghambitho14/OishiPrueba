// Ruta del archivo: src/hooks/admin/useAdminData.js

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { TABLES } from '../../lib/supabaseTables';

const PAGE_SIZE = 50;

// Capa de saneamiento robusta
const sanitizeOrder = (rawOrder) => {
  if (!rawOrder) return null;
  
  let cleanItems = [];
  if (rawOrder.items) {
    if (Array.isArray(rawOrder.items)) {
      cleanItems = rawOrder.items;
    } else if (typeof rawOrder.items === 'string') {
      try {
        const parsed = JSON.parse(rawOrder.items);
        cleanItems = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn(`Error parseando items orden ${rawOrder.id}`, e);
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
    created_at: rawOrder.created_at || new Date().toISOString(),
    payment_type: rawOrder.payment_type || 'unknown'
  };
};

export const useAdminData = (showNotify) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [ordersPage, setOrdersPage] = useState(0);

  // Carga inicial optimizada (Paralela)
  const loadInitialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [catsRes, prodsRes] = await Promise.all([
        supabase.from(TABLES.categories).select('*').order('order'),
        supabase.from(TABLES.products).select('*').order('name')
      ]);

      if (catsRes.error) throw catsRes.error;
      if (prodsRes.error) throw prodsRes.error;

      setCategories(catsRes.data || []);
      setProducts(prodsRes.data || []);

      const { data: ordsData, error: ordsError } = await supabase
        .from(TABLES.orders)
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (ordsError) throw ordsError;

      const cleanOrders = (ordsData || []).map(sanitizeOrder);
      setOrders(cleanOrders);
      setOrdersPage(1);
      setHasMoreOrders(cleanOrders.length === PAGE_SIZE);

      const { data: cltsData, error: cltsError } = await supabase
        .from(TABLES.clients)
        .select('*')
        .order('last_order_at', { ascending: false })
        .limit(100);

      if (cltsError) throw cltsError;
      setClients(cltsData || []);

    } catch (error) {
      console.error("Error cargando datos:", error);
      showNotify("Error de conexión al cargar datos", 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showNotify]);

  // Paginación de órdenes
  const loadMoreOrders = async () => {
    if (loadingMoreOrders || !hasMoreOrders) return;
    setLoadingMoreOrders(true);

    try {
      const from = ordersPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from(TABLES.orders)
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data.length > 0) {
        const newOrders = data.map(sanitizeOrder);
        setOrders(prev => {
          const existingIds = new Set(prev.map(o => o.id));
          const filteredNew = newOrders.filter(o => !existingIds.has(o.id));
          return [...prev, ...filteredNew];
        });
        setOrdersPage(prev => prev + 1);
        if (data.length < PAGE_SIZE) setHasMoreOrders(false);
      } else {
        setHasMoreOrders(false);
      }
    } catch {
      showNotify('Error cargando historial antiguo', 'error');
    } finally {
      setLoadingMoreOrders(false);
    }
  };

  // Realtime Quirúrgico
  useEffect(() => {
    loadInitialData();
    
    let channel = null;
    let isMounted = true;
    
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; 
      
      channel = supabase.channel('admin-realtime-v2')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.orders }, (payload) => {
          if (!isMounted) return;

          if (payload.eventType === 'INSERT') {
            const newOrder = sanitizeOrder(payload.new);
            setOrders(prev => [newOrder, ...prev]);
            showNotify(`Nuevo pedido de ${newOrder.client_name}`, 'success');
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedOrder = sanitizeOrder(payload.new);
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          } 
          else if (payload.eventType === 'DELETE') {
             setOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
        })
        .subscribe();
    };
    
    setupRealtime();
    
    return () => { 
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadInitialData, showNotify]);

  return {
    products, setProducts,
    categories, setCategories,
    orders, setOrders,
    clients, setClients,
    loading, setRefreshing, refreshing,
    hasMoreOrders, loadingMoreOrders,
    loadInitialData, loadMoreOrders
  };
};