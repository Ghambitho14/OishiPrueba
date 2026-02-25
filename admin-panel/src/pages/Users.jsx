import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TABLES } from '../lib/tables';

const ROLES = [
	{ value: 'nameku', label: 'Nameku (dueño)' },
	{ value: 'admin', label: 'Admin' },
	{ value: 'cajero', label: 'Cajero' },
];

export default function Users() {
	const [list, setList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [notify, setNotify] = useState(null);
	const [modal, setModal] = useState({ open: false, item: null });
	const [deleteConfirm, setDeleteConfirm] = useState(null);
	const [form, setForm] = useState({ email: '', role: 'cajero' });

	const showNotify = (msg, type = 'success') => {
		setNotify({ msg, type });
		setTimeout(() => setNotify(null), 3000);
	};

	const load = useCallback(async () => {
		setLoading(true);
		const { data, error } = await supabase.from(TABLES.admin_users).select('*').order('email');
		if (error) {
			showNotify(error.message || 'Error al cargar usuarios', 'error');
			setList([]);
		} else {
			setList(data || []);
		}
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	const openAdd = () => {
		setForm({ email: '', role: 'cajero' });
		setModal({ open: true, item: null });
	};

	const openEdit = (item) => {
		const role = (item.role === 'nameku' || item.role === 'admin' || item.role === 'cajero') ? item.role : 'cajero';
		setForm({
			email: item.email || '',
			role,
		});
		setModal({ open: true, item });
	};

	const handleSave = async (e) => {
		e.preventDefault();
		const email = (form.email || '').trim().toLowerCase();
		if (!email) {
			showNotify('El email es obligatorio', 'error');
			return;
		}
		if (modal.item) {
			const { error } = await supabase
				.from(TABLES.admin_users)
				.update({ role: form.role })
				.eq('id', modal.item.id);
			if (error) {
				showNotify(error.message || 'Error al actualizar', 'error');
				return;
			}
			showNotify('Usuario actualizado');
		} else {
			const { error } = await supabase.from(TABLES.admin_users).insert({
				email,
				role: form.role,
			});
			if (error) {
				showNotify(error.message || 'Error al agregar usuario', 'error');
				return;
			}
			showNotify('Usuario agregado. Debe registrarse con ese email en la app para poder entrar.');
		}
		setModal({ open: false, item: null });
		load();
	};

	const handleDelete = async (item) => {
		const { error } = await supabase.from(TABLES.admin_users).delete().eq('id', item.id);
		if (error) {
			showNotify(error.message || 'Error al eliminar', 'error');
			return;
		}
		showNotify('Usuario eliminado');
		setDeleteConfirm(null);
		load();
	};

	return (
		<>
			<div className="page-header">
				<h1>Usuarios (Cajeros / Admin)</h1>
				<button type="button" className="btn btn-primary" onClick={openAdd}>
					<Plus size={18} /> Agregar usuario
				</button>
			</div>

			<div className="card">
				{loading ? (
					<p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
				) : (
					<div className="table-wrap">
						<table>
							<thead>
								<tr>
									<th>Email</th>
									<th>Rol</th>
									<th style={{ width: 120 }}>Acciones</th>
								</tr>
							</thead>
							<tbody>
								{list.length === 0 ? (
									<tr>
										<td colSpan={3} style={{ color: 'var(--text-muted)' }}>No hay usuarios. Agrega uno.</td>
									</tr>
								) : (
									list.map((row) => (
										<tr key={row.id}>
											<td>{row.email}</td>
											<td>
												<span style={{
													background: row.role === 'nameku' ? 'rgba(168, 85, 247, 0.25)' : row.role === 'admin' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(148, 163, 184, 0.2)',
													padding: '0.2rem 0.5rem',
													borderRadius: 6,
													fontSize: '0.85rem',
												}}>
													{ROLES.find(r => r.value === row.role)?.label || row.role || 'Cajero'}
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
					<div className="modal" onClick={(e) => e.stopPropagation()}>
						<h3>{modal.item ? 'Editar usuario' : 'Agregar usuario'}</h3>
						<form onSubmit={handleSave}>
							<div className="form-group">
								<label>Email</label>
								<input
									type="email"
									className="form-input"
									value={form.email}
									onChange={(e) => setForm({ ...form, email: e.target.value })}
									placeholder="usuario@ejemplo.com"
									disabled={!!modal.item}
									required
								/>
								{modal.item && <small style={{ color: 'var(--text-muted)' }}>No se puede cambiar el email.</small>}
							</div>
							<div className="form-group">
								<label>Rol</label>
								<select
									className="form-select"
									value={form.role}
									onChange={(e) => setForm({ ...form, role: e.target.value })}
								>
									{ROLES.map((r) => (
										<option key={r.value} value={r.value}>{r.label}</option>
									))}
								</select>
							</div>
							<div className="modal-actions">
								<button type="button" className="btn btn-ghost" onClick={() => setModal({ open: false, item: null })}>
									Cancelar
								</button>
								<button type="submit" className="btn btn-primary">Guardar</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{deleteConfirm && (
				<div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
					<div className="modal" onClick={(e) => e.stopPropagation()}>
						<h3>Eliminar usuario</h3>
						<p style={{ color: 'var(--text-muted)', margin: 0 }}>
							¿Eliminar a <strong style={{ color: 'var(--text)' }}>{deleteConfirm.email}</strong>? Dejará de poder entrar al panel de la app.
						</p>
						<div className="modal-actions">
							<button type="button" className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
							<button type="button" className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Eliminar</button>
						</div>
					</div>
				</div>
			)}

			{notify && (
				<div className={`notify ${notify.type}`} role="alert">
					{notify.msg}
				</div>
			)}
		</>
	);
}
