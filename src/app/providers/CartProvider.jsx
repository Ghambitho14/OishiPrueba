import React, { useState } from 'react';
import CartContext from '../../features/cart/hooks/cart-context';
import { supabase } from '../../lib/supabase';
import { TABLES } from '../../lib/supabaseTables';
import { useLocation } from '../../context/useLocation';

export const CartProvider = ({ children }) => {
  // 1. ESTADO INICIAL (CON PERSISTENCIA)
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('oishi_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderNote, setOrderNote] = useState('');

  const { selectedBranch } = useLocation();

  // 1.5. EFECTO: VALIDAR PRECIOS AL CARGAR (SEGURIDAD)
  React.useEffect(() => {
    const validatePrices = async () => {
      if (cart.length === 0) return;
      if (!selectedBranch) return; // No consultar precios sin sucursal

      try {
        const ids = cart.map(item => item.id);

        const { data, error } = await supabase
          .from(TABLES.product_prices)
          .select(`product_id, price, has_discount, discount_price, ${TABLES.products}(id,name,is_active,description)`)
          .in('product_id', ids)
          .eq('branch_id', selectedBranch.id);

        if (error) {
          console.error('validatePrices supabase error', error);
          return;
        }

        setCart(prevCart => prevCart.map(cartItem => {
          const priceRow = data ? data.find(p => p.product_id === cartItem.id) : null;
          const meta = priceRow?.products;

          if (priceRow) {
            return {
              ...cartItem,
              price: priceRow.price,
              has_discount: priceRow.has_discount,
              discount_price: priceRow.discount_price,
              name: meta?.name ?? cartItem.name,
              is_active: meta?.is_active ?? cartItem.is_active,
              description: meta?.description ?? cartItem.description
            };
          }

          if (meta) {
            return {
              ...cartItem,
              name: meta.name,
              is_active: meta.is_active,
              description: meta.description
            };
          }

          return cartItem;
        }).filter(item => item.is_active !== false));

      } catch (err) {
        console.error("Error validando precios del carrito:", err);
      }
    };

    // Re-ejecutar cuando cambie la sucursal o cambien los ids del carrito
    validatePrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, cart.map ? cart.map(i => i.id).join(',') : cart]);

  // 1.6 EFECTO: GUARDAR EN LOCALSTORAGE
  React.useEffect(() => {
    localStorage.setItem('oishi_cart', JSON.stringify(cart));
  }, [cart]);

  // 2. PRECIOS
  const getPrice = (product) => {
    if (product.has_discount && product.discount_price && parseInt(product.discount_price) > 0) {
      return parseInt(product.discount_price);
    }
    return parseInt(product.price);
  };

  // 3. ACCIONES
  const toggleCart = () => setIsCartOpen(prev => !prev);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        // LÍMITE DE SEGURIDAD: Máximo 20 unidades por producto para evitar errores/ataques
        if (existing.quantity >= 20) return prev; 
        
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // Guardamos una copia, pero el validador actualizará los precios al recargar
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const decreaseQuantity = (productId) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(0, item.quantity - 1) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };
  
  const clearCart = () => {
    setCart([]);
    setOrderNote('');
  };

  // 4. TOTALES
  const cartTotal = cart.reduce((acc, item) => acc + (getPrice(item) * item.quantity), 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  // 5. GENERADOR DE MENSAJE (CORREGIDO: SOLO TEXTO SIMPLE)
  const generateWhatsAppMessage = () => {
    if (cart.length === 0) return '';

    let message = '';
    // Usamos asteriscos y guiones simples que nunca fallan
    message += '*NUEVO PEDIDO WEB - OISHI*\n'; 
    message += '================================\n\n';

    cart.forEach(item => {
      const price = getPrice(item);
      const subtotal = price * item.quantity;
      
      // Formato simple: 2 x NOMBRE
      message += `+ ${item.quantity} x ${item.name.toUpperCase()}\n`;
      if (item.description) {
        message += `   (Hacer: ${item.description})\n`;
      }
      message += `   Subtotal: $${subtotal.toLocaleString('es-CL')}\n`;
      message += '--------------------------------\n';
    });

    message += '\n*TOTAL A PAGAR: $' + cartTotal.toLocaleString('es-CL') + '*\n';
    message += '================================\n';

    if (orderNote.trim()) {
      message += '\nNOTA DE COCINA:\n';
      message += `${orderNote}\n`;
    }

    return encodeURIComponent(message);
  };

  return (
    <CartContext.Provider value={{ 
      cart, 
      isCartOpen, 
      toggleCart, 
      addToCart, 
      decreaseQuantity, 
      removeFromCart, 
      clearCart,
      cartTotal, 
      totalItems, 
      getPrice,
      orderNote, 
      setOrderNote,
      generateWhatsAppMessage 
    }}>
      {children}
    </CartContext.Provider>
  );
};