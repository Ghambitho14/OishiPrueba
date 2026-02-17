import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, ShoppingBag, BarChart3, Users, List, Settings, LogOut, DollarSign, Store } from 'lucide-react';
import logo from '../../../assets/logo.png';
import '../../../styles/AdminSidebar.css';

const AdminSidebar = ({ activeTab, setActiveTab, isMobile, kanbanColumns, onLogout }) => {
    const navigate = useNavigate();
    const pendingCount = kanbanColumns?.pending?.length || 0;

    return (
        <aside className="admin-sidebar glass">
            <div className="sidebar-top">
                {!isMobile && <div className="logo-circle"><img src={logo} alt="Logo" /></div>}
                {!isMobile && <h3 className="brand-title">Oishi Admin</h3>}
            </div>
            <nav className="sidebar-menu">
                <button onClick={() => setActiveTab('orders')} className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}>
                    <ChefHat size={22} /> {!isMobile && 'Pedidos'}
                    {pendingCount > 0 && <span className="badge-count">{pendingCount}</span>}
                </button>
                <button onClick={() => setActiveTab('products')} className={`nav-item ${activeTab === 'products' ? 'active' : ''}`}>
                    <ShoppingBag size={22} /> {!isMobile && 'Inventario'}
                </button>
                <button onClick={() => setActiveTab('analytics')} className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}>
                    <BarChart3 size={22} /> {!isMobile && 'Reportes'}
                </button>
                <button onClick={() => setActiveTab('clients')} className={`nav-item ${activeTab === 'clients' ? 'active' : ''}`}>
                    <Users size={22} /> {!isMobile && 'Clientes'}
                </button>
                <button onClick={() => setActiveTab('categories')} className={`nav-item ${activeTab === 'categories' ? 'active' : ''}`}>
                    <List size={22} /> {!isMobile && 'Categorías'}
                </button>
                <button onClick={() => setActiveTab('caja')} className={`nav-item ${activeTab === 'caja' ? 'active' : ''}`}>
                    <DollarSign size={22} /> {!isMobile && 'Caja'}
                </button>
                <button onClick={() => setActiveTab('settings')} className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}>
                    <Settings size={22} /> {!isMobile && 'Herramientas'}
                </button>
                <button onClick={() => navigate('/')} className="nav-item" style={{ marginTop: 'auto', marginBottom: 10 }}>
                    <Store size={22} /> {!isMobile && 'Ver Tienda'}
                </button>
                <button onClick={onLogout} className="nav-item logout">
                    <LogOut size={22} /> {!isMobile && 'Cerrar Sesión'}
                </button>
            </nav>
        </aside>
    );
};

export default AdminSidebar;
