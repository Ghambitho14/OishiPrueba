import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

export const useCashSystem = (showNotify, branchId) => {
    const [activeShift, setActiveShift] = useState(null);
    const [loading, setLoading] = useState(true);
    const [movements, setMovements] = useState([]);
    const [loadingMovements, setLoadingMovements] = useState(false);

    /**
     * Carga los movimientos de un turno específico
     */
    const loadMovements = useCallback(async (shiftId) => {
        setLoadingMovements(true);
        try {
            const { data, error } = await supabase
                .from('cash_movements')
                .select('*, orders(*)')
                .eq('shift_id', shiftId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            console.log('Movimientos cargados:', data);
            setMovements(data || []);
        } catch (error) {
            console.error('Error loading movements:', error);
            setMovements([]);
        } finally {
            setLoadingMovements(false);
        }
    }, []);

    /**
     * Carga el turno activo para la sucursal seleccionada
     */
    const loadActiveShift = useCallback(async () => {
        if (!branchId || branchId === 'all') {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data: shift, error } = await supabase
                .from('cash_shifts')
                .select('*, cash_movements(count)')
                .eq('status', 'open')
                .eq('branch_id', branchId) // FILTRO CRÍTICO POR SUCURSAL
                .maybeSingle();

            if (error) throw error;

            // Solo actualizar si el ID cambió para evitar bucles si el objeto es nuevo pero el contenido igual
            setActiveShift(prev => (prev?.id === shift?.id ? prev : shift));
            
            if (shift) {
                loadMovements(shift.id);
            } else {
                setMovements([]);
            }
        } catch (error) {
            console.error('Error loading active shift:', error);
            if (showNotify) showNotify('Error al cargar datos de caja', 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotify, loadMovements, branchId]);

    useEffect(() => {
        loadActiveShift();
    }, [loadActiveShift]);

    /**
     * Listener Realtime para actualizar movimientos cuando se agreguen nuevos
     */
    useEffect(() => {
        if (!activeShift) return;

        // Subscribe a cambios en cash_movements para este shift
        const channel = supabase
            .channel(`cash_movements:shift_id=eq.${activeShift.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Escuchar INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'cash_movements',
                    filter: `shift_id=eq.${activeShift.id}`
                },
                (payload) => {
                    console.log('Cambio en cash_movements:', payload);
                    if (payload.eventType === 'INSERT') {
                        // Agregar el movimiento nuevo al inicio
                        setMovements(prev => [payload.new, ...prev]);
                    } else if (payload.eventType === 'DELETE') {
                        // Remover si se borra
                        setMovements(prev => prev.filter(m => m.id !== payload.old.id));
                    } else if (payload.eventType === 'UPDATE') {
                        // Actualizar si cambia
                        setMovements(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [activeShift?.id]); // Depender solo del ID es más seguro

    /**
     * Abre un nuevo turno
     */
    const openShift = useCallback(async (amount) => {
        if (!branchId || branchId === 'all') {
            if (showNotify) showNotify('Error: No se ha detectado la sucursal seleccionada.', 'error');
            return false;
        }
        try {
            // Verificar si ya existe una caja abierta en esta sucursal
            const { data: existing } = await supabase
                .from('cash_shifts')
                .select('id')
                .eq('status', 'open')
                .eq('branch_id', branchId)
                .maybeSingle();

            if (existing) throw new Error("Ya existe una caja abierta en esta sucursal.");

            const { data: { user } } = await supabase.auth.getUser();
            
            const { data: newShift, error } = await supabase
                .from('cash_shifts')
                .insert({
                    opening_balance: amount,
                    expected_balance: amount,
                    opened_by: user?.id,
                    status: 'open',
                    branch_id: branchId // ASIGNACIÓN DE SUCURSAL
                })
                .select()
                .single();

            if (error) throw error;

            setActiveShift(newShift);
            setMovements([]);
            if (showNotify) showNotify('Caja abierta con éxito');
            return true;
        } catch (error) {
            console.error('Error opening shift:', error);
            if (showNotify) {
                const msg = error.message.includes('Ya existe') ? error.message : 'Error al abrir caja';
                showNotify(msg, 'error');
            }
            return false;
        }
    }, [branchId, showNotify]);

    /**
     * Cierra el turno actual
     */
    const closeShift = useCallback(async (actualBalance) => {
        if (!activeShift) return false;
        try {
            const { error } = await supabase
                .from('cash_shifts')
                .update({
                    actual_balance: actualBalance,
                    closed_at: new Date().toISOString(),
                    status: 'closed'
                })
                .eq('id', activeShift.id)
                .eq('status', 'open');

            if (error) throw error;

            setActiveShift(null);
            setMovements([]);
            if (showNotify) showNotify('Caja cerrada correctamente');
            return true;
        } catch (error) {
            console.error('Error closing shift:', error);
            if (showNotify) showNotify('Error al cerrar caja', 'error');
            return false;
        }
    }, [activeShift, showNotify]);

    /**
     * Agrega un movimiento manual (Ingreso/Egreso)
     */
    const addManualMovement = useCallback(async (type, amount, description, paymentMethod = 'cash') => {
        if (!activeShift) return false;
        try {
            const movement = {
                shift_id: activeShift.id,
                type,
                amount,
                description,
                payment_method: paymentMethod,
                company_id: activeShift.company_id // Opcional
            };
            
            const { error } = await supabase.from('cash_movements').insert(movement);
            if (error) throw error;

            // Actualizar expected_balance si es efectivo
            if (paymentMethod === 'cash') {
                const adjustment = type === 'expense' ? -amount : amount;
                
                // Intentamos usar RPC si existe, sino update manual
                const { error: rpcError } = await supabase.rpc('increment_expected_balance', { 
                    shift_id: activeShift.id, 
                    amount: adjustment 
                });

                if (rpcError) {
                    // Fallback manual
                    const { data: current } = await supabase.from('cash_shifts').select('expected_balance').eq('id', activeShift.id).single();
                    if (current) {
                        await supabase.from('cash_shifts')
                            .update({ expected_balance: (current.expected_balance || 0) + adjustment })
                            .eq('id', activeShift.id);
                    }
                }
            }
            
            await loadActiveShift();
            if (showNotify) showNotify(type === 'income' ? 'Ingreso registrado' : 'Egreso registrado');
            return true;
        } catch (error) {
            console.error('Error adding movement:', error);
            if (showNotify) showNotify('Error al registrar movimiento', 'error');
            return false;
        }
    }, [activeShift, showNotify, loadActiveShift]);

    /**
     * Registra una venta automáticamente
     */
    const registerSale = useCallback(async (order) => {
        if (!activeShift) return;
        try {
            const { data: existing } = await supabase
                .from('cash_movements')
                .select('id')
                .eq('shift_id', activeShift.id)
                .eq('order_id', order.id)
                .maybeSingle();

            if (existing) {
                console.log('Orden ya registrada en caja:', order.id);
                return; 
            }

            const movement = {
                shift_id: activeShift.id,
                type: 'sale',
                amount: order.total,
                description: `Venta #${String(order.id).slice(-4)} - ${order.client_name}`,
                payment_method: order.payment_type === 'online' ? 'online' : (order.payment_type === 'tarjeta' ? 'card' : 'cash'),
                order_id: order.id
            };
            
            const { error } = await supabase.from('cash_movements').insert(movement);
            if (error) throw error;

            // Actualizar balance si es efectivo
            if (movement.payment_method === 'cash') {
                 const { data: current } = await supabase.from('cash_shifts').select('expected_balance').eq('id', activeShift.id).single();
                 if (current) {
                     await supabase.from('cash_shifts')
                         .update({ expected_balance: (current.expected_balance || 0) + movement.amount })
                         .eq('id', activeShift.id);
                 }
            }

            await loadActiveShift();
        } catch (error) {
            console.error('Error registering sale in cash system:', error);
        }
    }, [activeShift, loadActiveShift]);

    /**
     * Registra una devolución
     */
    const registerRefund = useCallback(async (order) => {
        if (!activeShift) return;
        try {
            const { data: existing } = await supabase
                .from('cash_movements')
                .select('id, type')
                .eq('shift_id', activeShift.id)
                .eq('order_id', order.id)
                .eq('type', 'expense');

            if (existing && existing.length > 0) return;

            const movement = {
                shift_id: activeShift.id,
                type: 'expense',
                amount: order.total || 0,
                description: `Devolución #${String(order.id).slice(-4)} - ${order.client_name}`,
                payment_method: order.payment_type === 'online' ? 'online' : (order.payment_type === 'tarjeta' ? 'card' : 'cash'),
                order_id: order.id
            };

            const { error } = await supabase.from('cash_movements').insert(movement);
            if (error) throw error;

            if (movement.payment_method === 'cash') {
                 const { data: current } = await supabase.from('cash_shifts').select('expected_balance').eq('id', activeShift.id).single();
                 if (current) {
                     await supabase.from('cash_shifts')
                         .update({ expected_balance: (current.expected_balance || 0) - movement.amount })
                         .eq('id', activeShift.id);
                 }
            }

            await loadActiveShift();
            if (showNotify) showNotify('Devolución registrada en caja', 'success');
        } catch (error) {
            console.error('Error registrando devolución en caja:', error);
            if (showNotify) showNotify('Error registrando devolución', 'error');
        }
    }, [activeShift, showNotify, loadActiveShift]);

    const getPastShifts = useCallback(async (limit = 20) => {
        if (!branchId) return [];
        const { data, error } = await supabase
            .from('cash_shifts')
            .select('*')
            .eq('status', 'closed')
            .eq('branch_id', branchId) // FILTRO POR SUCURSAL
            .order('closed_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    }, [branchId]);

    const getShiftMovements = useCallback(async (shiftId) => {
        const { data, error } = await supabase
            .from('cash_movements')
            .select('*, orders(*)')
            .eq('shift_id', shiftId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }, []);

    const getTotals = useCallback((movementsData = movements) => {
        return movementsData.reduce((acc, m) => {
            const amount = Number(m.amount) || 0;
            if (m.type === 'expense') {
                acc.expenses += amount;
            } else {
                if (m.payment_method === 'cash') acc.cash += amount;
                else if (m.payment_method === 'card') acc.card += amount;
                else if (m.payment_method === 'online') acc.online += amount;
                acc.income += amount;
            }
            return acc;
        }, { cash: 0, card: 0, online: 0, expenses: 0, income: 0 });
    }, [movements]);

    // Memoizar el objeto de retorno para evitar re-renderizados infinitos en consumidores
    return useMemo(() => ({
        activeShift,
        loading,
        movements,
        loadingMovements,
        openShift,
        closeShift,
        addManualMovement,
        registerSale,
        registerRefund,
        refresh: loadActiveShift,
        getPastShifts,
        getShiftMovements,
        getTotals
    }), [
        activeShift, loading, movements, loadingMovements,
        openShift, closeShift, addManualMovement, registerSale, registerRefund,
        loadActiveShift, getPastShifts, getShiftMovements, getTotals
    ]);
};
