import React, { useState, useEffect } from 'react';
import { Save, Building, Phone, MapPin, Instagram, Clock, CreditCard, CheckCircle2, AlertCircle, User, Mail, Hash, ChevronDown, Link as LinkIcon, MessageCircle, ExternalLink, Wand2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { TABLES } from '../../../lib/supabaseTables';
import "../styles/AdminSettings.css";

// ID fijo de la única fila de configuración (upsert por este id)
const BUSINESS_INFO_ROW_ID = '00000000-0000-0000-0000-000000000001';

const AdminSettings = ({ showNotify, isMobile, selectedBranch }) => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        instagram: '',
        map_url: '',
        whatsapp_url: '',
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
            let data, error;

            // LÓGICA MULTI-LOCAL: Decidir fuente de datos
            if (selectedBranch && selectedBranch.id !== 'all') {
                // Cargar configuración ESPECÍFICA de la sucursal
                const response = await supabase
                    .from(TABLES.branches)
                    .select('*')
                    .eq('id', selectedBranch.id)
                    .single();
                
                data = response.data;
                // [FIX] Mapeo de campos específicos de branches
                if (data) {
                    data.instagram = data.instagram_url; // branches usa instagram_url
                }
                error = response.error;
            } else {
                // Cargar configuración GLOBAL
                const response = await supabase.from(TABLES.business_info).select('*').limit(1).maybeSingle();
                data = response.data;
                error = response.error;
            }
            
            if (error) throw error;

            if (data) {
                setFormData({
                    name: data.name || '',
                    phone: data.phone || '',
                    address: data.address || '',
                    instagram: data.instagram || '',
                    map_url: data.map_url || '',
                    whatsapp_url: data.whatsapp_url || '',
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
    }, [showNotify, selectedBranch]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings, selectedBranch]); // Recargar si cambia la sucursal

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                name: formData.name || null,
                phone: formData.phone || null,
                address: formData.address || null,
                instagram: formData.instagram || null,
                map_url: formData.map_url || null,
                whatsapp_url: formData.whatsapp_url || null,
                schedule: formData.schedule || null,
                bank_name: formData.bank_name || null,
                account_type: formData.account_type || null,
                account_number: formData.account_number || null,
                account_rut: formData.account_rut || null,
                account_email: formData.account_email || null,
                account_holder: formData.account_holder || null
            };

            let error;

            if (selectedBranch && selectedBranch.id !== 'all') {
                // ACTUALIZAR SUCURSAL ESPECÍFICA
                // [FIX] Adaptar payload al esquema de branches
                const branchPayload = {
                    ...payload,
                    instagram_url: payload.instagram, // Mapear a columna correcta
                };
                delete branchPayload.instagram; // Eliminar campo que no existe en branches
                delete branchPayload.id; // No actualizar ID

                const res = await supabase
                    .from(TABLES.branches)
                    .update(branchPayload)
                    .eq('id', selectedBranch.id);
                error = res.error;
            } else {
                // ACTUALIZAR GLOBAL (business_info)
                // Filtramos campos que no existen en business_info para evitar errores
                const globalPayload = { ...payload };
                delete globalPayload.map_url;
                delete globalPayload.whatsapp_url;

                const res = await supabase
                    .from(TABLES.business_info)
                    .upsert({ ...globalPayload, id: BUSINESS_INFO_ROW_ID }, { onConflict: 'id' });
                error = res.error;
            }

            if (error) throw error;
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

    // Herramientas de UI
    const openLink = (url) => {
        if (!url) return;
        window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
    };

    const generateWaLink = () => {
        const cleanPhone = formData.phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.startsWith('56') ? cleanPhone : `56${cleanPhone}`;
        if (finalPhone.length < 8) return showNotify('Ingresa un teléfono válido primero', 'error');
        
        setFormData(prev => ({ ...prev, whatsapp_url: `https://wa.me/${finalPhone}` }));
    };

    if (loading) return <div className="p-10 text-center text-white">Cargando configuración...</div>;

    return (
        <div className="settings-container animate-fade">
            <header className="settings-header">
                <div>
                    <h1>Configuración {selectedBranch?.id !== 'all' ? 'Local' : 'Global'}</h1>
                    <p style={{ color: '#9ca3af', marginTop: 5 }}>
                        {selectedBranch?.id !== 'all' 
                            ? `Editando datos exclusivos para: ${selectedBranch.name}`
                            : 'Editando datos predeterminados para toda la empresa.'}
                    </p>
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
                        {selectedBranch?.id !== 'all' && (
                            <>
                                <div className="form-group">
                                    <label>Link Google Maps (Opcional)</label>
                                    <div className="input-icon-wrapper">
                                        <LinkIcon size={16} className="input-icon" />
                                        <input 
                                            className="form-input with-icon"
                                            value={formData.map_url}
                                            onChange={e => setFormData({...formData, map_url: e.target.value})}
                                            placeholder="https://maps.app.goo.gl/..."
                                            style={{ paddingRight: 40 }}
                                        />
                                        {formData.map_url && (
                                            <button 
                                                type="button"
                                                onClick={() => openLink(formData.map_url)}
                                                className="btn-icon-action"
                                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 4 }}
                                                title="Probar enlace"
                                            >
                                                <ExternalLink size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Link WhatsApp Directo (Opcional)</label>
                                    <div className="input-icon-wrapper">
                                        <MessageCircle size={16} className="input-icon" />
                                        <input 
                                            className="form-input with-icon"
                                            value={formData.whatsapp_url}
                                            onChange={e => setFormData({...formData, whatsapp_url: e.target.value})}
                                            placeholder="https://wa.me/569..."
                                            style={{ paddingRight: 70 }}
                                        />
                                        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                                            {!formData.whatsapp_url && formData.phone && (
                                                <button 
                                                    type="button"
                                                    onClick={generateWaLink}
                                                    style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: 4 }}
                                                    title="Generar link con el teléfono"
                                                >
                                                    <Wand2 size={16} />
                                                </button>
                                            )}
                                            {formData.whatsapp_url && (
                                                <button 
                                                    type="button"
                                                    onClick={() => openLink(formData.whatsapp_url)}
                                                    style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 4 }}
                                                    title="Probar enlace"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
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
