import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';

interface CurrencyContextType {
    currency: string;
    setCurrency: (symbol: string) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType>({
    currency: '₹',
    setCurrency: async () => { },
});

export const useCurrency = () => useContext(CurrencyContext);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrencyState] = useState('₹');

    useEffect(() => {
        loadCurrency();
    }, []);

    const loadCurrency = async () => {
        try {
            const result = await db.select().from(settings).where(eq(settings.key, 'currency'));
            if (result.length > 0) {
                setCurrencyState(result[0].value);
            }
        } catch (error) {
            console.error('Error loading currency:', error);
        }
    };

    const setCurrency = async (symbol: string) => {
        try {
            const existing = await db.select().from(settings).where(eq(settings.key, 'currency'));
            if (existing.length > 0) {
                await db.update(settings).set({ value: symbol }).where(eq(settings.key, 'currency'));
            } else {
                await db.insert(settings).values({ key: 'currency', value: symbol });
            }
            setCurrencyState(symbol);
        } catch (error) {
            console.error('Error saving currency:', error);
            throw error;
        }
    };

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency }}>
            {children}
        </CurrencyContext.Provider>
    );
}
