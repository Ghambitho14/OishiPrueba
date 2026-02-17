import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const BusinessContext = createContext();

export const BusinessProvider = ({ children }) => {
    const [businessInfo, setBusinessInfo] = useState({
        name: 'Oishi Sushi',
        phone: '+56900000000',
        instagram: '@oishi.sushi',
        address: '',
        schedule: '',
        bank_details: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBusinessInfo();
        
        // Suscribirse a cambios en tiempo real
        const subscription = supabase
            .channel('business_info_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'business_info' }, () => {
                fetchBusinessInfo();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchBusinessInfo = async () => {
        try {
            const { data } = await supabase
                .from('business_info')
                .select('*')
                .limit(1)
                .single();
            
            if (data) {
                setBusinessInfo(prev => ({ ...prev, ...data }));
                // Actualizar título si cambia
                if (data.name) document.title = data.name;
            }
        } catch (err) {
            console.error('Error fetching business info', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <BusinessContext.Provider value={{ businessInfo, loading, refreshBusinessInfo: fetchBusinessInfo }}>
            {children}
        </BusinessContext.Provider>
    );
};

export const useBusiness = () => useContext(BusinessContext);
