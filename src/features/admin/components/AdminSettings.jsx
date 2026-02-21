import React, { useState, useEffect } from 'react';
import { Save, Building, Phone, MapPin, Instagram, Clock, CreditCard, CheckCircle2, AlertCircle, User, Mail, Hash, ChevronDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { TABLES } from '../../../lib/supabaseTables';
import "../styles/AdminSettings.css";

// ID fijo de la única fila de configuración (upsert por este id)
const BUSINESS_INFO_ROW_ID = '00000000-0000-0000-0000-000000000001';

const AdminSettings = ({ showNotify, isMobile }) => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        instagram: '',
        schedule: '',
        bank_name: '',
        account_type: '',
        account_number: '',
        account_rut: '',
        account_email: '',
        account_holder: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dataId, setDataId] = useState(null); // ID de la fila para update

    const [expandedSection, setExpandedSection] = useState(() => (isMobile ? 'basic' : null));

    const loadSettings = React.useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from(TABLES.business_info)
                .select('*')
                .limit(1)
                .maybeSingle();
            
            if (error) throw error;

            if (data) {
                setFormData({
                    name: data.name || '',
                    phone: data.phone || '',
                    address: data.address || '',
                    instagram: data.instagram || '',
                    schedule: data.schedule || '',
                    bank_name: data.bank_name || '',
                    account_type: data.account_type || '',
                    account_number: data.account_number || '',
                    account_rut: data.account_rut || '',
                    account_email: data.account_email || '',
                    account_holder: data.account_holder || ''
                });
                setDataId(data.id);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showNotify('Error al cargar configuración', 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotify]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                id: BUSINESS_INFO_ROW_ID,
                name: formData.name || null,
                phone: formData.phone || null,
                address: formData.address || null,
                instagram: formData.instagram || null,
                schedule: formData.schedule || null,
                bank_name: formData.bank_name || null,
                account_type: formData.account_type || null,
                account_number: formData.account_number || null,
                account_rut: formData.account_rut || null,
                account_email: formData.account_email || null,
                account_holder: formData.account_holder || null
            };
            const { error } = await supabase
                .from(TABLES.business_info)
                .upsert(payload, { onConflict: 'id' });
            if (error) throw error;
            setDataId(BUSINESS_INFO_ROW_ID);
            showNotify('Configuración guardada correctamente', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            const msg = (error && typeof error === 'object' && error.message)
                ? `${error.message}${error.code ? ` (${error.code})` : ''}`
                : String(error || 'Error al guardar configuración');
            showNotify(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-white">Cargando configuración...</div>;

    return (
        <div className="settings-container animate-fade">
            <header className="settings-header">
                <div>
                    <h1>Configuración del Negocio</h1>
                    <p style={{ color: '#9ca3af', marginTop: 5 }}>Gestiona la información pública de tu local.</p>
                </div>
                <button 
                    className="btn btn-primary" 
                    onClick={handleSubmit} 
                    disabled={saving}
                    style={{ minWidth: 140 }}
                >
                    {saving ? 'Guardando...' : <><Save size={18} style={{ marginRight: 8 }} /> Guardar Cambios</>}
                </button>
            </header>

            <form className="settings-form glass" onSubmit={handleSubmit}>
                
                {/* Info Básica */}
                <section className="settings-section">
                    {isMobile ? (
                        <button
                            type="button"
                            onClick={() => setExpandedSection(prev => prev === 'basic' ? null : 'basic')}
                            className="section-title"
                            style={{ width: '100%', justifyContent: 'space-between', background: 'transparent', border: 'none', paddingBottom: 15, cursor: 'pointer' }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Building size={20} className="text-secondary" /> Información Básica
                            </span>
                            <ChevronDown size={18} style={{ transform: expandedSection === 'basic' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                        </button>
                    ) : (
                        <h3 className="section-title"><Building size={20} className="text-secondary" /> Información Básica</h3>
                    )}
                    {(!isMobile || expandedSection === 'basic') && (
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Nombre del Negocio</label>
                            <div className="input-icon-wrapper">
                                <Building size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="Ej. Oishi Sushi"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Teléfono / WhatsApp (para botón)</label>
                            <div className="input-icon-wrapper">
                                <Phone size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    placeholder="+569..."
                                />
                            </div>
                        </div>
                    </div>
                    )}
                </section>

                {/* Ubicación y Redes */}
                <section className="settings-section">
                    {isMobile ? (
                        <button
                            type="button"
                            onClick={() => setExpandedSection(prev => prev === 'location' ? null : 'location')}
                            className="section-title"
                            style={{ width: '100%', justifyContent: 'space-between', background: 'transparent', border: 'none', paddingBottom: 15, cursor: 'pointer' }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <MapPin size={20} className="text-secondary" /> Ubicación y Redes
                            </span>
                            <ChevronDown size={18} style={{ transform: expandedSection === 'location' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                        </button>
                    ) : (
                        <h3 className="section-title"><MapPin size={20} className="text-secondary" /> Ubicación y Redes</h3>
                    )}
                    {(!isMobile || expandedSection === 'location') && (
                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>Dirección Completa</label>
                            <div className="input-icon-wrapper">
                                <MapPin size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.address}
                                    onChange={e => setFormData({...formData, address: e.target.value})}
                                    placeholder="Ej. Av. Siempre Viva 123, Santiago"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Instagram</label>
                            <div className="input-icon-wrapper">
                                <Instagram size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.instagram}
                                    onChange={e => setFormData({...formData, instagram: e.target.value})}
                                    placeholder="@usuario"
                                />
                            </div>
                        </div>
                    </div>
                    )}
                </section>

                {/* Horarios y Pagos */}
                <section className="settings-section">
                    {isMobile ? (
                        <button
                            type="button"
                            onClick={() => setExpandedSection(prev => prev === 'schedule' ? null : 'schedule')}
                            className="section-title"
                            style={{ width: '100%', justifyContent: 'space-between', background: 'transparent', border: 'none', paddingBottom: 15, cursor: 'pointer' }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Clock size={20} className="text-secondary" /> Horarios y Pagos
                            </span>
                            <ChevronDown size={18} style={{ transform: expandedSection === 'schedule' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                        </button>
                    ) : (
                        <h3 className="section-title"><Clock size={20} className="text-secondary" /> Horarios y Pagos</h3>
                    )}
                    {(!isMobile || expandedSection === 'schedule') && (
                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>Horarios de Atención</label>
                            <textarea 
                                className="form-textarea"
                                value={formData.schedule}
                                onChange={e => setFormData({...formData, schedule: e.target.value})}
                                placeholder="Ej. Lunes a Viernes: 12:00 - 22:00"
                                rows={3}
                            />
                        </div>
                    </div>
                    )}
                </section>

                {/* Datos Bancarios */}
                <section className="settings-section">
                    {isMobile ? (
                        <button
                            type="button"
                            onClick={() => setExpandedSection(prev => prev === 'bank' ? null : 'bank')}
                            className="section-title"
                            style={{ width: '100%', justifyContent: 'space-between', background: 'transparent', border: 'none', paddingBottom: 15, cursor: 'pointer' }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <CreditCard size={20} className="text-secondary" /> Datos de Transferencia
                            </span>
                            <ChevronDown size={18} style={{ transform: expandedSection === 'bank' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                        </button>
                    ) : (
                        <h3 className="section-title"><CreditCard size={20} className="text-secondary" /> Datos de Transferencia</h3>
                    )}
                    {(!isMobile || expandedSection === 'bank') && (
                    <>
                    <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 20 }}>
                        Estos datos se mostrarán cuando el cliente elija "Pagar con Transferencia"
                    </p>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Banco</label>
                            <div className="input-icon-wrapper">
                                <CreditCard size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.bank_name}
                                    onChange={e => setFormData({...formData, bank_name: e.target.value})}
                                    placeholder="Ej. Banco Estado"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Tipo de Cuenta</label>
                            <div className="input-icon-wrapper">
                                <CreditCard size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.account_type}
                                    onChange={e => setFormData({...formData, account_type: e.target.value})}
                                    placeholder="Ej. Cuenta RUT, Cuenta Vista"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Número de Cuenta</label>
                            <div className="input-icon-wrapper">
                                <Hash size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.account_number}
                                    onChange={e => setFormData({...formData, account_number: e.target.value})}
                                    placeholder="Ej. 12345678-9"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>RUT Titular</label>
                            <div className="input-icon-wrapper">
                                <User size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.account_rut}
                                    onChange={e => setFormData({...formData, account_rut: e.target.value})}
                                    placeholder="Ej. 12.345.678-9"
                                />
                            </div>
                        </div>
                        <div className="form-group full-width">
                            <label>Correo Electrónico</label>
                            <div className="input-icon-wrapper">
                                <Mail size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.account_email}
                                    onChange={e => setFormData({...formData, account_email: e.target.value})}
                                    placeholder="Ej. contacto@negocio.cl"
                                    type="email"
                                />
                            </div>
                        </div>
                        <div className="form-group full-width">
                            <label>Nombre del Titular</label>
                            <div className="input-icon-wrapper">
                                <User size={16} className="input-icon" />
                                <input 
                                    className="form-input with-icon"
                                    value={formData.account_holder}
                                    onChange={e => setFormData({...formData, account_holder: e.target.value})}
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                </section>

            </form>
        </div>
    );
};

export default AdminSettings;
