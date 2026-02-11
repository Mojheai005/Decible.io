'use client';

import { useState, useEffect } from 'react';
import type { Currency } from '@/lib/pricing';

const CACHE_KEY = 'decible_currency';

export function useCurrency(): Currency {
    const [currency, setCurrency] = useState<Currency>('INR');

    useEffect(() => {
        // Check sessionStorage cache first
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached === 'INR' || cached === 'USD') {
            setCurrency(cached);
            return;
        }

        // Fetch from geo API
        fetch('/api/geo')
            .then(res => res.json())
            .then(data => {
                const cur: Currency = data.country === 'IN' ? 'INR' : 'USD';
                setCurrency(cur);
                sessionStorage.setItem(CACHE_KEY, cur);
            })
            .catch(() => {
                // Default to INR on error
                setCurrency('INR');
            });
    }, []);

    return currency;
}
