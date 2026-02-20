import React, { useMemo, useState } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Info, 
  Calendar, 
  Download, 
  RotateCcw,
  ShoppingBag,
  Users,
  DollarSign
} from 'lucide-react';
import '../../../styles/AdminAnalytics.css'; // Usaremos el CSS del usuario o crearemos uno actualizado

// Registrar componentes de ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AdminAnalytics = ({ orders, clients }) => {
  const [filterPeriod, setFilterPeriod] = useState('7'); // '7', '30', 'all'
    const [chartTab, setChartTab] = useState('Todos'); // 'Todos', 'WEB', 'PDV', etc.
    const [tabs, setTabs] = useState(['Todos', 'WEB', 'PDV', 'trans', 'efectivo', 'uber']);
    const [newTab, setNewTab] = useState('');

  // --- PROCESAMIENTO DE DATOS ---
  const { chartData, kpis, trends } = useMemo(() => {
    if (!orders || orders.length === 0) {
        return { 
          chartData: { labels: [], datasets: [] }, 
          kpis: { total: 0, count: 0, ticket: 0 },
          trends: { total: 0, count: 0 } 
        };
    }

    // 1. Filtrar por periodo actual y previo
    const now = new Date();
    const days = filterPeriod === 'all' ? 365 : parseInt(filterPeriod);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - days);

    const prevCutoffDate = new Date();
    prevCutoffDate.setDate(cutoffDate.getDate() - days);

    const filterByTab = (o) => {
        if (chartTab === 'Todos') return true;
        if (chartTab === 'WEB') return o.payment_type === 'online';
        if (chartTab === 'PDV') return o.payment_type === 'tienda';
        // Categorías personalizadas o métodos base
        return o.payment_type === chartTab || o.source === chartTab;
    };

    const validOrders = orders.filter(o => o.status !== 'cancelled');

    // Pedidos Actuales
    const currentOrders = validOrders.filter(o => {
        const d = new Date(o.created_at);
        return (filterPeriod === 'all' ? true : d >= cutoffDate) && filterByTab(o);
    });

    // Pedidos Previos (para trends)
    const prevOrders = validOrders.filter(o => {
        const d = new Date(o.created_at);
        return filterPeriod === 'all' ? false : (d >= prevCutoffDate && d < cutoffDate) && filterByTab(o);
    });

    // 2. Agrupar por fecha para el gráfico
    const salesByDate = {};
    const labels = [];
    
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        salesByDate[key] = 0;
        labels.push(label);
    }
    
    currentOrders.forEach(o => {
        const key = new Date(o.created_at).toISOString().split('T')[0];
        if (salesByDate[key] !== undefined) {
            salesByDate[key] += Number(o.total);
        }
    });

    const dataPoints = Object.values(salesByDate);

    // 3. KPIs y Trends
    const totalSales = currentOrders.reduce((acc, o) => acc + Number(o.total), 0);
    const totalOrdersCount = currentOrders.length;
    const avgTicket = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

    const prevSales = prevOrders.reduce((acc, o) => acc + Number(o.total), 0);
    const prevCount = prevOrders.length;

    const salesTrend = prevSales === 0 ? 100 : Math.round(((totalSales - prevSales) / prevSales) * 100);
    const countTrend = prevCount === 0 ? 100 : Math.round(((totalOrdersCount - prevCount) / prevCount) * 100);

    const data = {
      labels,
      datasets: [
        {
          label: 'Ventas',
          data: dataPoints,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };

    return { 
        chartData: data, 
        kpis: { 
            total: totalSales, 
            count: totalOrdersCount, 
            ticket: avgTicket 
        },
        trends: {
            total: salesTrend,
            count: countTrend
        }
    };
  }, [orders, filterPeriod, chartTab]);

  // CÁLCULO DE NUEVOS CLIENTES
  const newClientsInfo = useMemo(() => {
      if (!clients) return { count: 0, trend: 0 };
      const now = new Date();
      const days = filterPeriod === 'all' ? 365 : parseInt(filterPeriod);
      
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - days);

      const prevCutoff = new Date();
      prevCutoff.setDate(cutoff.getDate() - days);

      const currentNew = clients.filter(c => new Date(c.created_at || new Date()) >= cutoff).length;
      const prevNew = filterPeriod === 'all' ? 0 : clients.filter(c => {
          const d = new Date(c.created_at || new Date());
          return d >= prevCutoff && d < cutoff;
      }).length;

      const trend = prevNew === 0 ? 100 : Math.round(((currentNew - prevNew) / prevNew) * 100);

      return { count: currentNew, trend };
  }, [clients, filterPeriod]);

  // TOP PRODUCTO
  const topProduct = useMemo(() => {
      if (!orders) return null;
      const counts = {};
      orders.forEach(o => {
          if (o.items && Array.isArray(o.items)) {
              o.items.forEach(item => {
                  const name = item.name ? String(item.name).split(' (')[0] : 'Desconocido';
                  counts[name] = (counts[name] || 0) + (item.quantity || 1);
              });
          }
      });
      const sorted = Object.entries(counts).sort(([,a], [,b]) => b - a);
      return sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : null;
  }, [orders]);


  return (
    <div className="admin-analytics-container animate-fade">
      
      {/* HEADER DE FILTROS */}
      <header className="analytics-header glass">
        <div className="header-left">
            <h2 className="text-xl font-bold">Resumen de Rendimiento</h2>
        </div>
        
        <div className="header-controls">
            <div className="select-wrapper">
                <Calendar size={16} />
                <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                    <option value="7">Últimos 7 días</option>
                    <option value="15">Últimos 15 días</option>
                    <option value="30">Últimos 30 días</option>
                </select>
            </div>
            
            <button className="btn-report btn-primary">
                <Download size={16} /> Reporte
            </button>
        </div>
      </header>

      {/* DASHBOARD GRID */}
      <div className="analytics-grid">
        
        {/* COLUMNA IZQUIERDA: GRÁFICO PRINCIPAL */}
        <div className="chart-section glass">
            <div className="chart-header-row">
                <h3>Progreso de ventas</h3>
                <div className="chart-tabs">
                    {tabs.map(tab => (
                        <button 
                            key={tab} 
                            className={`chart-tab ${chartTab === tab ? 'active' : ''}`}
                            onClick={() => setChartTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}

                    {/* Input para agregar categoría personalizada */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
                        <input
                            placeholder="Agregar categoria"
                            value={newTab}
                            onChange={(e) => setNewTab(e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: 'inherit' }}
                        />
                        <button className="btn-small" onClick={() => {
                            const t = (newTab || '').trim();
                            if (!t) return;
                            if (!tabs.includes(t)) setTabs(prev => [...prev, t]);
                            setNewTab('');
                        }}>Agregar</button>
                    </div>
                </div>
            </div>
            <div className="chart-wrapper">
                <Line 
                    data={chartData} 
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { 
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                padding: 12,
                                titleFont: { size: 14 },
                                bodyFont: { size: 14 },
                                displayColors: false,
                                callbacks: {
                                    label: (ctx) => `$${ctx.raw.toLocaleString('es-CL')}`
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(255,255,255,0.05)' },
                                ticks: { color: '#888', callback: (val) => `$${val/1000}k` }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#888' }
                            }
                        }
                    }} 
                />
            </div>
        </div>

        {/* COLUMNA DERECHA: KPIs */}
        <div className="kpi-column">
            
            {/* KPI: PEDIDOS */}
            <div className="kpi-card-modern glass">
                <div className="kpi-row-top">
                    <span className="kpi-label">Cantidad</span>
                    <Info size={14} className="info-icon" />
                </div>
                <div className="kpi-row-main">
                    <span className="kpi-value">{kpis.count}</span>
                    <span className={`kpi-trend ${trends.count >= 0 ? 'positive' : 'negative'}`}>
                        {trends.count >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} 
                        {Math.abs(trends.count)}%
                    </span>
                </div>
            </div>

            {/* KPI: VENTAS */}
            <div className="kpi-card-modern glass">
                <div className="kpi-row-top">
                    <span className="kpi-label">Ventas</span>
                    <Info size={14} className="info-icon" />
                </div>
                <div className="kpi-row-main">
                    <span className="kpi-value">${kpis.total.toLocaleString('es-CL')}</span>
                    <span className={`kpi-trend ${trends.total >= 0 ? 'positive' : 'negative'}`}>
                        {trends.total >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} 
                        {Math.abs(trends.total)}%
                    </span>
                </div>
            </div>

            {/* KPI: TICKET */}
            <div className="kpi-card-modern glass">
                <div className="kpi-row-top">
                    <span className="kpi-label">Ticket Promedio</span>
                    <Info size={14} className="info-icon" />
                </div>
                <div className="kpi-row-main">
                    <div className="kpi-value-group">
                        <span className="currency">$</span>
                        <span className="kpi-value">{Math.round(kpis.ticket).toLocaleString('es-CL')}</span>
                    </div>
                </div>
                 <div className="kpi-link">Ver más</div>
            </div>

        </div>

      </div>

      {/* SECCIÓN INFERIOR */}
      <div className="bottom-grid">
        
        {/* PRODUCTOS VENDIDOS */}
        <div className="bottom-card glass">
            <h3>Productos vendidos</h3>
            <div className="product-highlight">
                <span className="highlight-label">Más vendido:</span>
                <span className="highlight-value">{topProduct ? topProduct.name : 'N/A'}</span>
                <button className="btn-small-primary">Ir al reporte</button>
            </div>
        </div>

        {/* CLIENTES */}
        <div className="bottom-card glass">
            <h3>Clientes</h3>
            <div className="clients-stats-row">
                <div className="client-stat">
                    <span className="stat-label">Nuevos clientes</span>
                    <span className="stat-num">{newClientsInfo.count}</span>
                    <span className={`stat-trend ${newClientsInfo.trend >= 0 ? 'positive' : 'negative'}`}>
                        {newClientsInfo.trend >= 0 ? '▲' : '▼'} {Math.abs(newClientsInfo.trend)}%
                    </span>
                </div>
                <div className="client-rating">
                    <span className="stat-label">Valoración</span>
                    <div className="rating-toggle">
                        Activar ⭐
                    </div>
                </div>
            </div>
        </div>

      </div>

    </div>
  );
};

export default AdminAnalytics;
