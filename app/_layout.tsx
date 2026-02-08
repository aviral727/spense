import "../global.css";
import { ThemeProvider } from "../context/ThemeContext";
import { CurrencyProvider } from "../context/CurrencyContext";
import { Stack, useRouter, useSegments } from "expo-router";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { useEffect, useState } from "react";
import { expoDb } from '../db/client';
import { initializeSmsListener } from '../services/autoSync';
import { setupNotifications } from '../services/notificationService';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'onboarding_completed';

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);
    const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

    useEffect(() => {
        // Handle notification actions
        const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
            const actionId = response.actionIdentifier;
            const data = response.notification.request.content.data;

            if (actionId === 'IGNORE_ACTION' && data?.transactionId) {
                try {
                    // Update DB to ignore
                    await expoDb.execAsync(`
                        UPDATE transactions 
                        SET is_ignored = 1 
                        WHERE id = ${data.transactionId}
                    `);

                    // Recalculate and notify
                    const { calculateDailyBudget } = require('../services/budgetService');
                    const status = await calculateDailyBudget();

                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: 'Transaction Ignored',
                            body: `Budget updated. Safe to spend: ${Math.round(status.dailyLimit)}`,
                            sound: false,
                        },
                        trigger: null,
                    });
                } catch (e) {
                    console.error('Error handling ignore action:', e);
                }
            } else if (actionId === 'DELETE_ACTION' && data?.transactionId) {
                try {
                    // Delete from DB
                    await expoDb.execAsync(`
                        DELETE FROM transactions 
                        WHERE id = ${data.transactionId}
                    `);

                    // Recalculate and notify
                    const { calculateDailyBudget } = require('../services/budgetService');
                    const status = await calculateDailyBudget();

                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: 'Transaction Deleted',
                            body: `Removed from records. Safe to spend: ${Math.round(status.dailyLimit)}`,
                            sound: false,
                        },
                        trigger: null,
                    });
                } catch (e) {
                    console.error('Error handling delete action:', e);
                }
            }
        });

        return () => subscription.remove();
    }, []);

    useEffect(() => {
        // Initialize database tables
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
            console.log("Database initialized");

            // Migration check for existing databases that might lack 'source'
            try {
                expoDb.execSync("ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'manual'");
                console.log("Migration: Added source column to transactions");
            } catch (e) {
                // Column likely exists
            }

            // Migration for Transaction Intelligence fields
            try {
                expoDb.execSync("ALTER TABLE transactions ADD COLUMN transaction_class TEXT DEFAULT 'spending'");
                console.log("Migration: Added transaction_class column");
            } catch (e) { /* Column exists */ }

            try {
                expoDb.execSync("ALTER TABLE transactions ADD COLUMN linked_transaction_id INTEGER");
                console.log("Migration: Added linked_transaction_id column");
            } catch (e) { /* Column exists */ }

            try {
                expoDb.execSync("ALTER TABLE transactions ADD COLUMN raw_sms_hash TEXT");
                console.log("Migration: Added raw_sms_hash column");
            } catch (e) { /* Column exists */ }

            try {
                expoDb.execSync("ALTER TABLE transactions ADD COLUMN account TEXT");
                console.log("Migration: Added account column");
            } catch (e) { /* Column exists */ }

            try {
                expoDb.execSync("ALTER TABLE transactions ADD COLUMN is_ignored INTEGER DEFAULT 0");
                console.log("Migration: Added is_ignored column");
            } catch (e) { /* Column exists */ }

            // Initialize Settings table
            expoDb.execSync(`
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL UNIQUE,
                    value TEXT NOT NULL
                );
            `);
        } catch (e) {
            console.error("Database initialization error:", e);
        }

        // Setup Notifications
        setupNotifications();

        // Check if onboarding is complete and initialize SMS listener if so
        checkOnboarding();

        // Set ready
        setIsReady(true);
    }, []);

    const checkOnboarding = async () => {
        try {
            const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
            setOnboardingComplete(completed === 'true');

            // Only initialize SMS listener if onboarding is already complete
            if (completed === 'true' && Platform.OS === 'android') {
                initializeSmsListener().catch(err => {
                    console.log('SMS listener initialization:', err);
                });
            }
        } catch (error) {
            console.error('Error checking onboarding:', error);
            setOnboardingComplete(false);
        }
    };

    if (!isReady || onboardingComplete === null) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#059669" />
                <Text className="text-gray-600 mt-4">Setting up database...</Text>
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
                            <Stack.Screen name="auto-import" options={{ title: "Auto Import", headerShown: false }} />
                            <Stack.Screen name="add" options={{ title: "Add Transaction", headerShown: false }} />
                            <Stack.Screen name="settings" options={{ title: "Settings", headerShown: false }} />
                        </>
                    )}
                </Stack>
            </CurrencyProvider>
        </ThemeProvider>
    );
}
