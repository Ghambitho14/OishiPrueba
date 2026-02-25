import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, Building2, MapPin, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TABLES } from '../lib/tables';

export default function Layout() {
	const navigate = useNavigate();
	const [userEmail, setUserEmail] = useState('');

	useEffect(() => {
		const check = async () => {
			const { data: { session } } = await supabase.auth.getSession();
			if (!session?.user) {
				navigate('/login', { replace: true });
				return;
			}
			const email = session.user.email;
			const { data: row } = await supabase
				.from(TABLES.admin_users)
				.select('role')
				.eq('email', email)
				.maybeSingle();
			const roleStr = (row?.role != null ? String(row.role) : '').toLowerCase().trim();
			if (roleStr !== 'nameku') {
				await supabase.auth.signOut();
				navigate('/login', { replace: true });
				return;
			}
			setUserEmail(email || '');
		};
		check();
	}, [navigate]);

	const handleLogout = async () => {
		await supabase.auth.signOut();
		navigate('/login', { replace: true });
	};

	return (
		<div className="panel-layout">
			<aside className="panel-sidebar">
				<h2>Panel Admin</h2>
				<nav>
					<NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
						<Users size={18} /> Usuarios
					</NavLink>
					<NavLink to="/companies" className={({ isActive }) => (isActive ? 'active' : '')}>
						<Building2 size={18} /> Empresas
					</NavLink>
					<NavLink to="/branches" className={({ isActive }) => (isActive ? 'active' : '')}>
						<MapPin size={18} /> Locales
					</NavLink>
				</nav>
				<div className="logout-row" style={{ padding: '1rem', borderTop: '1px solid var(--border)', marginTop: '1rem' }}>
					<span title={userEmail}>{userEmail ? `${userEmail.slice(0, 20)}${userEmail.length > 20 ? '…' : ''}` : '—'}</span>
					<button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout} title="Cerrar sesión">
						<LogOut size={16} />
					</button>
				</div>
			</aside>
			<main className="panel-main">
				<Outlet />
			</main>
		</div>
	);
}
