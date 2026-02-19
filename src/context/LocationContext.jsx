import React, { createContext, useContext, useState } from 'react';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [selectedBranch, setSelectedBranch] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedBranch');
      if (!saved) return null;

      const parsed = JSON.parse(saved);
      // Aceptar cualquier ID válido como string (no forzar UUID)
      if (parsed && parsed.id && typeof parsed.id === 'string' && parsed.id.length > 0) {
        return parsed;
      }
      return null;
    } catch (e) {
      console.error("Error parsing saved branch:", e);
      return null;
    }
  });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(() => {
     // Abrir modal si no hay branch seleccionado
     try {
       const saved = localStorage.getItem('selectedBranch');
       if (!saved) return true;

       const parsed = JSON.parse(saved);
       // Si tiene un ID válido (string no vacío), no abrir. Sino, abrir.
       return !(parsed && parsed.id && typeof parsed.id === 'string' && parsed.id.length > 0);
     } catch {
       return true;
     }
  });

  // Efecto de seguridad: Si no hay branch, ABRIR SIEMPRE el modal
  React.useEffect(() => {
    if (!selectedBranch) {
      setIsLocationModalOpen(true);
    }
  }, [selectedBranch]);

  const selectBranch = (branch) => {
    setSelectedBranch(branch);
    localStorage.setItem('selectedBranch', JSON.stringify(branch));
    setIsLocationModalOpen(false);
  };

  const clearBranch = () => {
    setSelectedBranch(null);
    localStorage.removeItem('selectedBranch');
    setIsLocationModalOpen(true);
  };

  return (
    <LocationContext.Provider value={{ 
      selectedBranch, 
      selectBranch, 
      clearBranch,
      isLocationModalOpen,
      setIsLocationModalOpen
    }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
