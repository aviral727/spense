import { db } from '../db/client';
import { settings, transactions } from '../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { NativeModules, Platform } from 'react-native';

/**
 * Pushes current budget data into native SharedPreferences so the
 * Android home-screen widget can display live figures.
 * Safe to call on iOS (no-ops silently).
 *
 * @param status   The full BudgetStatus returned by calculateDailyBudget()
 * @param currency The currency symbol from CurrencyContext (e.g. "₹")
 */
export async function syncWidgetData(
    status: {
        dailyLimit: number;
        remainingTotal: number;
        daysLeft: number;
        isOverBudget: boolean;
    },
    currency: string
): Promise<void> {
    if (Platform.OS !== 'android') return;
    const { WidgetDataModule } = NativeModules;
    if (!WidgetDataModule) return; // native build not present (e.g. Expo Go)
    try {
        await WidgetDataModule.updateWidgetData(
            status.dailyLimit,
            status.remainingTotal,
            status.daysLeft,
            currency,
            status.isOverBudget
        );
    } catch (e) {
        console.log('[syncWidgetData] Widget update skipped:', e);
    }
}

interface BudgetSettings {
    monthlyLimit: number; // e.g., 30000
    startDay: number; // e.g., 25 (means 25th of month)
    budgetMode: 'dynamic' | 'fixed';
}

interface BudgetStatus {
    dailyLimit: number;
    remainingTotal: number;
    spentTotal: number; // This is monthly spend
    spentToday: number;
    monthlyLimit: number;
    daysLeft: number;
    periodStart: Date;
    periodEnd: Date;
    isOverBudget: boolean;
    budgetMode: 'dynamic' | 'fixed';
}

const DEFAULT_SETTINGS: BudgetSettings = {
    monthlyLimit: 0,
    startDay: 1,
    budgetMode: 'dynamic'
};

export async function getBudgetSettings(): Promise<BudgetSettings> {
    try {
        const result = await db.select().from(settings);
        const config = { ...DEFAULT_SETTINGS };

        result.forEach(row => {
            if (row.key === 'monthly_budget') config.monthlyLimit = parseFloat(row.value);
            if (row.key === 'start_day') config.startDay = parseInt(row.value, 10);
            if (row.key === 'budget_mode') config.budgetMode = row.value as 'dynamic' | 'fixed';
        });

        return config;
    } catch (error) {
        console.error('Error fetching budget settings:', error);
        return DEFAULT_SETTINGS;
    }
}

export async function updateBudgetSettings(limit: number, startDay: number, mode: 'dynamic' | 'fixed' = 'dynamic'): Promise<void> {
    try {
        // Upsert budget limit
        const limitExists = await db.select().from(settings).where(eq(settings.key, 'monthly_budget'));
        if (limitExists.length > 0) {
            await db.update(settings).set({ value: limit.toString() }).where(eq(settings.key, 'monthly_budget'));
        } else {
            await db.insert(settings).values({ key: 'monthly_budget', value: limit.toString() });
        }

        // Upsert start day
        const dayExists = await db.select().from(settings).where(eq(settings.key, 'start_day'));
        if (dayExists.length > 0) {
            await db.update(settings).set({ value: startDay.toString() }).where(eq(settings.key, 'start_day'));
        } else {
            await db.insert(settings).values({ key: 'start_day', value: startDay.toString() });
        }

        // Upsert budget mode
        const modeExists = await db.select().from(settings).where(eq(settings.key, 'budget_mode'));
        if (modeExists.length > 0) {
            await db.update(settings).set({ value: mode }).where(eq(settings.key, 'budget_mode'));
        } else {
            await db.insert(settings).values({ key: 'budget_mode', value: mode });
        }
    } catch (error) {
        console.error('Error updating budget settings:', error);
        throw error;
    }
}

export function getCurrentPeriod(startDay: number): { start: Date; end: Date } {
    const now = new Date();
    const currentDay = now.getDate();
    let start = new Date();
    let end = new Date();

    if (currentDay >= startDay) {
        // We are in the current month's cycle
        start = new Date(now.getFullYear(), now.getMonth(), startDay);
        // End is day BEFORE start day of next month
        end = new Date(now.getFullYear(), now.getMonth() + 1, startDay - 1);
    } else {
        // We are in the previous month's cycle (e.g. today is 5th, start is 25th)
        start = new Date(now.getFullYear(), now.getMonth() - 1, startDay);
        end = new Date(now.getFullYear(), now.getMonth(), startDay - 1);
    }

    // Set times to start/end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

export async function calculateDailyBudget(): Promise<BudgetStatus> {
    const settings = await getBudgetSettings();
    if (settings.monthlyLimit === 0) {
        return {
            dailyLimit: 0,
            remainingTotal: 0,
            spentTotal: 0,
            spentToday: 0,
            monthlyLimit: 0,
            daysLeft: 0,
            periodStart: new Date(),
            periodEnd: new Date(),
            isOverBudget: false,
            budgetMode: settings.budgetMode
        };
    }

    const { start, end } = getCurrentPeriod(settings.startDay);

    // Get total spent in this period
    const allTx = await db.select().from(transactions);

    // Filter for current period
    const periodTx = allTx.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end && !t.isIgnored;
    });

    const expenses = periodTx
        .filter(t => t.transactionClass === 'spending' || (!t.transactionClass && t.type === 'expense'))
        .reduce((sum, t) => sum + t.amount, 0);

    const refunds = periodTx
        .filter(t => t.transactionClass === 'refund')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalSpent = Math.max(0, expenses - refunds);
    const remainingTotal = settings.monthlyLimit - totalSpent;

    // Filter for Today's spending
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // We can reuse allTx or query efficiently, but filter is fine for local size
    const todayTx = allTx.filter(t => {
        const d = new Date(t.date);
        return d >= todayStart && d <= todayEnd && !t.isIgnored;
    });

    const todayExpenses = todayTx
        .filter(t => t.transactionClass === 'spending' || (!t.transactionClass && t.type === 'expense'))
        .reduce((sum, t) => sum + t.amount, 0);

    const todayRefunds = todayTx
        .filter(t => t.transactionClass === 'refund')
        .reduce((sum, t) => sum + t.amount, 0);

    const spentToday = Math.max(0, todayExpenses - todayRefunds);

    // Calculate days remaining (including today)
    now.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(end.getTime() - now.getTime());
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include current partial day logic if needed, or simply days until end

    // Safe to spend today logic
    let dailyLimit = 0;

    if (settings.budgetMode === 'fixed') {
        // FIXED MODE: Strict daily allowance
        // Daily Limit = (Monthly Limit) / (Total Days in Period)
        const totalPeriodTime = Math.abs(end.getTime() - start.getTime());
        const totalDaysInPeriod = Math.ceil(totalPeriodTime / (1000 * 60 * 60 * 24)) + 1;
        const baseDailyAllowance = settings.monthlyLimit / Math.max(1, totalDaysInPeriod);

        // In fixed mode, "dailyLimit" returned to UI is "Remaining for Today"
        dailyLimit = baseDailyAllowance - spentToday;
    } else {
        // DYNAMIC MODE: Recalculates based on remaining funds
        // If remaining < 0, daily is 0 (or negative to show debt)
        dailyLimit = remainingTotal / Math.max(1, daysLeft);
    }

    return {
        dailyLimit,
        remainingTotal,
        spentTotal: totalSpent,
        spentToday,
        monthlyLimit: settings.monthlyLimit,
        daysLeft,
        periodStart: start,
        periodEnd: end,
        isOverBudget: remainingTotal < 0,
        budgetMode: settings.budgetMode
    };
}
