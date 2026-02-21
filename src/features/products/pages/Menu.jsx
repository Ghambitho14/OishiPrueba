import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Navbar from '../../../shared/components/Navbar';
import ProductCard from '../components/ProductCard';
import { Search, ChevronLeft, Loader2, X, MapPin, ChevronDown } from 'lucide-react';
import '../../../styles/Menu.css';
import '../../../styles/Navbar.css';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import logo from '../../../assets/logo.png';
import BranchSelectorModal from '../../../shared/components/BranchSelectorModal';
import { useLocation } from '../../../context/useLocation';
import { useCash } from '../../../context/CashContext';
import { useBusiness } from '../../../context/useBusiness';
import { branches as staticBranches } from '../../../shared/data/branches';

const Menu = () => {
  const navigate = useNavigate();
  const { selectedBranch, selectBranch, isLocationModalOpen, setIsLocationModalOpen } = useLocation();
  const { branchesWithOpenCaja, isShiftLoading } = useCash();
  const { businessInfo } = useBusiness();

  // Si la sucursal guardada ya no tiene caja abierta, abrir modal para elegir una que sí acepte pedidos
  useEffect(() => {
    if (!isShiftLoading && selectedBranch && !branchesWithOpenCaja.includes(String(selectedBranch.id ?? ''))) {
      setIsLocationModalOpen(true);
    }
  }, [isShiftLoading, selectedBranch, branchesWithOpenCaja, setIsLocationModalOpen]);
  
  // Agrupamos estados relacionados para evitar renders innecesarios
  const [data, setData] = useState({ categories: [], products: [], branches: [] });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  
  const searchInputRef = useRef(null);
  const isManualScrolling = useRef(false);

  const FIRE_ICON = "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif";

  // 1. Carga de datos optimizada (Paralela)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Cargar sucursales (siempre necesario para el modal)
        let branchesData = [];
        try {
          const { data, error } = await supabase
            .from('branches')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });
          if (!error) branchesData = data || [];
        } catch (_) { /* fallback abajo */ }
        if (branchesData.length === 0) branchesData = staticBranches;

        // Si no hay sucursal seleccionada, solo guardamos branches y paramos (el modal se abrirá)
        if (!selectedBranch) {
          setData({ categories: [], products: [], branches: branchesData || [] });
          setLoading(false);
          setIsLocationModalOpen(true);
          return;
        }

        // 2. Cargar datos dependientes de la sucursal (Precios y Estado Local)
        const [catsRes, prodsRes, pricesRes, statusRes] = await Promise.all([
          supabase.from('categories').select('*').eq('is_active', true).order('order', { ascending: true }),
          supabase.from('products').select('*').order('name', { ascending: true }), // Traemos base global
          supabase.from('product_prices').select('*').eq('branch_id', selectedBranch.id),
          supabase.from('product_branch').select('*').eq('branch_id', selectedBranch.id)
        ]);

        if (catsRes.error) throw catsRes.error;
        if (prodsRes.error) throw prodsRes.error;
        if (pricesRes.error) throw pricesRes.error;
        if (statusRes.error) throw statusRes.error;

        const branchPrices = pricesRes.data || [];
        const branchStatuses = statusRes.data || [];

        // --- FUSIÓN DE DATOS ESTRICTA ---
        const processedProducts = prodsRes.data.map(prod => {
          const priceData = branchPrices.find(p => p.product_id === prod.id);
          const statusData = branchStatuses.find(s => s.product_id === prod.id);

          // 1. Si no tiene registro en product_branch o is_active es false, lo descartamos
          if (!statusData || !statusData.is_active) return null;

          // 2. Si no tiene precio configurado para esta sucursal (o es 0), lo descartamos
          const price = (priceData && Number(priceData.price) > 0) ? Number(priceData.price) : 0;
          if (price <= 0) return null;

          return {
            ...prod,
            price: price,
            has_discount: priceData ? priceData.has_discount : false,
            discount_price: priceData ? Number(priceData.discount_price) : null,
            is_active: true, // Ya filtramos los inactivos
            is_special: statusData.is_special // Usar flag de sucursal
          };
        }).filter(p => p !== null);

        const categoriesData = catsRes.data || [];
        
        setData({ categories: categoriesData, products: processedProducts, branches: branchesData || [] });

        // Lógica de categoría inicial
        const hasSpecial = processedProducts.some(p => p.is_special);
        setActiveCategory(hasSpecial ? 'special' : categoriesData[0]?.id || null);

      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedBranch, setIsLocationModalOpen]);

  // 2. Filtrado memoizado para rendimiento
  const { specialProducts, filteredBySearch, query } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return {
      specialProducts: data.products.filter(p => p.is_special),
      filteredBySearch: q ? data.products.filter(p => p.name?.toLowerCase().includes(q)) : [],
      query: q
    };
  }, [data.products, searchQuery]);

  // 3. Función de scroll memoizada
  const scrollToCategory = useCallback((id) => {
    isManualScrolling.current = true;
    setActiveCategory(id);

    const element = document.getElementById(`section-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { isManualScrolling.current = false; }, 1000);
    }
  }, []);

  // 4. Scroll Spy (Intersection Observer) optimizado
  useEffect(() => {
    if (loading || query) return;

    const observerOptions = {
      root: null,
      rootMargin: '-140px 0px -70% 0px',
      threshold: 0
    };

    const observerCallback = (entries) => {
      if (isManualScrolling.current) return;
      
      const visible = entries.find(entry => entry.isIntersecting);
      if (visible) {
        const id = visible.target.id.replace('section-', '');
        setActiveCategory(id);
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const sections = document.querySelectorAll('.category-section');
    sections.forEach(section => observer.observe(section));

    return () => observer.disconnect();
  }, [loading, query, data.categories]);

  // 5. Gestión limpia del scroll del body
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    if (isLocationModalOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = originalStyle; };
  }, [isLocationModalOpen]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Loader2 size={40} className="animate-spin" color="var(--accent-primary)" />
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      {document.getElementById('navbar-portal-root') && createPortal(
        <header className="navbar-sticky" style={{ zIndex: isLocationModalOpen ? 0 : 100 }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
              <ChevronLeft size={28} />
            </button>
            <div className={`nav-brand-wrapper ${searchExpanded ? 'mobile-search-active' : ''}`}>
              <img src={logo} alt="Oishi Logo" style={{ height: '38px', width: 'auto', borderRadius: '6px' }} />
              <div className="nav-brand-info">
                <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: 'white', lineHeight: '1.2' }}>Oishi Sushi</h2>
                <button 
                  onClick={() => setIsLocationModalOpen(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '20px',
                    padding: '4px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    marginTop: '2px',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <MapPin size={12} color="var(--accent-primary)" style={{ filter: 'drop-shadow(0 0 2px rgba(255, 71, 87, 0.5))' }} />
                  <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 600, letterSpacing: '0.3px' }}>
                    {selectedBranch ? selectedBranch.name : 'Seleccionar Local'}
                  </span>
                  <ChevronDown size={12} color="rgba(255,255,255,0.6)" />
                </button>
              </div>
            </div>
            <div className="nav-search-section">
              <div
                className={`search-pill-wrapper ${searchExpanded ? 'expanded' : ''}`}
                onClick={() => {
                  if (!searchExpanded) {
                    setSearchExpanded(true);
                    setTimeout(() => searchInputRef.current?.focus(), 150);
                  }
                }}
              >
                <Search size={20} className="search-icon-pill" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="search-input-pill"
                  placeholder="Buscar plato..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => { if (!searchQuery?.trim()) setSearchExpanded(false); }}
                  onClick={(e) => e.stopPropagation()}
                />
                {searchExpanded && (
                  <button
                    type="button"
                    className="btn-close-pill"
                    onClick={(e) => { e.stopPropagation(); setSearchExpanded(false); setSearchQuery(''); }}
                    aria-label="Cerrar búsqueda"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <Navbar
            categories={[
              ...(specialProducts.length > 0 ? [{
                id: 'special',
                name: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <img src={FIRE_ICON} style={{ width: '14px', height: '14px' }} alt="🔥" />
                    Solo por hoy
                  </div>
                )
              }] : []),
              ...data.categories
            ]}
            activeCategory={activeCategory}
            onCategoryClick={scrollToCategory}
          />
        </header>,
        document.getElementById('navbar-portal-root')
      )}

      <div style={{ height: 'var(--menu-header-height)', width: '100%' }}></div>

      <main className="container">
        {query && (
          <section id="section-search" className="category-section">
            <h2 className="category-title">Resultados para &quot;{searchQuery.trim()}&quot;</h2>
            {filteredBySearch.length > 0 ? (
              <div className="product-grid">
                {filteredBySearch.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>No hay platos con ese nombre.</p>
            )}
          </section>
        )}

        {!query && specialProducts.length > 0 && (
          <section id="section-special" className="category-section">
            <h2 className="category-title">
              <img src={FIRE_ICON} className="category-icon" alt="🔥" />
              Solo por hoy
            </h2>
            <div className="product-grid">
              {specialProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {!query && data.categories.map((cat) => {
          const catProducts = data.products.filter(p => p.category_id === cat.id);
          if (catProducts.length === 0) return null;

          return (
            <section key={cat.id} id={`section-${cat.id}`} className="category-section">
              <h2 className="category-title">{cat.name}</h2>
              <div className="product-grid">
                {catProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <BranchSelectorModal
        isOpen={isLocationModalOpen}
        onClose={() => {}} 
        branches={[...data.branches]
          .sort((a, b) => {
            const aOpen = branchesWithOpenCaja.includes(String(a?.id ?? ''));
            const bOpen = branchesWithOpenCaja.includes(String(b?.id ?? ''));
            if (aOpen === bOpen) return 0;
            return aOpen ? -1 : 1;
          })
          .map(b => {
            const isOpen = branchesWithOpenCaja.includes(String(b?.id ?? ''));
            return {
              ...b,
              name: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600 }}>{b.name}</span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: '999px',
                    backgroundColor: isOpen ? 'rgba(34, 197, 94, 0.15)' : 'rgba(107, 114, 128, 0.1)',
                    color: isOpen ? '#22c55e' : '#9ca3af',
                    border: `1px solid ${isOpen ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    letterSpacing: '0.5px'
                  }}>
                    {isOpen && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', boxShadow: '0 0 8px currentColor' }} />}
                    {isOpen ? 'ABIERTO' : 'CERRADO'}
                  </span>
                </div>
              ),
              disabled: !isOpen
            };
          })}
        allBranches={data.branches}
        isLoadingCaja={isShiftLoading}
        onSelectBranch={(branch) => {
          const original = data.branches.find(b => b.id === branch.id);
          if (original && branchesWithOpenCaja.includes(String(original.id ?? ''))) {
            selectBranch(original);
          }
        }}
        allowClose={false}
        schedule={businessInfo?.schedule}
      />
    </div>
  );
};

export default Menu;