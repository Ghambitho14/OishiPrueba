import React from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Phone, X, Store, AlertCircle, Loader2 } from 'lucide-react';
import '../../styles/BranchSelectorModal.css';

const BranchSelectorModal = ({ isOpen, onClose, branches, allBranches, isLoadingCaja, onSelectBranch, allowClose = true, schedule }) => {
  if (!isOpen) return null;

  const handleBranchSelect = (branch) => {
    onSelectBranch(branch);
    if (onClose) onClose();
  };

  const hasBranchesWithCaja = branches && branches.length > 0;
  const hasOtherBranches = allBranches && allBranches.length > 0;

  const modalContent = (
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

          {/* Lista de Sucursales (solo las que tienen caja abierta) */}
          <div className="branch-list">
            {isLoadingCaja ? (
              <div className="branch-empty-state">
                <Loader2 size={32} className="branch-loading-spinner" />
                <p>Verificando sucursales disponibles...</p>
              </div>
            ) : !hasBranchesWithCaja ? (
              <div className="branch-empty-state">
                <AlertCircle size={40} style={{ color: 'var(--accent-red, #e63946)', marginBottom: 12 }} />
                <p style={{ fontWeight: 600, marginBottom: 8 }}>No hay sucursales recibiendo pedidos</p>
                <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  {schedule ? `Horario de atención: ${schedule}` : (hasOtherBranches
                    ? 'Abre la caja en el panel de administración de alguna sucursal para habilitar compras.'
                    : 'Abre la caja en el panel de administración para habilitar compras.')}
                </p>
              </div>
            ) : (
              branches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => handleBranchSelect(branch)}
                  className="branch-button"
                >
                  <div className="branch-name-row">
                    <div className="branch-icon-container">
                      <Store size={18} className="branch-icon-accent" />
                    </div>
                    <span className="branch-name">{branch.name}</span>
                  </div>
                  <div className="branch-address-row">
                    <MapPin size={14} className="branch-icon-small" />
                    <span className="branch-address-text">{branch.address}</span>
                  </div>
                  {branch.phone && (
                    <div className="branch-phone-row">
                      <Phone size={14} className="branch-icon-small" />
                      <span className="branch-phone-text">{branch.phone}</span>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="branch-divider"></div>
        </div>
      </div>
    </div>
  );

  // Usar portal si existe el elemento root, sino renderizar normal (fallback)
  const portalRoot = document.getElementById('modal-root') || document.body;
  return createPortal(modalContent, portalRoot);
};

export default BranchSelectorModal;
