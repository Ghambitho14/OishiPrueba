import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle, XCircle, FileText, Trash2, Users } from 'lucide-react';

const AdminDangerZone = ({ orders, showNotify, loadData, isMobile }) => {
  const [analyticsDate, setAnalyticsDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false);
  const [dangerAction, setDangerAction] = useState(null);
  const [dangerUserName, setDangerUserName] = useState('');
  const [dangerPassword, setDangerPassword] = useState('');
  const [dangerError, setDangerError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleExportMonthlyCsv = async () => {
    const [year, month] = analyticsDate.split('-');
    const filteredOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === parseInt(month);
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

      setIsDangerModalOpen(false);

      if (dangerAction === 'monthlyOrders') {
        const [year, month] = analyticsDate.split('-');
        const start = new Date(year, month - 1, 1).toISOString();
        const end = new Date(year, month, 0, 23, 59, 59).toISOString();

        // 1. Borrar movimientos de caja del mes para evitar error de FK
        await supabase.from('cash_movements').delete()
          .gte('created_at', start).lte('created_at', end);

        // 2. Borrar las órdenes
        const { error } = await supabase.from('orders').delete()
          .gte('created_at', start).lte('created_at', end).select();

        if (error) throw error;
        showNotify(`Registros del mes eliminados con éxito`, 'success');

      } else if (dangerAction === 'allClients') {
        const { count, error } = await supabase.from('clients').delete().neq('phone', '0000').select('*', { count: 'exact' });
        if (error) throw error;
        showNotify(`Base de clientes purgada (${count} registros)`, 'success');
      }

      // Registro de auditoría (opcional, no bloquea)
      try {
        await supabase.from('audit_logs').insert({
          actor_name: trimmedEmail,
          action: dangerAction,
          created_at: new Date().toISOString()
        });
      } catch {
        console.warn('No se pudo guardar el log de auditoría');
      }

      loadData(true);
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
            
            {/* Cierre Mensual */}
            <div className="glass" style={{ padding: 25, borderRadius: 16, border: '1px solid var(--accent-success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                <FileText size={28} color="#25d366" />
                <h3 style={{ margin: 0 }}>Reporte Cierre Mensual</h3>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: 20 }}>
                Genera y descarga un Excel con todas las ventas del mes seleccionado.
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <input 
                    type="month" 
                    className="form-input" 
                    style={{ width: 'auto', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} 
                    value={analyticsDate} 
                    onChange={e => setAnalyticsDate(e.target.value)} 
                />
              </div>
              <button onClick={handleExportMonthlyCsv} className="btn-table-action" style={{ width: '100%', padding: 12, background: 'rgba(37, 211, 102, 0.2)', color: '#25d366', border: '1px solid #25d366' }}>
                Descargar Reporte Mes
              </button>
            </div>

            {/* Eliminar Mes */}
            <div className="glass" style={{ padding: 25, borderRadius: 16, border: '1px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                <Trash2 size={28} color="#ef4444" />
                <h3 style={{ margin: 0 }}>Eliminar Ventas Mes</h3>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: 20 }}>
                Borra todas las órdenes y movimientos de caja del mes seleccionado ({analyticsDate}). 
                <br/><b style={{color: '#ef4444'}}>Acción irreversible.</b>
              </p>
              <button onClick={() => openDangerModal('monthlyOrders')} className="btn-table-action" style={{ width: '100%', padding: 12, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444' }}>
                Eliminar Datos Mes
              </button>
            </div>

             {/* Eliminar Clientes */}
             <div className="glass" style={{ padding: 25, borderRadius: 16, border: '1px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                <Users size={28} color="#ef4444" />
                <h3 style={{ margin: 0 }}>Purgar Clientes</h3>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: 20 }}>
                Elimina todos los clientes de la base de datos excepto el genérico.
                <br/><b style={{color: '#ef4444'}}>Solo usar en desarrollo.</b>
              </p>
              <button onClick={() => openDangerModal('allClients')} className="btn-table-action" style={{ width: '100%', padding: 12, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444' }}>
                Borrar Todos los Clientes
              </button>
            </div>
        </div>
      </div>

      {isDangerModalOpen && (
        <div className="admin-panel-overlay" onClick={() => setIsDangerModalOpen(false)}>
          <div className="admin-side-panel glass animate-slide-in" style={{ maxWidth: 350, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="admin-side-header">
              <div className="flex-center"><AlertCircle size={22} className="text-accent" /><h3>Confirmar</h3></div>
              <button onClick={() => setIsDangerModalOpen(false)} className="btn-close-sidepanel"><XCircle size={24} /></button>
            </div>
            <div className="admin-side-body" style={{ overflowY: 'auto', flex: 1 }}>
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
            <div className="admin-side-footer" style={{ marginTop: 'auto' }}>
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
        </div>
      )}
    </>
  );
};

export default AdminDangerZone;
