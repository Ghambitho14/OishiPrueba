import { createContext, useContext, useState, useEffect } from 'react';
import { cashService } from '../features/admin/services/cashService';
import { supabase } from '../lib/supabase';

const CashContext = createContext();

export const useCash = () => {
    const context = useContext(CashContext);
    if (!context) {
        throw new Error('useCash must be used within a CashProvider');
    }
    return context;
};

export const CashProvider = ({ children }) => {
    const [activeShift, setActiveShift] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkActiveShift = async () => {
        try {
            setLoading(true);
            const shift = await cashService.getActiveShift();
            setActiveShift(shift);
        } catch (error) {
            console.error('Error fetching active shift:', error);
            setActiveShift(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkActiveShift();

        // Listen for realtime changes on cash_shifts table
        const channel = supabase
            .channel('cash_shifts_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cash_shifts' },
                (payload) => {
                    console.log('Change detected in cash_shifts, reloading shift state.', payload);
                    // Reload active shift on any change in the shifts table
                    checkActiveShift();
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    const value = {
        activeShift,
        isShiftLoading: loading,
        isShiftActive: !!activeShift,
        refreshShift: checkActiveShift,
    };

    return <CashContext.Provider value={value}>{children}</CashContext.Provider>;
};
