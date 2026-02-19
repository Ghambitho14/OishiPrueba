import React, { createContext, useContext, useState } from 'react';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [selectedBranch, setSelectedBranch] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedBranch');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Error parsing saved branch:", e);
      return null;
    }
  });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(() => {
     // If no branch selected initially, open modal
     const saved = localStorage.getItem('selectedBranch');
     return !saved;
  });

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
