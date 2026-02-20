import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Navbar from '../../../shared/components/Navbar';
import ProductCard from '../components/ProductCard';
import { Search, ChevronLeft, Loader2, X, MapPin } from 'lucide-react';
import '../../../styles/Menu.css';
import '../../../styles/Navbar.css';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import logo from '../../../assets/logo.png';
import BranchSelectorModal from '../../../shared/components/BranchSelectorModal';
import { useLocation } from '../../../context/useLocation';

const Menu = () => {
  const navigate = useNavigate();
  const { selectedBranch, selectBranch, isLocationModalOpen, setIsLocationModalOpen } = useLocation();
  
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
      try {
        const [catsResponse, prodsResponse, branchesResponse] = await Promise.all([
          supabase.from('categories').select('*').eq('is_active', true).order('order', { ascending: true }),
          supabase.from('products').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase.from('branches').select('*').eq('is_active', true).order('name', { ascending: true })
        ]);

        const categoriesData = catsResponse.data || [];
        const productsData = prodsResponse.data || [];
        const branchesData = branchesResponse.data || [];
        
        setData({ categories: categoriesData, products: productsData, branches: branchesData });

        // Lógica de categoría inicial
        const hasSpecial = productsData.some(p => p.is_special);
        setActiveCategory(hasSpecial ? 'special' : categoriesData[0]?.id || null);

      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    setIsLocationModalOpen(true);
  }, [setIsLocationModalOpen]);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={logo} alt="Oishi Logo" style={{ height: '38px', width: 'auto', borderRadius: '6px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: 'white' }}>Oishi Sushi</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 600 }}>Carta Digital</span>
                  <span 
                    style={{ fontSize: '0.65rem', color: 'white', opacity: 0.9, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '6px', marginLeft: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }} 
                    onClick={() => setIsLocationModalOpen(true)}
                  >
                    <MapPin size={10} /> {selectedBranch ? selectedBranch.name : 'Seleccionar Sucursal'}
                  </span>
                </div>
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
        branches={data.branches}
        onSelectBranch={selectBranch}
        allowClose={false} 
      />
    </div>
  );
};

export default Menu;