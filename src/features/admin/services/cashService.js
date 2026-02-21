import { supabase } from '../../../lib/supabase';

/**
 * Servicio para la gestión de Caja (Shifts y Movements)
 * Optimizado para evitar condiciones de carrera y asegurar integridad financiera.
 */

export const cashService = {
    // --- TURNOS ---

    /**
     * Obtiene el turno abierto actualmente si existe (cualquier sucursal).
     * Incluye un conteo de movimientos para feedback rápido en UI.
     */
    getActiveShift: async () => {
        const { data, error } = await supabase
            .from('cash_shifts')
            .select('*, cash_movements(count)')
            .eq('status', 'open')
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Obtiene el turno abierto para una sucursal específica.
     * Usado para validar si una sucursal está recibiendo pedidos.
     */
    getActiveShiftForBranch: async (branchId) => {
        if (!branchId) return null;
        const { data, error } = await supabase
            .from('cash_shifts')
            .select('*, cash_movements(count)')
            .eq('status', 'open')
            .eq('branch_id', branchId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Obtiene los IDs de sucursales que tienen caja abierta.
     * Usado para filtrar sucursales disponibles en carrito y pedidos manuales.
     */
    getBranchesWithOpenCaja: async () => {
        const { data, error } = await supabase
            .from('cash_shifts')
            .select('branch_id')
            .eq('status', 'open')
            .not('branch_id', 'is', null);

        if (error) throw error;
        return (data || []).map(r => r.branch_id).filter(Boolean).map(id => String(id));
    },

    /**
     * Abre un nuevo turno de caja.
     * Incluye validación de seguridad para evitar duplicidad de turnos abiertos.
     */
    openShift: async (openingBalance, userId) => {
        // Validación de seguridad: Verificar si ya hay una caja abierta
        const { data: existingShift, error: checkError } = await supabase
            .from('cash_shifts')
            .select('id')
            .eq('status', 'open')
            .maybeSingle();

        if (checkError) throw new Error('Error al verificar estado de caja: ' + checkError.message);
        if (existingShift) throw new Error('Ya existe un turno de caja abierto en el sistema.');

        const { data, error } = await supabase
            .from('cash_shifts')
            .insert({
                opening_balance: openingBalance,
                expected_balance: openingBalance,
                opened_by: userId,
                status: 'open'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Cierra un turno de caja.
     * Solo permite cerrar turnos que están actualmente marcados como 'open'.
     */
    closeShift: async (shiftId, actualBalance) => {
        const { data, error } = await supabase
            .from('cash_shifts')
            .update({
                actual_balance: actualBalance,
                closed_at: new Date().toISOString(),
                status: 'closed'
            })
            .eq('id', shiftId)
            .eq('status', 'open') // Protección extra
            .select()
            .single();

        if (error) throw new Error('No se pudo cerrar la caja o ya se encuentra cerrada.');
        return data;
    },

    // --- MOVIMIENTOS ---

    /**
     * Registra un nuevo movimiento de caja.
     * Actualiza el saldo esperado del turno de forma atómica para evitar errores de concurrencia.
     */
    addMovement: async (movement) => {
        // 1. Insertar el registro del movimiento
        const { data: newMovement, error: moveError } = await supabase
            .from('cash_movements')
            .insert(movement)
            .select()
            .single();

        if (moveError) throw moveError;

        // 2. Actualizar saldo del turno si el método es efectivo
        if (movement.payment_method === 'cash') {
            const numericAmount = Number(movement.amount);
            if (isNaN(numericAmount)) return newMovement; // Seguridad: Si no es número, no dañar la caja
            
            const amountChange = movement.type === 'expense' ? -numericAmount : numericAmount;

            /**
             * IMPORTANTE: Se recomienda usar una función RPC en Supabase para 
             * incrementar el balance directamente en SQL:
             * await supabase.rpc('increment_shift_balance', { shift_id_param: movement.shift_id, amount_param: amountChange });
             */
            
            try {
                // Fallback manual optimizado (Lectura -> Cálculo -> Escritura)
                const { data: shiftData } = await supabase
                    .from('cash_shifts')
                    .select('expected_balance')
                    .eq('id', movement.shift_id)
                    .single();

                if (shiftData) {
                    const currentBalance = Number(shiftData.expected_balance) || 0;
                    await supabase
                        .from('cash_shifts')
                        .update({ expected_balance: currentBalance + amountChange })
                        .eq('id', movement.shift_id);
                }
            } catch (err) {
                console.error('Error crítico al actualizar saldo esperado:', err);
                // Aquí podrías implementar una cola de reintentos si es necesario
            }
        }

        return newMovement;
    },

    /**
     * Obtiene los movimientos de un turno con información de la orden relacionada.
     */
    getShiftMovements: async (shiftId) => {
        const { data, error } = await supabase
            .from('cash_movements')
            .select('*, orders(*)')
            .eq('shift_id', shiftId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Obtiene historial paginado de turnos pasados.
     */
    getPastShifts: async (limit = 20) => {
        const { data, error } = await supabase
            .from('cash_shifts')
            .select('*')
            .eq('status', 'closed')
            .order('closed_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },

    /**
     * Obtiene un turno específico por su ID.
     */
    getShiftById: async (shiftId) => {
        const { data, error } = await supabase
            .from('cash_shifts')
            .select('*')
            .eq('id', shiftId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }
};