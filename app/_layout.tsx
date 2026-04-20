import "../global.css";
import { ThemeProvider } from "../context/ThemeContext";
import { CurrencyProvider } from "../context/CurrencyContext";
import { Stack, useRouter } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { expoDb } from '../db/client';
import { setupNotifications } from '../services/notificationService';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'onboarding_completed';

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);
    const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

    useEffect(() => {
        // Handle notification actions (Name / Ignore / Delete from transaction notifications)
        const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
            const actionId = response.actionIdentifier;
            const data = response.notification.request.content.data;
            const userText = (response as any).userText;

            if (actionId === 'NAME_ACTION' && data?.transactionId && userText) {
                try {
                    await expoDb.execAsync(`
                        UPDATE transactions 
                        SET description = '${userText.replace(/'/g, "''")}' 
                        WHERE id = ${data.transactionId}
                    `);
                    await Notifications.scheduleNotificationAsync({
                        content: { title: '✏️ Transaction Named', body: `Labeled as: ${userText}`, sound: false },
                        trigger: null,
                    });
                } catch (e) { console.error('Error handling name action:', e); }

            } else if (actionId === 'IGNORE_ACTION' && data?.transactionId) {
                try {
                    await expoDb.execAsync(`UPDATE transactions SET is_ignored = 1 WHERE id = ${data.transactionId}`);
                    const { calculateDailyBudget } = require('../services/budgetService');
                    const status = await calculateDailyBudget();
                    await Notifications.scheduleNotificationAsync({
                        content: { title: '🙈 Transaction Ignored', body: `Budget updated. Safe to spend: ${Math.round(status.dailyLimit)}`, sound: false },
                        trigger: null,
                    });
                } catch (e) { console.error('Error handling ignore action:', e); }

            } else if (actionId === 'DELETE_ACTION' && data?.transactionId) {
                try {
                    await expoDb.execAsync(`DELETE FROM transactions WHERE id = ${data.transactionId}`);
                    const { calculateDailyBudget } = require('../services/budgetService');
                    const status = await calculateDailyBudget();
                    await Notifications.scheduleNotificationAsync({
                        content: { title: '🗑️ Transaction Deleted', body: `Removed. Safe to spend: ${Math.round(status.dailyLimit)}`, sound: false },
                        trigger: null,
                    });
                } catch (e) { console.error('Error handling delete action:', e); }
            }
        });

        return () => subscription.remove();
    }, []);

    useEffect(() => {
        try {
            expoDb.execSync(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    amount REAL NOT NULL,
                    category TEXT NOT NULL,
                    description TEXT,
                    date INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    source TEXT DEFAULT 'manual'
                );
            `);
            expoDb.execSync(`
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    icon TEXT
                );
            `);
            // Migrations for columns added post-v1.0
            const migrations = [
                "ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'manual'",
                "ALTER TABLE transactions ADD COLUMN transaction_class TEXT DEFAULT 'spending'",
                "ALTER TABLE transactions ADD COLUMN linked_transaction_id INTEGER",
                "ALTER TABLE transactions ADD COLUMN raw_sms_hash TEXT",
                "ALTER TABLE transactions ADD COLUMN account TEXT",
                "ALTER TABLE transactions ADD COLUMN is_ignored INTEGER DEFAULT 0",
            ];
            for (const sql of migrations) {
                try { expoDb.execSync(sql); } catch (_) { /* column exists */ }
            }
            expoDb.execSync(`
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL UNIQUE,
                    value TEXT NOT NULL
                );
            `);
        } catch (e) { console.error("Database initialization error:", e); }

        setupNotifications();
        checkOnboarding();
        setIsReady(true);
    }, []);

    const checkOnboarding = async () => {
        try {
            const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
            setOnboardingComplete(completed === 'true');
        } catch (error) {
            console.error('Error checking onboarding:', error);
            setOnboardingComplete(false);
        }
    };

    if (!isReady || onboardingComplete === null) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-950">
                <ActivityIndicator size="large" color="#059669" />
                <Text className="text-slate-400 mt-4">Setting up SpenseTrack...</Text>
            </View>
        );
    }

    return (
        <ThemeProvider>
            <CurrencyProvider>
                <Stack screenOptions={{ headerShown: false }}>
                    {!onboardingComplete ? (
                        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    ) : (
                        <>
                            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                            <Stack.Screen name="add" options={{ headerShown: false }} />
                            <Stack.Screen name="edit-transaction" options={{ headerShown: false }} />
                            <Stack.Screen name="settings" options={{ headerShown: false }} />
                        </>
                    )}
                </Stack>
            </CurrencyProvider>
        </ThemeProvider>
    );
}
