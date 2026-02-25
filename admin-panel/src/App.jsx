import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './pages/Layout';
import Users from './pages/Users';
import Companies from './pages/Companies';
import Branches from './pages/Branches';

function App() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route path="/" element={<Layout />}>
				<Route index element={<Navigate to="/users" replace />} />
				<Route path="users" element={<Users />} />
				<Route path="companies" element={<Companies />} />
				<Route path="branches" element={<Branches />} />
			</Route>
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}

export default App;
