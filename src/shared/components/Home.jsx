import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, MessageCircle, Instagram, MapPin, Settings } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import '../../styles/Home.css';
import logo from '../../assets/logo.png';
import BranchSelectorModal from './BranchSelectorModal'; // Asegurar ruta correcta
import { branches } from '../data/branches';
import { useBusiness } from '../../context/useBusiness';

const Home = () => {
  const navigate = useNavigate();
  const { businessInfo } = useBusiness();
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'menu', 'whatsapp', 'instagram', 'location'

  // Genera automáticamente la URL del menú basada en donde estés alojado
  const menuUrl = `${window.location.origin}/menu`;

  const handleActionClick = (action) => {
    // Si hay datos en la configuración global, usar esos prioritariamente
    if (action === 'whatsapp' && businessInfo.phone) {
        const phone = businessInfo.phone.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}`, '_blank');
        return;
    }
    if (action === 'instagram' && businessInfo.instagram) {
        const user = businessInfo.instagram.replace('@', '');
        window.open(`https://instagram.com/${user}`, '_blank');
        return;
    }
    if (action === 'location' && businessInfo.address) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessInfo.address)}`, '_blank');
        return;
    }

    // Fallback: Si no hay info global configurada, usar el selector de sucursales
    setPendingAction(action);
    setShowModal(true);
  };

  const handleBranchSelect = (branch) => {
    setShowModal(false);
    
    if (!branch) return;

    switch (pendingAction) {
      case 'menu':
        // Guardar sucursal y navegar
        localStorage.setItem('selectedBranch', JSON.stringify(branch));
        navigate('/menu');
        break;
      case 'whatsapp':
        if (branch.whatsappUrl) window.open(branch.whatsappUrl, '_blank');
        break;
      case 'instagram':
        if (branch.instagramUrl) window.open(branch.instagramUrl, '_blank');
        break;
      case 'location':
        if (branch.mapUrl) window.open(branch.mapUrl, '_blank');
        break;
      default:
        break;
    }
    
    setPendingAction(null);
  };

  const buttons = [
    { label: "Ver Menú Digital", icon: <Utensils size={20} />, onClick: () => navigate('/menu'), primary: true }, // Directo al menú (allá sale el modal)
    { label: "WhatsApp", icon: <MessageCircle size={20} />, onClick: () => handleActionClick('whatsapp') },
    { label: "Instagram", icon: <Instagram size={20} />, onClick: () => handleActionClick('instagram') },
    { label: "Ubicación", icon: <MapPin size={20} />, onClick: () => handleActionClick('location') },
  ];

  return (
    <div className="home-container animate-fade">
      {/* Botón de Login/Admin con alta prioridad de click */}
      <button
        onClick={() => navigate('/login')}
        className="settings-btn"
        title="Admin Login"
      >
        <Settings size={20} />
      </button>

      {/* Capa de fondo para contraste */}
      <div className="home-overlay"></div>

      <main className="home-content container">
        <div className="ticket-wrapper">

          {/* LADO IZQUIERDO: Branding y Botones (Simetría Total) */}
          <div className="ticket-main">
            <header className="home-header-centered">
              <div className="brand-container-centered">
                <img src={logo} alt="Logo" className="home-logo-centered" />
                <div className="brand-text-centered">
                  <h1 className="text-gradient">
                    {businessInfo.name ? businessInfo.name.toUpperCase() : 'OISHI'}
                  </h1>
                  <span className="brand-subtitle">
                    {businessInfo.address ? 'MEJOR SABOR' : 'SUSHI'}
                  </span>
                </div>
              </div>
              <p className="home-tagline">
                  {businessInfo.schedule ? businessInfo.schedule.split('\n')[0] : 'Sabor auténtico en cada pieza'}
              </p>
            </header>

            <nav className="home-nav-grid">
              {buttons.map((btn, index) => (
                <button
                  key={index}
                  onClick={btn.onClick}
                  className={`btn ${btn.primary ? "btn-primary" : "btn-secondary glass"}`}
                >
                  <span className="btn-icon">{btn.icon}</span>
                  <span className="btn-label">{btn.label}</span>
                </button>
              ))}
            </nav>

            <div className="ticket-stub-line"></div>
          </div>

          {/* LADO DERECHO: QR Stub (Boleto) */}
          <div className="ticket-stub">
            <div className="stub-content">
              <div className="stub-badge">ACCESO DIGITAL</div>

              <div className="qr-box">
                <QRCodeSVG
                  value={menuUrl}
                  size={130}
                  level={"H"}
                  includeMargin={false}
                />
              </div>

              <div className="stub-footer">
                <p className="stub-scan-text">ESCANEAME</p>
                <span className="stub-info">PASAPORTE AL SABOR</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Reutilizable */}
      <BranchSelectorModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        branches={branches}
        onSelectBranch={handleBranchSelect}
        allowClose={true} // Permitir cerrar si se arrepienten
      />
    </div>
  );
};

export default Home;