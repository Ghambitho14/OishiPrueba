import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Navbar from '../../../shared/components/Navbar';
import ProductCard from '../components/ProductCard';
import { Search, ChevronLeft, Loader2, X } from 'lucide-react';
import '../../../styles/Menu.css';
import '../../../styles/Navbar.css';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabase/client';
import logo from '../../../assets/logo.png';
import BranchSelectorModal from '../../../shared/components/BranchSelectorModal';
import { useLocation } from '../../../context/LocationContext';

const Menu = () => {
  const navigate = useNavigate();
  const { selectedBranch, selectBranch, isLocationModalOpen, setIsLocationModalOpen } = useLocation();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]); // Dynamic branches
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);

  // Load selected branch from context or local storage
  // (Handled by LocationContext)

  const handleBranchSelect = (branch) => {
      selectBranch(branch);
  };

  // Referencia para bloquear el Scroll Spy durante el desplazamiento manual
  const isManualScrolling = useRef(false);

  const FIRE_ICON = "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif";

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: categoriesData } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('order', { ascending: true });

        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });

        // Fetch Branches
        const { data: branchesData } = await supabase
            .from('branches')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });
        
        setCategories(categoriesData || []);
        setProducts(productsData || []);
        setBranches(branchesData || []);

        const hasSpecial = (productsData || []).some(p => p.is_special);
        if (hasSpecial) setActiveCategory('special');
        else if (categoriesData?.length > 0) setActiveCategory(categoriesData[0].id);

      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);



  // Función de scroll mejorada: Usa scrollIntoView nativo + scrollMarginTop CSS
  const scrollToCategory = (id) => {
    isManualScrolling.current = true;
    setActiveCategory(id);

    const element = document.getElementById(`section-${id}`);
    if (element) {
      // scrollMarginTop en el estilo del elemento maneja el offset del header
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });

      setTimeout(() => {
        isManualScrolling.current = false;
      }, 850);
    }
  };

  useEffect(() => {
    if (loading) return;

    // Si estamos haciendo scroll manual (clic en navbar), no actualizamos
    if (isManualScrolling.current) return;

    const observerOptions = {
      root: null, // viewport
      rootMargin: '-20% 0px -60% 0px', // Zona activa en el centro-superior de la pantalla
      threshold: 0
    };

    const observerCallback = (entries) => {
      if (isManualScrolling.current) return;

      // Filtramos solo las entradas que están intersectando
      const visibleSections = entries.filter(entry => entry.isIntersecting);

      if (visibleSections.length > 0) {
        // Si hay varias visibles, tomamos la que esté más arriba en la pantalla
        // o la que tenga mayor ratio de intersección
        const bestCandidate = visibleSections.reduce((prev, current) => {
          return (prev.intersectionRatio > current.intersectionRatio) ? prev : current;
        });

        const id = bestCandidate.target.id.replace('section-', '');
        setActiveCategory(id);
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observar sección especial si existe
    const specialSection = document.getElementById('section-special');
    if (specialSection) observer.observe(specialSection);

    // Observar todas las categorías
    categories.forEach(cat => {
      const el = document.getElementById(`section-${cat.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [categories, products, loading]); // Dependencias limpias

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isLocationModalOpen) {
      document.body.style.overflow = 'hidden';
      // También intentar bloquear el wrapper si existe
      const appWrapper = document.querySelector('.app-wrapper');
      if (appWrapper) appWrapper.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      const appWrapper = document.querySelector('.app-wrapper');
      if (appWrapper) appWrapper.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      const appWrapper = document.querySelector('.app-wrapper');
      if (appWrapper) appWrapper.style.overflow = '';
    };
  }, [isLocationModalOpen]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Loader2 size={40} className="animate-spin" color="var(--accent-primary)" />
      </div>
    );
  }

  const specialProducts = products.filter(p => p.is_special);
  const query = (searchQuery || '').trim().toLowerCase();
  const filteredBySearch = query
    ? products.filter(p => p.name?.toLowerCase().includes(query))
    : [];

  return (
    <div className="page-wrapper">
      {/* Portal del Header Fijo (Lo enviamos a la capa de UI fuera del scroll) */}
      {/* Condicional: Solo mostrar Navbar y contenido si NO está el modal bloqueando, 
          O usar z-index superior para el modal. Usaremos z-index superior. */}
      
      {document.getElementById('navbar-portal-root') && createPortal(
        <header className="navbar-sticky" style={{ zIndex: isLocationModalOpen ? 0 : 100 }}> {/* Bajar z-index si modal activo */}
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
                  {selectedBranch && (
                     <span style={{ fontSize: '0.65rem', color: 'white', opacity: 0.8, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '4px', cursor: 'pointer' }} onClick={() => setIsLocationModalOpen(true)}>
                       • {selectedBranch.name}
                     </span>
                  )}
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
              ...categories
            ]}
            activeCategory={activeCategory}
            onCategoryClick={scrollToCategory}
          />
        </header>,
        document.getElementById('navbar-portal-root')
      )}

      {/* Espaciador (Spacer) para empujar el contenido debajo del header fijo */}
      <div style={{ height: 'var(--menu-header-height)', width: '100%' }}></div>

      <main className="container">
        {/* BÚSQUEDA: resultados filtrados */}
        {query && (
          <section id="section-search" className="category-section">
            <h2 className="category-title">
              Resultados para &quot;{searchQuery.trim()}&quot;
            </h2>
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

        {/* SECCIÓN ESPECIAL (sin búsqueda activa) */}
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

        {/* CATEGORÍAS NORMALES (sin búsqueda activa) */}
        {!query && categories.map((cat) => {
          const catProducts = products.filter(p => p.category_id === cat.id);
          if (catProducts.length === 0) return null;

          return (
            <section key={cat.id} id={`section-${cat.id}`} className="category-section">
              <h2 className="category-title">
                {cat.name}
              </h2>
              <div className="product-grid">
                {catProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
      
      {/* Modal de Selección de Sucursal con Blur Overlay - Z-INDEX EXTREMO */}
      {isLocationModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(15px)', // Blur más intenso
          WebkitBackdropFilter: 'blur(15px)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)', // Fondo más oscuro
          zIndex: 2000000000, // Z-index máximo posible en muchos navegadores (casi)
          pointerEvents: 'auto' // Captura todos los clicks
        }} 
          // Prevenir scroll wheel
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        />
      )}
      
      <BranchSelectorModal
        isOpen={isLocationModalOpen}
        onClose={() => {}} // No permitir cerrar
        branches={branches}
        onSelectBranch={handleBranchSelect}
        allowClose={false} // Obligatorio seleccionar
      />
    </div>
  );
};

export default Menu;