import React from 'react';
import { MapPin, Phone, X, Store } from 'lucide-react';
import '../../styles/Home.css';

const BranchSelectorModal = ({ isOpen, onClose, branches, onSelectBranch, allowClose = true }) => {
  if (!isOpen) return null;

  const handleBranchSelect = (branch) => {
    onSelectBranch(branch);
    if (onClose) onClose();
  };

  return (
    <div className="modal-overlay" onClick={allowClose ? onClose : undefined}>
      <div 
        className="ticket-wrapper" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: 550,
          width: '90%',
          margin: 'auto',
          animation: 'fadeIn 0.3s ease'
        }}
      >
        {/* Header del Modal */}
        <div className="ticket-main" style={{ paddingBottom: 20 }}>
          <header className="home-header-centered" style={{ marginBottom: 25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Store size={26} className="text-accent" />
                  <h2 className="text-gradient" style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
                    Elige tu Sucursal
                  </h2>
                </div>
                <p className="home-tagline" style={{ marginTop: 0, fontSize: '0.9rem' }}>
                  Selecciona la ubicación más cercana
                </p>
              </div>
              {allowClose && (
                <button 
                  onClick={onClose}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '50%',
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </header>

          {/* Lista de Sucursales */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {branches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => handleBranchSelect(branch)}
                className="btn btn-secondary glass"
                style={{
                  padding: '18px 20px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minHeight: 'auto',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {/* Nombre de la sucursal */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <div style={{ 
                    background: 'rgba(37, 211, 102, 0.15)',
                    borderRadius: '8px',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Store size={18} className="text-accent" />
                  </div>
                  <span style={{ 
                    fontSize: '1.15rem', 
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                    flex: 1,
                    wordBreak: 'break-word'
                  }}>
                    {branch.name}
                  </span>
                </div>
                
                {/* Dirección */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 10, 
                  fontSize: '0.88rem',
                  opacity: 0.75,
                  paddingLeft: 10
                }}>
                  <MapPin size={15} style={{ marginTop: 2, flexShrink: 0, opacity: 0.7 }} />
                  <span style={{ lineHeight: 1.4 }}>{branch.address}</span>
                </div>

                {/* Teléfono */}
                {branch.phone && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10, 
                    fontSize: '0.88rem',
                    opacity: 0.75,
                    paddingLeft: 10
                  }}>
                    <Phone size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span>{branch.phone}</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="ticket-stub-line" style={{ marginTop: 25, marginBottom: 5 }}></div>
        </div>
      </div>
    </div>
  );
};

export default BranchSelectorModal;
