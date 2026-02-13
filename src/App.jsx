import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext'; // Importante: El contexto debe envolver todo

// Páginas
import Home from './pages/Home';
import Menu from './pages/Menu'; // Asumo que aquí tienes tu vista de productos/menú
import Admin from './pages/Admin';
import Login from './pages/Login';

// Componentes Globales
import ProtectedRoute from './components/ProtectedRoute';
import CartFloat from './components/CartFloat'; // Tu botón flotante (antes FloatingWhatsApp)
import CartModal from './components/CartModal'; // El modal debe estar aquí para abrirse

function App() {
  return (
    <CartProvider>
      <Router>
        <div className="app-wrapper">
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

          {/* Elementos Flotantes Globales */}
          <CartFloat />
          <CartModal />
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;
  {/* hola */}