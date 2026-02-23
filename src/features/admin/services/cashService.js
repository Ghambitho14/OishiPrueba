import { supabase } from '../../../lib/supabase';
import { TABLES } from '../../../lib/supabaseTables';

/**
 * Servicio para la gestión de Caja (Shifts y Movements)
 * Optimizado para multi-sucursal y para reducir condiciones de carrera.
 */

export const cashService = {
	// --- TURNOS ---

	/**
	 * Obtiene un turno abierto (cualquiera) para compatibilidad.
	 * En multi-sucursal puede haber varios; se devuelve el primero para no fallar con maybeSingle().
	 */
	getActiveShift: async () => {
		const { data, error } = await supabase
			.from(TABLES.cash_shifts)
			.select('*, cash_movements(count)')
			.eq('status', 'open')
			.limit(1)
			.maybeSingle();

		if (error) throw error;
		return data;
	},

	/**
	 * Obtiene el turno abierto para una sucursal específica.
	 */
	getActiveShiftForBranch: async (branchId) => {
		if (!branchId) return null;
		const { data, error } = await supabase
			.from(TABLES.cash_shifts)
			.select('*, cash_movements(count)')
			.eq('status', 'open')
			.eq('branch_id', branchId)
			.maybeSingle();

		if (error) throw error;
		return data;
	},

	/**
	 * Obtiene los IDs de sucursales que tienen caja abierta.
	 */
	getBranchesWithOpenCaja: async () => {
		const { data, error } = await supabase
			.from(TABLES.cash_shifts)
			.select('branch_id')
			.eq('status', 'open')
			.not('branch_id', 'is', null);

		if (error) throw error;
		return (data || []).map(r => r.branch_id).filter(Boolean).map(id => String(id));
	},

	/**
	 * Abre un nuevo turno de caja. Soporta multi-sucursal si se pasa branchId.
	 * @param {number} openingBalance
	 * @param {string} userId
	 * @param {string} [branchId] - Si se pasa, la validación y el insert son por sucursal.
	 */
	openShift: async (openingBalance, userId, branchId = null) => {
		const table = supabase.from(TABLES.cash_shifts);
		let checkQuery = table.select('id').eq('status', 'open');
		if (branchId) checkQuery = checkQuery.eq('branch_id', branchId);
		const { data: existingShift, error: checkError } = await checkQuery.maybeSingle();

		if (checkError) throw new Error('Error al verificar estado de caja: ' + checkError.message);
		if (existingShift) {
			throw new Error(branchId
				? 'Ya existe una caja abierta en esta sucursal.'
				: 'Ya existe un turno de caja abierto en el sistema.');
		}

		const insertPayload = {
			opening_balance: openingBalance,
			expected_balance: openingBalance,
			opened_by: userId,
			status: 'open'
		};
		if (branchId) insertPayload.branch_id = branchId;

		const { data, error } = await supabase
			.from(TABLES.cash_shifts)
			.insert(insertPayload)
			.select()
			.single();

		if (error) throw error;
		return data;
	},

	/**
	 * Cierra un turno de caja.
	 */
	closeShift: async (shiftId, actualBalance) => {
		const { data, error } = await supabase
			.from(TABLES.cash_shifts)
			.update({
				actual_balance: actualBalance,
				closed_at: new Date().toISOString(),
				status: 'closed'
			})
			.eq('id', shiftId)
			.eq('status', 'open')
			.select()
			.single();

		if (error) throw new Error('No se pudo cerrar la caja o ya se encuentra cerrada.');
		return data;
	},

	// --- MOVIMIENTOS ---

	/**
	 * Registra un nuevo movimiento de caja.
	 * Intenta actualizar saldo vía RPC (atómico); si no existe, usa fallback lectura+escritura.
	 */
	addMovement: async (movement) => {
		const { data: newMovement, error: moveError } = await supabase
			.from(TABLES.cash_movements)
			.insert(movement)
			.select()
			.single();

		if (moveError) throw moveError;

		if (movement.payment_method === 'cash') {
			const numericAmount = Number(movement.amount);
			if (isNaN(numericAmount)) return newMovement;

			const amountChange = movement.type === 'expense' ? -numericAmount : numericAmount;

			const { error: rpcError } = await supabase.rpc('increment_expected_balance', {
				shift_id: movement.shift_id,
				amount: amountChange
			});

			if (rpcError) {
				try {
					const { data: shiftData } = await supabase
						.from(TABLES.cash_shifts)
						.select('expected_balance')
						.eq('id', movement.shift_id)
						.single();

					if (shiftData) {
						const currentBalance = Number(shiftData.expected_balance) || 0;
						await supabase
							.from(TABLES.cash_shifts)
							.update({ expected_balance: currentBalance + amountChange })
							.eq('id', movement.shift_id);
					}
				} catch (err) {
					console.error('Error al actualizar saldo esperado:', err);
				}
			}
		}

		return newMovement;
	},

	getShiftMovements: async (shiftId) => {
		const { data, error } = await supabase
			.from(TABLES.cash_movements)
			.select(`*, ${TABLES.orders}(*)`)
			.eq('shift_id', shiftId)
			.order('created_at', { ascending: false });

		if (error) throw error;
		return data;
	},

	getPastShifts: async (limit = 20, branchId = null) => {
		let query = supabase
			.from(TABLES.cash_shifts)
			.select(`
				*,
				cash_movements (
					amount,
					type,
					payment_method
				)
			`)
			.eq('status', 'closed')
			.order('closed_at', { ascending: false })
			.limit(limit);

		if (branchId) query = query.eq('branch_id', branchId);

		const { data, error } = await query;
		if (error) throw error;

		return (data || []).map(shift => {
			const movements = shift.cash_movements || [];
			const totalOnline = movements
				.filter(m => m.payment_method === 'online' && m.type === 'sale')
				.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
			return { ...shift, total_online: totalOnline };
		});
	},

	getShiftById: async (shiftId) => {
		const { data, error } = await supabase
			.from(TABLES.cash_shifts)
			.select('*')
			.eq('id', shiftId)
			.maybeSingle();

		if (error) throw error;
		return data;
	}
};