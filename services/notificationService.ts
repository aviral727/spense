import * as Notifications from 'expo-notifications';
import { calculateDailyBudget } from './budgetService';
import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function setupNotifications() {
    if (Platform.OS === 'web') return;

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Notification permission not granted');
            return;
        }

        // Register Action Categories
        await Notifications.setNotificationCategoryAsync('new_transaction', [
            {
                identifier: 'IGNORE_ACTION',
                buttonTitle: '🙈 Ignore',
                options: {
                    isDestructive: false,
                    isAuthenticationRequired: false,
                },
            },
            {
                identifier: 'DELETE_ACTION',
                buttonTitle: '🗑️ Delete',
                options: {
                    isDestructive: true,
                    isAuthenticationRequired: false,
                },
            },
        ]);

        console.log('Notification permissions granted & categories registered');
    } catch (error) {
        console.error('Error setting up notifications:', error);
    }
}

export async function checkBudgetAlerts(lastTransactionAmount?: number, lastTransactionId?: number) {
    try {
        const status = await calculateDailyBudget();
        if (!status) return;

        const now = new Date();
        const todayKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`; // YYYY-M

        // === BALANCE UPDATE (Post-Transaction) ===
        if (lastTransactionAmount && lastTransactionAmount > 0) {
            const safeToSpend = Math.max(0, status.dailyLimit);

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '💸 Transaction Recorded',
                    body: `Spent: ${lastTransactionAmount}. Safe to spend today: ${Math.round(status.dailyLimit)}`,
                    sound: true,
                    data: { transactionId: lastTransactionId },
                    categoryIdentifier: 'new_transaction',
                    badge: 1, // Optional visual cue
                },
                trigger: null,
            });
        }

        // === DAILY CHECKS ===
        await checkThreshold(
            status.spentToday,
            status.dailyLimit,
            `daily_90_${todayKey}`,
            '⚠️ Daily Spending Alert',
            `You've used ${Math.round((status.spentToday / status.dailyLimit) * 100)}% of your daily budget.`
        );

        // === MONTHLY CHECKS ===
        await checkThreshold(
            status.spentTotal,
            status.monthlyLimit,
            `monthly_90_${monthKey}`,
            '⚠️ Monthly Budget Alert',
            `You've used ${Math.round((status.spentTotal / status.monthlyLimit) * 100)}% of your monthly budget.`
        );

    } catch (error) {
        console.error('Error checking budget alerts:', error);
    }
}

async function checkThreshold(spent: number, limit: number, alertKey: string, title: string, body: string) {
    if (limit <= 0) return;

    const percentage = spent / limit;

    if (percentage >= 0.9) {
        // Check if we've already sent this alert
        const existingAlert = await db.select().from(settings).where(eq(settings.key, `alert_${alertKey}`));

        if (existingAlert.length === 0) {
            // Send notification
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: true,
                },
                trigger: null, // Send immediately
            });

            // Mark as sent
            await db.insert(settings).values({
                key: `alert_${alertKey}`,
                value: 'sent'
            });
            console.log(`Sent alert: ${alertKey}`);
        }
    }
}
