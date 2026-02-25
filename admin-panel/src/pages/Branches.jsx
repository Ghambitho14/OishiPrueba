import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TABLES } from '../lib/tables';

export default function Branches() {
	const [list, setList] = useState([]);
	const [companies, setCompanies] = useState([]);
	const [filterCompany, setFilterCompany] = useState('');
	const [loading, setLoading] = useState(true);
	const [notify, setNotify] = useState(null);
	const [modal, setModal] = useState({ open: false, item: null });
	const [deleteConfirm, setDeleteConfirm] = useState(null);
	const [form, setForm] = useState({
		company_id: '',
		name: '',
		phone: '',
		address: '',
		schedule: '',
		is_active: true,
	});

	const showNotify = (msg, type = 'success') => {
		setNotify({ msg, type });
		setTimeout(() => setNotify(null), 3000);
	};

	const loadCompanies = useCallback(async () => {
		const { data } = await supabase.from(TABLES.companies).select('id, name').order('name');
		setCompanies(data || []);
	}, []);

	const load = useCallback(async () => {
		setLoading(true);
		let q = supabase.from(TABLES.branches).select('*, companies(name)').order('name');
		if (filterCompany) q = q.eq('company_id', filterCompany);
		const { data, error } = await q;
		if (error) {
			showNotify(error.message || 'Error al cargar locales', 'error');
			setList([]);
		} else {
			setList(data || []);
		}
		setLoading(false);
	}, [filterCompany]);

	useEffect(() => { loadCompanies(); }, [loadCompanies]);
	useEffect(() => { load(); }, [load]);

	const openAdd = () => {
		setForm({
			company_id: companies[0]?.id || filterCompany || '',
			name: '',
			phone: '',
			address: '',
			schedule: '',
			is_active: true,
		});
		setModal({ open: true, item: null });
	};

	const openEdit = (item) => {
		setForm({
			company_id: item.company_id || '',
			name: item.name || '',
			phone: item.phone || '',
			address: item.address || '',
			schedule: item.schedule || '',
			is_active: item.is_active !== false,
		});
		setModal({ open: true, item });
	};

	const handleSave = async (e) => {
		e.preventDefault();
		const payload = {
			company_id: form.company_id || null,
			name: form.name.trim() || null,
			phone: form.phone.trim() || null,
			address: form.address.trim() || null,
			schedule: form.schedule.trim() || null,
			is_active: form.is_active,
		};
		if (modal.item) {
			const { error } = await supabase.from(TABLES.branches).update(payload).eq('id', modal.item.id);
			if (error) {
				showNotify(error.message || 'Error al actualizar', 'error');
				return;
			}
			showNotify('Local actualizado');
		} else {
			if (!payload.company_id) {
				showNotify('Selecciona una empresa', 'error');
				return;
			}
			const { error } = await supabase.from(TABLES.branches).insert(payload);
			if (error) {
				showNotify(error.message || 'Error al crear local', 'error');
				return;
			}
			showNotify('Local creado');
		}
		setModal({ open: false, item: null });
		load();
	};

	const handleDelete = async (item) => {
		const { error } = await supabase.from(TABLES.branches).delete().eq('id', item.id);
		if (error) {
			showNotify(error.message || 'Error al eliminar', 'error');
			return;
		}
		showNotify('Local eliminado');
		setDeleteConfirm(null);
		load();
	};

	const filteredList = list;

	return (
		<>
			<div className="page-header">
				<h1>Locales (sucursales)</h1>
				<button type="button" className="btn btn-primary" onClick={openAdd} disabled={companies.length === 0}>
					<Plus size={18} /> Agregar local
				</button>
			</div>

			{companies.length > 0 && (
				<div className="card" style={{ marginBottom: '1rem' }}>
					<label style={{ marginRight: '0.5rem', color: 'var(--text-muted)' }}>Filtrar por empresa:</label>
					<select
						className="form-select"
						value={filterCompany}
						onChange={(e) => setFilterCompany(e.target.value)}
						style={{ maxWidth: 280, display: 'inline-block' }}
					>
						<option value="">Todas</option>
						{companies.map((c) => (
							<option key={c.id} value={c.id}>{c.name}</option>
						))}
					</select>
				</div>
			)}

			<div className="card">
				{loading ? (
					<p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
				) : (
					<div className="table-wrap">
						<table>
							<thead>
								<tr>
									<th>Nombre</th>
									<th>Empresa</th>
									<th>Teléfono</th>
									<th>Estado</th>
									<th style={{ width: 120 }}>Acciones</th>
								</tr>
							</thead>
							<tbody>
								{filteredList.length === 0 ? (
									<tr>
										<td colSpan={5} style={{ color: 'var(--text-muted)' }}>
											{companies.length === 0 ? 'Crea primero una empresa.' : 'No hay locales. Agrega uno.'}
										</td>
									</tr>
								) : (
									filteredList.map((row) => (
										<tr key={row.id}>
											<td>{row.name || '—'}</td>
											<td>{row.companies?.name || '—'}</td>
											<td>{row.phone || '—'}</td>
											<td>
												<span style={{
													background: row.is_active !== false ? 'rgba(74, 222, 128, 0.2)' : 'rgba(148, 163, 184, 0.2)',
													padding: '0.2rem 0.5rem',
													borderRadius: 6,
													fontSize: '0.85rem',
												}}>
													{row.is_active !== false ? 'Activo' : 'Inactivo'}
												</span>
											</td>
											<td>
												<button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)} title="Editar">
													<Pencil size={14} />
												</button>
												<button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(row)} title="Eliminar">
													<Trash2 size={14} />
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{modal.open && (
				<div className="modal-overlay" onClick={() => setModal({ open: false, item: null })}>
					<div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
						<h3>{modal.item ? 'Editar local' : 'Agregar local'}</h3>
						<form onSubmit={handleSave}>
							<div className="form-group">
								<label>Empresa</label>
								<select
									className="form-select"
									value={form.company_id}
									onChange={(e) => setForm({ ...form, company_id: e.target.value })}
									required
								>
									<option value="">Selecciona empresa</option>
									{companies.map((c) => (
										<option key={c.id} value={c.id}>{c.name}</option>
									))}
								</select>
							</div>
							<div className="form-group">
								<label>Nombre del local</label>
								<input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Sucursal Centro" required />
							</div>
							<div className="form-group">
								<label>Teléfono</label>
								<input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+56 9 ..." />
							</div>
							<div className="form-group">
								<label>Dirección</label>
								<input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Dirección del local" />
							</div>
							<div className="form-group">
								<label>Horario</label>
								<input className="form-input" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="Lun-Vie 9:00-18:00" />
							</div>
							<div className="form-group">
								<label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
									Activo
								</label>
							</div>
							<div className="modal-actions">
								<button type="button" className="btn btn-ghost" onClick={() => setModal({ open: false, item: null })}>Cancelar</button>
								<button type="submit" className="btn btn-primary">Guardar</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{deleteConfirm && (
				<div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
					<div className="modal" onClick={(e) => e.stopPropagation()}>
						<h3>Eliminar local</h3>
						<p style={{ color: 'var(--text-muted)', margin: 0 }}>
							¿Eliminar <strong style={{ color: 'var(--text)' }}>{deleteConfirm.name}</strong>?
						</p>
						<div className="modal-actions">
							<button type="button" className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
							<button type="button" className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Eliminar</button>
						</div>
					</div>
				</div>
			)}

			{notify && <div className={`notify ${notify.type}`} role="alert">{notify.msg}</div>}
		</>
	);
}
