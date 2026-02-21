import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import { TABLES } from '../../../lib/supabaseTables';
import { Loader2, AlertCircle, XCircle, FileText, Trash2, Users, ChevronDown } from 'lucide-react';

const AdminDangerZone = ({ orders, showNotify, loadData, isMobile }) => {
  const [analyticsDate, setAnalyticsDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [expandedCard, setExpandedCard] = useState(() => (isMobile ? 'report' : null));

  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false);
  const [dangerAction, setDangerAction] = useState(null);
  const [dangerUserName, setDangerUserName] = useState('');
  const [dangerPassword, setDangerPassword] = useState('');
  const [dangerError, setDangerError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getMonthRangeUtc = (yyyyMm) => {
    const [yearStr, monthStr] = String(yyyyMm).split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return null;
    }

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const nextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    return {
      startIso: start.toISOString(),
      endIso: nextMonth.toISOString(),
    };
  };

  useEffect(() => {
    if (!isDangerModalOpen) return;

    const scrollY = window.scrollY;

    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isDangerModalOpen]);

  const handleExportMonthlyCsv = async () => {
    const range = getMonthRangeUtc(analyticsDate);
    if (!range) {
      showNotify('Mes inválido', 'error');
      return;
    }

    const startMs = new Date(range.startIso).getTime();
    const endMs = new Date(range.endIso).getTime();

    const filteredOrders = orders.filter(o => {
      const t = new Date(o.created_at).getTime();
      return Number.isFinite(t) && t >= startMs && t < endMs;
    });

    if (filteredOrders.length === 0) {
      showNotify("No hay datos para exportar", 'info');
      return;
    }

    const headers = ['Fecha', 'Hora', 'Cliente', 'RUT', 'Teléfono', 'Items', 'Total', 'Método Pago', 'Ref. Pago'];
    const lines = [headers.join(',')];

    filteredOrders.forEach(order => {
      const d = new Date(order.created_at);
      const itemsText = order.items.map(i => `${i.quantity}x ${i.name}`).join(' | ');
      const row = [
        d.toLocaleDateString('es-CL'),
        d.toLocaleTimeString('es-CL'),
        order.client_name,
        order.client_rut,
        order.client_phone,
        itemsText,
        order.total,
        order.payment_type || '',
        order.payment_ref || ''
      ];
      const escaped = row.map(v => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(escaped.join(','));
    });

    const csvContent = "\uFEFF" + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Cierre_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotify('Reporte Excel generado', 'success');
  };

  const executeDangerAction = async () => {
    const trimmedEmail = dangerUserName.trim();
    if (!trimmedEmail || !dangerPassword) {
      setDangerError('Ingresa credenciales de administrador');
      return;
    }

    setDangerError(null);
    setLoading(true);

    try {
      // Guardar sesión actual antes de re-autenticar
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      // Validar con Supabase Auth (re-autenticación)
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: dangerPassword
      });

      if (authError) {
        setDangerError('Credenciales de administrador inválidas');
        setLoading(false);
        return;
      }

      if (dangerAction === 'monthlyOrders') {
        const range = getMonthRangeUtc(analyticsDate);
        if (!range) {
          throw new Error('Mes inválido');
        }

        // 1. Borrar movimientos de caja del mes para evitar error de FK
        const { error: cashError, data: cashData } = await supabase.from(TABLES.cash_movements).delete()
          .gte('created_at', range.startIso).lt('created_at', range.endIso).select();

        // 2. Borrar las órdenes
        const { error, data: deletedOrders } = await supabase.from(TABLES.orders).delete()
          .gte('created_at', range.startIso).lt('created_at', range.endIso).select();

        if (cashError) throw cashError;

        if (error) throw error;
        showNotify(`${deletedOrders?.length || 0} registros del mes eliminados`, 'success');

      } else if (dangerAction === 'allClients') {
        const { count, error, data: deletedClients } = await supabase.from(TABLES.clients).delete().neq('phone', '0000').select('*', { count: 'exact' });
        if (error) throw error;
        showNotify(`Base de clientes purgada (${count} registros)`, 'success');
      }

      // Cerrar modal solo después de éxito
      setIsDangerModalOpen(false);
      loadData(true);

      // Restaurar sesión original si el email era diferente
      if (currentSession && currentSession.user?.email !== trimmedEmail) {
        await supabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token
        });
      }
    } catch (e) {
      showNotify(`Error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openDangerModal = (action) => {
    setDangerAction(action);
    setDangerUserName('');
    setDangerPassword('');
    setDangerError(null);
    setIsDangerModalOpen(true);
  };

  return (
    <>
      <div style={{ maxWidth: 900, margin: '40px auto', padding: 20 }}>
        <h3 style={{ color: '#ef4444', marginBottom: 20, borderBottom: '1px solid #ef4444', paddingBottom: 10 }}>Zona de Peligro Administrativa</h3>
        
        {/* Selector de mes compartido — visible para Export y Delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
          <label style={{ color: '#9ca3af', fontSize: '0.9rem', whiteSpace: 'nowrap', flex: '0 0 auto' }}>Mes seleccionado:</label>
          <input 
            type="month" 
            className="form-input" 
            style={{ width: 190, maxWidth: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} 
            value={analyticsDate} 
            onChange={e => setAnalyticsDate(e.target.value)} 
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>

            {/* Cierre Mensual */}
            <div className="glass" style={{ padding: 25, borderRadius: 16, border: '1px solid var(--accent-success)' }}>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setExpandedCard(prev => prev === 'report' ? null : 'report')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FileText size={28} color="#25d366" />
                    <h3 style={{ margin: 0 }}>Reporte Cierre Mensual</h3>
                  </div>
                  <ChevronDown size={18} style={{ transform: expandedCard === 'report' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                  <FileText size={28} color="#25d366" />
                  <h3 style={{ margin: 0 }}>Reporte Cierre Mensual</h3>
                </div>
              )}

              {(!isMobile || expandedCard === 'report') && (
                <>
                  <div style={{ height: isMobile ? 12 : 0 }} />
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: 20 }}>
                    Genera y descarga un Excel con todas las ventas de <b style={{ color: 'white' }}>{analyticsDate}</b>.
                  </p>
                  <button onClick={handleExportMonthlyCsv} className="btn-table-action" style={{ width: '100%', padding: 12, background: 'rgba(37, 211, 102, 0.2)', color: '#25d366', border: '1px solid #25d366' }}>
                    Descargar Reporte Mes
                  </button>
                </>
              )}
            </div>

            {/* Eliminar Mes */}
            <div className="glass" style={{ padding: 25, borderRadius: 16, border: '1px solid #ef4444' }}>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setExpandedCard(prev => prev === 'deleteMonth' ? null : 'deleteMonth')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Trash2 size={28} color="#ef4444" />
                    <h3 style={{ margin: 0 }}>Eliminar Ventas Mes</h3>
                  </div>
                  <ChevronDown size={18} style={{ transform: expandedCard === 'deleteMonth' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                  <Trash2 size={28} color="#ef4444" />
                  <h3 style={{ margin: 0 }}>Eliminar Ventas Mes</h3>
                </div>
              )}

              {(!isMobile || expandedCard === 'deleteMonth') && (
                <>
                  <div style={{ height: isMobile ? 12 : 0 }} />
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: 20 }}>
                    Borra todas las órdenes y movimientos de caja de <b style={{ color: 'white' }}>{analyticsDate}</b>.
                    <br/><b style={{color: '#ef4444'}}>Acción irreversible.</b>
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openDangerModal('monthlyOrders');
                    }}
                    className="btn-table-action"
                    style={{ width: '100%', padding: 12, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444' }}
                  >
                    Eliminar Datos Mes
                  </button>
                </>
              )}
            </div>

             {/* Eliminar Clientes */}
             <div className="glass" style={{ padding: 25, borderRadius: 16, border: '1px solid #ef4444' }}>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setExpandedCard(prev => prev === 'deleteClients' ? null : 'deleteClients')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Users size={28} color="#ef4444" />
                    <h3 style={{ margin: 0 }}>Purgar Clientes</h3>
                  </div>
                  <ChevronDown size={18} style={{ transform: expandedCard === 'deleteClients' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                  <Users size={28} color="#ef4444" />
                  <h3 style={{ margin: 0 }}>Purgar Clientes</h3>
                </div>
              )}

              {(!isMobile || expandedCard === 'deleteClients') && (
                <>
                  <div style={{ height: isMobile ? 12 : 0 }} />
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: 20 }}>
                    Elimina todos los clientes de la base de datos excepto el genérico.
                    <br/><b style={{color: '#ef4444'}}>Solo usar en desarrollo.</b>
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openDangerModal('allClients');
                    }}
                    className="btn-table-action"
                    style={{ width: '100%', padding: 12, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444' }}
                  >
                    Borrar Todos los Clientes
                  </button>
                </>
              )}
            </div>
        </div>
      </div>

      {isDangerModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="admin-danger-overlay" onClick={() => setIsDangerModalOpen(false)}>
          <div className="admin-danger-modal glass" onClick={e => e.stopPropagation()}>
            <div className="admin-danger-header">
              <div className="admin-danger-title">
                <AlertCircle size={22} className="text-accent" />
                <h3>Confirmar</h3>
              </div>
              <button onClick={() => setIsDangerModalOpen(false)} className="admin-danger-close"><XCircle size={24} /></button>
            </div>

            <div className="admin-danger-body">
              <p style={{ fontSize: '0.9rem', marginBottom: 20 }}>Acción irreversible. Ingresa credenciales.</p>
              <div className="form-group">
                <label>Email Admin</label>
                <input 
                  className="form-input" 
                  placeholder="admin@ejemplo.com" 
                  value={dangerUserName} 
                  onChange={e => setDangerUserName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && executeDangerAction()}
                />
              </div>
              <div className="form-group">
                <label>Clave</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={dangerPassword} 
                  onChange={e => setDangerPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && executeDangerAction()}
                />
              </div>
              {dangerError && <div style={{ color: '#ff4444', fontSize: '0.85rem', marginTop: 10 }}>{dangerError}</div>}
            </div>

            <div className="admin-danger-footer">
              <button 
                className="btn btn-primary btn-block" 
                onClick={executeDangerAction}
                disabled={loading}
                style={{ background: '#ff4444', color: 'white', border: 'none' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar y Borrar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AdminDangerZone;
