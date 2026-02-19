
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envConfig = fs.readFileSync('.env', 'utf-8')
    .split('\n')
    .reduce((acc, line) => {
        const [key, val] = line.split('=');
        if (key && val) acc[key.trim()] = val.trim();
        return acc;
    }, {});

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function checkShifts() {
    console.log('Checking closed shifts...');
    const { data, error } = await supabase
        .from('cash_shifts')
        .select('*')
        .eq('status', 'closed')
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Closed shifts found:', data.length);
        console.log(data);
    }
}

checkShifts();

