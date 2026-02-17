import React from 'react';
import { MapPin, Phone, X, Store } from 'lucide-react';
import '../../styles/BranchSelectorModal.css';

const BranchSelectorModal = ({ isOpen, onClose, branches, onSelectBranch, allowClose = true }) => {
  if (!isOpen) return null;

  const handleBranchSelect = (branch) => {
    onSelectBranch(branch);
    if (onClose) onClose();
  };

  return (
    <div className="branch-modal-overlay" onClick={allowClose ? onClose : undefined}>
      <div 
        className="branch-modal-wrapper" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="branch-modal-content">
          {/* Header */}
          <header className="branch-modal-header">
            <div className="branch-modal-header-row">
              <div className="branch-modal-title-section">
                <div className="branch-modal-title-row">
                  <Store size={26} className="branch-icon-accent" />
                  <h2 className="branch-modal-title">
                    Elige tu Sucursal
                  </h2>
                </div>
                <p className="branch-modal-subtitle">
                  Selecciona la ubicación más cercana
                </p>
              </div>
              {allowClose && (
                <button 
                  onClick={onClose}
                  className="branch-modal-close-btn"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </header>

          {/* Lista de Sucursales */}
          <div className="branch-list">
            {branches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => handleBranchSelect(branch)}
                className="branch-button"
              >
                {/* Nombre */}
                <div className="branch-name-row">
                  <div className="branch-icon-container">
                    <Store size={18} className="branch-icon-accent" />
                  </div>
                  <span className="branch-name">
                    {branch.name}
                  </span>
                </div>
                
                {/* Dirección */}
                <div className="branch-address-row">
                  <MapPin size={14} className="branch-icon-small" />
                  <span className="branch-address-text">{branch.address}</span>
                </div>

                {/* Teléfono */}
                {branch.phone && (
                  <div className="branch-phone-row">
                    <Phone size={14} className="branch-icon-small" />
                    <span className="branch-phone-text">{branch.phone}</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="branch-divider"></div>
        </div>
      </div>
    </div>
  );
};

export default BranchSelectorModal;
