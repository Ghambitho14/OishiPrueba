import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { CartProvider } from "./app/providers/CartProvider";
import { BusinessProvider } from "./context/BusinessContext";
import { LocationProvider } from "./context/LocationContext";

// Páginas
import Home from "./shared/components/Home";
import Menu from "./features/products/pages/Menu";
import Admin from "./features/admin/pages/Admin";
import Login from "./features/auth/pages/Login";

// Assets
import menuPattern from "./assets/menu-pattern.webp";

// Componentes Globales
import ProtectedRoute from "./shared/components/ProtectedRoute";
import CartFloat from "./features/cart/components/CartFloat";
import CartModal from "./features/cart/components/CartModal";

// Componente Interno que maneja la lógica Anti-Zoom y UI Global con contexto de Router
function InnerApp() {
  const location = useLocation();
  const showCartUI = location.pathname === "/menu";
  const [scrollY, setScrollY] = useState(0);

  // Efecto Parallax Suave para el fondo
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);



  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100%",
        background: "#0a0a0a",
      }}
    >
      {/* CAPA DE FONDO MAESTRA (Dinámica según ruta) */}
      <div
        className="app-bg-layer"
        style={
          location.pathname === "/"
            ? {
                position: "fixed",
                inset: 0,
                zIndex: 0,
                backgroundImage:
                  'url("https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=1000")',
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 1,
                filter: "none", // Sin blur en Home para nitidez
                transform: "none", // Sin parallax en Home para estabilidad
                pointerEvents: "none",
              }
            : {
                position: "fixed",
                inset: "-50% -20%",
                zIndex: 0,
                backgroundImage: `url(${menuPattern})`,
                backgroundRepeat: "repeat",
                backgroundSize: "1200px",
                opacity: 0.5,
                filter: "brightness(0.18) blur(3px)",
                transform: `translateY(${-scrollY * 0.1}px)`,
                transition: "transform 0.1s ease-out",
                pointerEvents: "none",
                willChange: "transform",
              }
        }
      ></div>

      {/* Capa de Contenido Principal (Scrollable) */}
      <div
        id="app-content-layer"
        className="app-wrapper"
        style={{
          position: "relative",
          zIndex: 1,
          background: "transparent",
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/login" element={<Login />} />

          {/* Ruta Protegida para Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>

      {/* Capa de UI Flotante */}
      <div
        id="app-ui-layer"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          pointerEvents: "none",
        }}
      >
        <div
          id="navbar-portal-root"
          style={{ pointerEvents: "auto", width: "100%" }}
        ></div>
        {showCartUI && (
          <div style={{ pointerEvents: "auto" }}>
            <CartFloat />
            <CartModal />
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <BusinessProvider>
      <LocationProvider>
        <CartProvider>
          <Router>
            <InnerApp />
          </Router>
        </CartProvider>
      </LocationProvider>
    </BusinessProvider>
  );
}

export default App;
