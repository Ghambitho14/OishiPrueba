import React, { useMemo, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
    ArrowUpRight, ArrowDownRight, Calendar,
    ShoppingBag, Users, DollarSign, CreditCard,
    Smartphone, TrendingUp, Package, Clock
} from 'lucide-react';
import { formatCurrency } from '../../../shared/utils/formatters';
import '../../../styles/AdminAnalytics.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const fmt = (n) => {
    try { return formatCurrency(n); } catch { return `$${(n || 0).toLocaleString('es-CL')}`; }
};

const AdminAnalytics = ({ orders, products, clients }) => {
    const [filterPeriod, setFilterPeriod] = useState('7');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [chartTab, setChartTab] = useState('all');

    const days = filterPeriod === 'all' ? 365 : parseInt(filterPeriod);

    const getMonthRangeUtc = (yyyyMm) => {
        const [yearStr, monthStr] = String(yyyyMm || '').split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
        const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        return { start, end, startIso: start.toISOString(), endIso: end.toISOString(), year, month };
    };

    const isMonthMode = Boolean(selectedMonth);
    const monthRange = useMemo(() => (isMonthMode ? getMonthRangeUtc(selectedMonth) : null), [selectedMonth, isMonthMode]);

    // --- CORE DATA ---
    const { chartData, kpis, trends, paymentBreakdown } = useMemo(() => {
        if (!orders || orders.length === 0) {
            return {
                chartData: { labels: [], datasets: [] },
                kpis: { total: 0, count: 0, ticket: 0 },
                trends: { total: 0, count: 0 },
                paymentBreakdown: { cash: 0, card: 0, online: 0 }
            };
        }
        const now = new Date();

        const cutoff = new Date(); cutoff.setDate(now.getDate() - days);
        const prevCutoff = new Date(); prevCutoff.setDate(cutoff.getDate() - days);

        const filterByTab = (o) => {
            if (chartTab === 'all') return true;
            if (chartTab === 'online') return o.payment_type === 'online' || o.payment_type === 'transferencia';
            if (chartTab === 'store') return o.payment_type !== 'online' && o.payment_type !== 'transferencia';
            return true;
        };

        const valid = orders.filter(o => o.status !== 'cancelled');

        const current = valid.filter(o => {
            const d = new Date(o.created_at);
            if (!filterByTab(o)) return false;
            if (isMonthMode && monthRange) return d >= monthRange.start && d < monthRange.end;
            return (filterPeriod === 'all' ? true : d >= cutoff);
        });

        const prev = valid.filter(o => {
            const d = new Date(o.created_at);
            if (!filterByTab(o)) return false;
            if (isMonthMode && monthRange) {
                const prevStart = new Date(Date.UTC(monthRange.year, monthRange.month - 2, 1, 0, 0, 0, 0));
                const prevEnd = new Date(Date.UTC(monthRange.year, monthRange.month - 1, 1, 0, 0, 0, 0));
                return d >= prevStart && d < prevEnd;
            }
            return filterPeriod === 'all' ? false : (d >= prevCutoff && d < cutoff);
        });

        const salesByDate = {};
        const labels = [];

        if (isMonthMode && monthRange) {
            const daysInMonth = Math.round((monthRange.end.getTime() - monthRange.start.getTime()) / (24 * 60 * 60 * 1000));
            for (let i = 0; i < daysInMonth; i++) {
                const d = new Date(monthRange.start.getTime() + i * 24 * 60 * 60 * 1000);
                const key = d.toISOString().split('T')[0];
                labels.push(d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }));
                salesByDate[key] = 0;
            }
        } else {
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(); d.setDate(now.getDate() - i);
                const key = d.toISOString().split('T')[0];
                labels.push(d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }));
                salesByDate[key] = 0;
            }
        }
        current.forEach(o => {
            const key = new Date(o.created_at).toISOString().split('T')[0];
            if (salesByDate[key] !== undefined) salesByDate[key] += Number(o.total);
        });

        const totalSales = current.reduce((a, o) => a + Number(o.total), 0);
        const count = current.length;
        const ticket = count > 0 ? totalSales / count : 0;
        const prevSales = prev.reduce((a, o) => a + Number(o.total), 0);
        const prevCount = prev.length;

        const pb = { cash: 0, card: 0, online: 0 };
        current.forEach(o => {
            const t = o.payment_type;
            if (t === 'online' || t === 'transferencia') pb.online += Number(o.total);
            else if (t === 'tarjeta') pb.card += Number(o.total);
            else pb.cash += Number(o.total);
        });

        return {
            chartData: {
                labels,
                datasets: [{
                    label: 'Ventas', data: Object.values(salesByDate),
                    borderColor: '#e63946',
                    backgroundColor: 'rgba(230, 57, 70, 0.08)',
                    tension: 0.4, fill: true,
                    pointBackgroundColor: '#fff', pointBorderColor: '#e63946',
                    pointBorderWidth: 2,
                    pointRadius: (isMonthMode ? labels.length : days) > 30 ? 0 : 3,
                    pointHoverRadius: 5,
                }],
            },
            kpis: { total: totalSales, count, ticket },
            trends: {
                total: prevSales === 0 ? (totalSales > 0 ? 100 : 0) : Math.round(((totalSales - prevSales) / prevSales) * 100),
                count: prevCount === 0 ? (count > 0 ? 100 : 0) : Math.round(((count - prevCount) / prevCount) * 100),
            },
            paymentBreakdown: pb,
        };
    }, [orders, filterPeriod, chartTab, days, isMonthMode, monthRange]);

    // --- NEW CLIENTS ---
    const newClientsInfo = useMemo(() => {
        if (!clients) return { count: 0, trend: 0, total: 0 };
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
        const prevCutoff = new Date(); prevCutoff.setDate(cutoff.getDate() - days);

        const currentNew = clients.filter(c => {
            const d = new Date(c.created_at || new Date());
            if (isMonthMode && monthRange) return d >= monthRange.start && d < monthRange.end;
            return d >= cutoff;
        }).length;

        const prevNew = (filterPeriod === 'all' && !isMonthMode) ? 0 : clients.filter(c => {
            const d = new Date(c.created_at || new Date());
            if (isMonthMode && monthRange) {
                const prevStart = new Date(Date.UTC(monthRange.year, monthRange.month - 2, 1, 0, 0, 0, 0));
                const prevEnd = new Date(Date.UTC(monthRange.year, monthRange.month - 1, 1, 0, 0, 0, 0));
                return d >= prevStart && d < prevEnd;
            }
            return d >= prevCutoff && d < cutoff;
        }).length;
        return {
            count: currentNew,
            trend: prevNew === 0 ? (currentNew > 0 ? 100 : 0) : Math.round(((currentNew - prevNew) / prevNew) * 100),
            total: clients.length,
        };
    }, [clients, filterPeriod, days, isMonthMode, monthRange]);

    // --- TOP 5 PRODUCTS ---
    const topProducts = useMemo(() => {
        if (!orders) return [];
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
        const filtered = orders.filter(o => {
            if (o.status === 'cancelled') return false;
            const d = new Date(o.created_at);
            if (isMonthMode && monthRange) return d >= monthRange.start && d < monthRange.end;
            return (filterPeriod === 'all' ? true : d >= cutoff);
        });
        const counts = {};
        const revenue = {};
        filtered.forEach(o => {
            if (o.items && Array.isArray(o.items)) {
                o.items.forEach(item => {
                    const name = item.name ? String(item.name).split(' (')[0] : 'Desconocido';
                    counts[name] = (counts[name] || 0) + (item.quantity || 1);
                    revenue[name] = (revenue[name] || 0) + ((item.price || 0) * (item.quantity || 1));
                });
            }
        });
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, qty]) => ({ name, qty, revenue: revenue[name] || 0 }));
    }, [orders, filterPeriod, days, isMonthMode, monthRange]);

    // --- PEAK HOUR ---
    const peakHour = useMemo(() => {
        if (!orders || orders.length === 0) return null;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
        const hourCounts = {};
        orders.filter(o => {
            if (o.status === 'cancelled') return false;
            const d = new Date(o.created_at);
            if (isMonthMode && monthRange) return d >= monthRange.start && d < monthRange.end;
            return (filterPeriod === 'all' ? true : d >= cutoff);
        }).forEach(o => {
            const h = new Date(o.created_at).getHours();
            hourCounts[h] = (hourCounts[h] || 0) + 1;
        });
        const sorted = Object.entries(hourCounts).sort(([, a], [, b]) => b - a);
        if (sorted.length === 0) return null;
        const h = parseInt(sorted[0][0]);
        return { hour: `${h}:00 - ${h + 1}:00`, count: sorted[0][1] };
    }, [orders, filterPeriod, days, isMonthMode, monthRange]);

    const TrendBadge = ({ value }) => {
        if (value === 0) return <span className="rpt-trend neutral">0%</span>;
        const pos = value > 0;
        return (
            <span className={`rpt-trend ${pos ? 'positive' : 'negative'}`}>
                {pos ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {Math.abs(value)}%
            </span>
        );
    };


    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.85)', padding: 12, cornerRadius: 10,
                titleFont: { size: 13, weight: '600' }, bodyFont: { size: 13 },
                displayColors: false,
                callbacks: { label: (ctx) => fmt(ctx.raw) }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                ticks: { color: '#666', font: { size: 11 }, callback: (v) => v >= 1000 ? `$${v / 1000}k` : `$${v}` },
                border: { display: false },
            },
            x: {
                grid: { display: false },
                ticks: { color: '#666', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
                border: { display: false },
            }
        }
    };

    return (
        <div className="rpt-container animate-fade">
            {/* HEADER */}
            <header className="rpt-header">
                <div>
                    <h1 className="rpt-title">Reportes</h1>
                    <p className="rpt-subtitle">Resumen de rendimiento del negocio</p>
                </div>
                <div className="rpt-header-actions">
                    <div className="rpt-period-select">
                        <Calendar size={15} />
                        <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                            <option value="7">7 días</option>
                            <option value="15">15 días</option>
                            <option value="30">30 días</option>
                            <option value="90">3 meses</option>
                            <option value="all">Todo</option>
                        </select>
                    </div>

                    <div className="rpt-period-select">
                        <Calendar size={15} />
                        <span className="rpt-month-label">Mes</span>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="rpt-month-input"
                        />
                        {selectedMonth && (
                            <button
                                type="button"
                                className="rpt-month-clear"
                                onClick={() => setSelectedMonth('')}
                                aria-label="Limpiar mes"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* KPI ROW */}
            <div className="rpt-kpi-row">
                <div className="rpt-kpi">
                    <div className="rpt-kpi-icon sales"><DollarSign size={20} /></div>
                    <div className="rpt-kpi-body">
                        <span className="rpt-kpi-label">Ventas totales</span>
                        <span className="rpt-kpi-value">{fmt(kpis.total)}</span>
                    </div>
                    <TrendBadge value={trends.total} />
                </div>
                <div className="rpt-kpi">
                    <div className="rpt-kpi-icon orders"><ShoppingBag size={20} /></div>
                    <div className="rpt-kpi-body">
                        <span className="rpt-kpi-label">Pedidos</span>
                        <span className="rpt-kpi-value">{kpis.count}</span>
                    </div>
                    <TrendBadge value={trends.count} />
                </div>
                <div className="rpt-kpi">
                    <div className="rpt-kpi-icon ticket"><TrendingUp size={20} /></div>
                    <div className="rpt-kpi-body">
                        <span className="rpt-kpi-label">Ticket promedio</span>
                        <span className="rpt-kpi-value">{fmt(Math.round(kpis.ticket))}</span>
                    </div>
                </div>
                <div className="rpt-kpi">
                    <div className="rpt-kpi-icon clients"><Users size={20} /></div>
                    <div className="rpt-kpi-body">
                        <span className="rpt-kpi-label">Nuevos clientes</span>
                        <span className="rpt-kpi-value">{newClientsInfo.count}</span>
                    </div>
                    <TrendBadge value={newClientsInfo.trend} />
                </div>
            </div>

            {/* CHART + SIDEBAR */}
            <div className="rpt-main-grid">
                <div className="rpt-chart-card">
                    <div className="rpt-chart-header">
                        <h3>Ventas por día</h3>
                        <div className="rpt-chart-tabs">
                            {[['all', 'Todos'], ['store', 'Tienda'], ['online', 'Online']].map(([key, label]) => (
                                <button key={key} className={`rpt-tab ${chartTab === key ? 'active' : ''}`} onClick={() => setChartTab(key)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="rpt-chart-wrapper">
                        <Line data={chartData} options={chartOptions} />
                    </div>
                </div>

                {/* SIDEBAR */}
                <div className="rpt-sidebar">
                    {/* Payment Breakdown */}
                    <div className="rpt-side-card">
                        <h4><CreditCard size={16} /> Métodos de pago</h4>
                        <div className="rpt-payment-list">
                            {[
                                { label: 'Efectivo', value: paymentBreakdown.cash, icon: <DollarSign size={14} />, color: '#22c55e' },
                                { label: 'Tarjeta', value: paymentBreakdown.card, icon: <CreditCard size={14} />, color: '#3b82f6' },
                                { label: 'Transferencia', value: paymentBreakdown.online, icon: <Smartphone size={14} />, color: '#a855f7' },
                            ].map(pm => {
                                const pct = kpis.total > 0 ? Math.round((pm.value / kpis.total) * 100) : 0;
                                return (
                                    <div key={pm.label} className="rpt-payment-row">
                                        <div className="rpt-payment-info">
                                            <span className="rpt-payment-icon" style={{ color: pm.color }}>{pm.icon}</span>
                                            <span>{pm.label}</span>
                                        </div>
                                        <div className="rpt-payment-bar-wrap">
                                            <div className="rpt-payment-bar" style={{ width: `${pct}%`, background: pm.color }} />
                                        </div>
                                        <div className="rpt-payment-values">
                                            <strong>{fmt(pm.value)}</strong>
                                            <span>{pct}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Peak Hour */}
                    {peakHour && (
                        <div className="rpt-side-card rpt-peak">
                            <h4><Clock size={16} /> Hora pico</h4>
                            <div className="rpt-peak-value">{peakHour.hour}</div>
                            <div className="rpt-peak-sub">{peakHour.count} pedidos en este horario</div>
                        </div>
                    )}

                    {/* Quick Stats */}
                    <div className="rpt-side-card">
                        <h4><Users size={16} /> Clientes</h4>
                        <div className="rpt-quick-stats">
                            <div className="rpt-quick-stat">
                                <span className="rpt-quick-label">Total registrados</span>
                                <span className="rpt-quick-value">{newClientsInfo.total}</span>
                            </div>
                            <div className="rpt-quick-stat">
                                <span className="rpt-quick-label">Nuevos ({filterPeriod === 'all' ? 'total' : `${days}d`})</span>
                                <span className="rpt-quick-value">{newClientsInfo.count}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TOP PRODUCTS */}
            <div className="rpt-products-card">
                <h3><Package size={18} /> Top productos vendidos</h3>
                {topProducts.length === 0 ? (
                    <div className="rpt-empty">No hay datos de productos en este período.</div>
                ) : (
                    <div className="rpt-products-list">
                        {topProducts.map((p, i) => {
                            const maxQty = topProducts[0]?.qty || 1;
                            const pct = Math.round((p.qty / maxQty) * 100);
                            return (
                                <div key={p.name} className="rpt-product-row">
                                    <span className="rpt-product-rank">#{i + 1}</span>
                                    <div className="rpt-product-info">
                                        <span className="rpt-product-name">{p.name}</span>
                                        <div className="rpt-product-bar-wrap">
                                            <div className="rpt-product-bar" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                    <div className="rpt-product-stats">
                                        <span className="rpt-product-qty">{p.qty} uds</span>
                                        <span className="rpt-product-rev">{fmt(p.revenue)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminAnalytics;
