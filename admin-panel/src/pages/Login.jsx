import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TABLES } from '../lib/tables';

export default function Login() {
	const navigate = useNavigate();
	const location = useLocation();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const from = location.state?.from?.pathname || '/';

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const { data: authData, error: signError } = await supabase.auth.signInWithPassword({ email, password });
			if (signError) throw signError;
			const userEmail = authData?.user?.email;
			if (!userEmail) {
				await supabase.auth.signOut();
				throw new Error('No se pudo obtener tu email.');
			}
			const { data: row, error: roleError } = await supabase
				.from(TABLES.admin_users)
				.select('role')
				.eq('email', userEmail)
				.maybeSingle();
			const roleStr = (row?.role != null ? String(row.role) : '').toLowerCase().trim();
			if (roleError || roleStr !== 'nameku') {
				await supabase.auth.signOut();
				throw new Error(roleError?.message || 'No tienes permiso para acceder a este panel.');
			}
			navigate(from, { replace: true });
		} catch (err) {
			setError(err?.message || 'Error al iniciar sesión');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="login-page">
			<div className="login-card">
				<h1>Panel Admin</h1>
				<p>Gestiona usuarios, empresas y locales (base de prueba).</p>
				<form onSubmit={handleSubmit}>
					<div className="form-group">
						<label>Email</label>
						<input
							type="email"
							className="form-input"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="admin@ejemplo.com"
							required
							autoComplete="email"
						/>
					</div>
					<div className="form-group">
						<label>Contraseña</label>
						<input
							type="password"
							className="form-input"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							required
							autoComplete="current-password"
						/>
					</div>
					{error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
					<button type="submit" className="btn btn-primary" disabled={loading}>
						{loading ? 'Entrando...' : 'Entrar'}
					</button>
				</form>
			</div>
		</div>
	);
}
