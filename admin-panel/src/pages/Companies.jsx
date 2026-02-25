import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TABLES } from '../lib/tables';

export default function Companies() {
	const [list, setList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [notify, setNotify] = useState(null);
	const [modal, setModal] = useState({ open: false, item: null });
	const [deleteConfirm, setDeleteConfirm] = useState(null);
	const [form, setForm] = useState({
		name: '',
		legal_rut: '',
		address: '',
		phone: '',
		email: '',
	});

	const showNotify = (msg, type = 'success') => {
		setNotify({ msg, type });
		setTimeout(() => setNotify(null), 3000);
	};

	const load = useCallback(async () => {
		setLoading(true);
		const { data, error } = await supabase.from(TABLES.companies).select('*').order('name');
		if (error) {
			showNotify(error.message || 'Error al cargar empresas', 'error');
			setList([]);
		} else {
			setList(data || []);
		}
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	const openAdd = () => {
		setForm({ name: '', legal_rut: '', address: '', phone: '', email: '' });
		setModal({ open: true, item: null });
	};

	const openEdit = (item) => {
		setForm({
			name: item.name || '',
			legal_rut: item.legal_rut || '',
			address: item.address || '',
			phone: item.phone || '',
			email: item.email || '',
		});
		setModal({ open: true, item });
	};

	const handleSave = async (e) => {
		e.preventDefault();
		const payload = {
			name: form.name.trim() || null,
			legal_rut: form.legal_rut.trim() || null,
			address: form.address.trim() || null,
			phone: form.phone.trim() || null,
			email: form.email.trim() || null,
		};
		if (modal.item) {
			const { error } = await supabase.from(TABLES.companies).update(payload).eq('id', modal.item.id);
			if (error) {
				showNotify(error.message || 'Error al actualizar', 'error');
				return;
			}
			showNotify('Empresa actualizada');
		} else {
			const { error } = await supabase.from(TABLES.companies).insert(payload);
			if (error) {
				showNotify(error.message || 'Error al crear empresa', 'error');
				return;
			}
			showNotify('Empresa creada');
		}
		setModal({ open: false, item: null });
		load();
	};

	const handleDelete = async (item) => {
		const { error } = await supabase.from(TABLES.companies).delete().eq('id', item.id);
		if (error) {
			showNotify(error.message || 'Error al eliminar. ¿Tiene locales asociados?', 'error');
			return;
		}
		showNotify('Empresa eliminada');
		setDeleteConfirm(null);
		load();
	};

	return (
		<>
			<div className="page-header">
				<h1>Empresas</h1>
				<button type="button" className="btn btn-primary" onClick={openAdd}>
					<Plus size={18} /> Agregar empresa
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
									<th>Nombre</th>
									<th>RUT</th>
									<th>Dirección</th>
									<th>Teléfono</th>
									<th>Email</th>
									<th style={{ width: 120 }}>Acciones</th>
								</tr>
							</thead>
							<tbody>
								{list.length === 0 ? (
									<tr>
										<td colSpan={6} style={{ color: 'var(--text-muted)' }}>No hay empresas. Agrega una.</td>
									</tr>
								) : (
									list.map((row) => (
										<tr key={row.id}>
											<td>{row.name || '—'}</td>
											<td>{row.legal_rut || '—'}</td>
											<td title={row.address || ''} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.address || '—'}</td>
											<td>{row.phone || '—'}</td>
											<td>{row.email || '—'}</td>
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
						<h3>{modal.item ? 'Editar empresa' : 'Agregar empresa'}</h3>
						<form onSubmit={handleSave}>
							<div className="form-group">
								<label>Nombre</label>
								<input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre legal" />
							</div>
							<div className="form-group">
								<label>RUT / Identificación</label>
								<input className="form-input" value={form.legal_rut} onChange={(e) => setForm({ ...form, legal_rut: e.target.value })} placeholder="76.123.456-7" />
							</div>
							<div className="form-group">
								<label>Dirección</label>
								<input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Dirección fiscal" />
							</div>
							<div className="form-group">
								<label>Teléfono</label>
								<input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+56 9 ..." />
							</div>
							<div className="form-group">
								<label>Email</label>
								<input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contacto@empresa.cl" />
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
						<h3>Eliminar empresa</h3>
						<p style={{ color: 'var(--text-muted)', margin: 0 }}>
							¿Eliminar <strong style={{ color: 'var(--text)' }}>{deleteConfirm.name}</strong>? Elimina primero sus locales si los tiene.
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
