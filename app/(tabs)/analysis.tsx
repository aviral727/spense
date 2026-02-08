import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useCurrency } from '../../context/CurrencyContext';
import { db } from '../../db/client';
import { transactions } from '../../db/schema';

type TimePeriod = 'week' | 'month' | 'all';

interface CategoryBreakdown {
    category: string;
    icon: string;
    total: number;
    percentage: number;
    count: number;
    color: string;
}

interface MerchantBreakdown {
    merchant: string;
    total: number;
    count: number;
}

interface DailySpending {
    date: string;
    day: string;
    total: number;
    maxTotal: number;
}

// Color palette for categories
const CATEGORY_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

export default function Analysis() {
    const router = useRouter();
    const { theme } = useTheme();
    const { currency } = useCurrency();
    const [period, setPeriod] = useState<TimePeriod>('month');
    const [totalIncome, setTotalIncome] = useState(0);
    const [totalExpense, setTotalExpense] = useState(0);
    const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
    const [topMerchants, setTopMerchants] = useState<MerchantBreakdown[]>([]);
    const [dailySpending, setDailySpending] = useState<DailySpending[]>([]);
    const [loading, setLoading] = useState(true);
    const [avgDailySpend, setAvgDailySpend] = useState(0);

    useEffect(() => {
        loadAnalysis();
    }, [period]);

    const getDateFilter = () => {
        const now = Date.now();
        switch (period) {
            case 'week':
                return now - (7 * 24 * 60 * 60 * 1000);
            case 'month':
                return now - (30 * 24 * 60 * 60 * 1000);
            case 'all':
                return 0;
        }
    };

    const loadAnalysis = async () => {
        setLoading(true);
        try {
            const minDate = getDateFilter();
            const allTransactions = await db.select().from(transactions);
            const filteredTransactions = allTransactions.filter(t => t.date >= minDate);

            // Salary
            const salaryTransactions = filteredTransactions.filter((t: any) =>
                t.transactionClass === 'salary'
            );
            const salary = salaryTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);

            // Real spending
            const spendingTransactions = filteredTransactions.filter((t: any) =>
                t.transactionClass === 'spending' || (!t.transactionClass && t.type === 'expense')
            );
            const expenses = spendingTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);

            // Refunds
            const refunds = filteredTransactions
                .filter((t: any) => t.transactionClass === 'refund')
                .reduce((sum: number, t: any) => sum + t.amount, 0);

            setTotalIncome(salary);
            setTotalExpense(Math.max(0, expenses - refunds));

            // === CATEGORY BREAKDOWN ===
            const categoryMap = new Map<string, { total: number; count: number }>();
            spendingTransactions.forEach((t: any) => {
                const existing = categoryMap.get(t.category) || { total: 0, count: 0 };
                categoryMap.set(t.category, {
                    total: existing.total + t.amount,
                    count: existing.count + 1,
                });
            });

            // Load category icons
            const { categories } = await import('../../db/schema');
            const categoryList = await db.select().from(categories);
            const categoryIconMap = new Map(categoryList.map(c => [c.name, c.icon || '📦']));

            const breakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
                .map(([category, data], index) => ({
                    category,
                    icon: categoryIconMap.get(category) || '📦',
                    total: data.total,
                    count: data.count,
                    percentage: expenses > 0 ? (data.total / expenses) * 100 : 0,
                    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                }))
                .sort((a, b) => b.total - a.total);

            setCategoryBreakdown(breakdown);

            // === TOP MERCHANTS ===
            const merchantMap = new Map<string, { total: number; count: number }>();
            spendingTransactions.forEach((t: any) => {
                const merchant = t.description || 'Unknown';
                const existing = merchantMap.get(merchant) || { total: 0, count: 0 };
                merchantMap.set(merchant, {
                    total: existing.total + t.amount,
                    count: existing.count + 1,
                });
            });

            const merchants: MerchantBreakdown[] = Array.from(merchantMap.entries())
                .map(([merchant, data]) => ({
                    merchant,
                    total: data.total,
                    count: data.count,
                    percentage: 0, // Not used here
                    color: '',
                }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 5); // Top 5

            setTopMerchants(merchants);

            // === DAILY SPENDING (last 7 days) ===
            const dailyMap = new Map<string, number>();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            // Initialize last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                const key = date.toISOString().split('T')[0];
                dailyMap.set(key, 0);
            }

            // Sum spending per day
            spendingTransactions.forEach((t: any) => {
                const date = new Date(t.date).toISOString().split('T')[0];
                if (dailyMap.has(date)) {
                    dailyMap.set(date, (dailyMap.get(date) || 0) + t.amount);
                }
            });

            const maxDaily = Math.max(...Array.from(dailyMap.values()), 1);
            const dailyData: DailySpending[] = Array.from(dailyMap.entries()).map(([date, total]) => {
                const d = new Date(date);
                return {
                    date,
                    day: days[d.getDay()],
                    total,
                    maxTotal: maxDaily,
                };
            });

            setDailySpending(dailyData);

            // Average daily spend
            const totalDays = period === 'week' ? 7 : period === 'month' ? 30 : Math.max(1, Math.ceil((Date.now() - minDate) / (24 * 60 * 60 * 1000)));
            setAvgDailySpend(expenses / totalDays);

        } catch (error) {
            console.error('Error loading analysis:', error);
        } finally {
            setLoading(false);
        }
    };

    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100) : 0;

    return (
        <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-950">
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="px-6 pt-4 pb-2">
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">Analysis</Text>
                </View>

                {/* Period Selector */}
                <View className="flex-row bg-gray-200 dark:bg-gray-800 rounded-2xl p-1 mx-6 mb-6">
                    {(['week', 'month', 'all'] as TimePeriod[]).map((p) => (
                        <TouchableOpacity
                            key={p}
                            onPress={() => setPeriod(p)}
                            className="flex-1 py-3 rounded-xl"
                            style={period === p ? { backgroundColor: theme === 'dark' ? '#374151' : 'white' } : {}}
                        >
                            <Text className={`text-center font-bold ${period === p ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All Time'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Quick Stats Row */}
                <View className="flex-row mx-6 mb-6 gap-3">
                    <View className="flex-1 bg-red-50 dark:bg-red-900/30 p-4 rounded-2xl">
                        <Text className="text-red-600 dark:text-red-400 text-xs font-medium mb-1">SPENT</Text>
                        <Text className="text-red-700 dark:text-red-300 text-xl font-bold">
                            {currency}{totalExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                    <View className="flex-1 bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-2xl">
                        <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-medium mb-1">INCOME</Text>
                        <Text className="text-emerald-700 dark:text-emerald-300 text-xl font-bold">
                            {currency}{totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                    <View className={`flex-1 p-4 rounded-2xl ${netSavings >= 0 ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
                        <Text className={`text-xs font-medium mb-1 ${netSavings >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            {netSavings >= 0 ? 'SAVED' : 'DEFICIT'}
                        </Text>
                        <Text className={`text-xl font-bold ${netSavings >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                            {currency}{Math.abs(netSavings).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                </View>

                {/* Daily Spending Chart */}
                <View className="mx-6 mb-6 bg-white dark:bg-gray-900 p-4 rounded-2xl">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">Daily Spending (Last 7 Days)</Text>
                    <View className="flex-row justify-between items-end h-24">
                        {dailySpending.map((day, index) => {
                            const height = day.maxTotal > 0 ? (day.total / day.maxTotal) * 80 : 0;
                            const isToday = index === dailySpending.length - 1;
                            return (
                                <View key={day.date} className="items-center flex-1">
                                    <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        {day.total > 0 ? `${currency}${(day.total / 1000).toFixed(0)}k` : ''}
                                    </Text>
                                    <View
                                        className={`w-8 rounded-t-lg ${isToday ? 'bg-red-500' : 'bg-red-300 dark:bg-red-700'}`}
                                        style={{ height: Math.max(4, height) }}
                                    />
                                    <Text className={`text-xs mt-1 ${isToday ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {day.day}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                    <View className="flex-row justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <Text className="text-gray-500 dark:text-gray-400 text-sm">Avg. daily spend</Text>
                        <Text className="text-gray-900 dark:text-white font-semibold">
                            {currency}{avgDailySpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/day
                        </Text>
                    </View>
                </View>

                {/* Top Merchants */}
                {topMerchants.length > 0 && (
                    <View className="mx-6 mb-6">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">Where You Spent Most</Text>
                        <View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
                            {topMerchants.map((merchant, index) => (
                                <View
                                    key={index}
                                    className={`flex-row justify-between items-center p-4 ${index < topMerchants.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
                                >
                                    <View className="flex-row items-center flex-1">
                                        <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-3">
                                            <Text className="text-gray-600 dark:text-gray-400 font-bold">{index + 1}</Text>
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-gray-900 dark:text-white font-medium" numberOfLines={1}>
                                                {merchant.merchant}
                                            </Text>
                                            <Text className="text-gray-500 dark:text-gray-400 text-xs">
                                                {merchant.count} transaction{merchant.count !== 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text className="text-gray-900 dark:text-white font-bold">
                                        {currency}{merchant.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Category Breakdown */}
                <View className="mx-6 mb-6">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">Spending by Category</Text>

                    {categoryBreakdown.length === 0 ? (
                        <View className="bg-white dark:bg-gray-900 p-8 rounded-2xl items-center">
                            <Text className="text-5xl mb-3">📊</Text>
                            <Text className="text-gray-500 dark:text-gray-400 text-center">
                                No expenses in this period
                            </Text>
                        </View>
                    ) : (
                        <>
                            {/* Horizontal Bar Chart */}
                            <View className="bg-white dark:bg-gray-900 p-4 rounded-2xl mb-3">
                                <View className="flex-row h-6 rounded-full overflow-hidden">
                                    {categoryBreakdown.map((item, index) => (
                                        <View
                                            key={index}
                                            style={{
                                                width: `${item.percentage}%`,
                                                backgroundColor: item.color,
                                            }}
                                        />
                                    ))}
                                </View>
                            </View>

                            {/* Category List */}
                            {categoryBreakdown.map((item, index) => (
                                <View key={index} className="bg-white dark:bg-gray-900 p-4 rounded-2xl mb-2">
                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-row items-center flex-1">
                                            <View
                                                className="w-3 h-3 rounded-full mr-3"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <Text className="text-2xl mr-2">{item.icon}</Text>
                                            <View className="flex-1">
                                                <Text className="text-gray-900 dark:text-white font-medium">
                                                    {item.category}
                                                </Text>
                                                <Text className="text-gray-500 dark:text-gray-400 text-xs">
                                                    {item.count} txn • {item.percentage.toFixed(0)}%
                                                </Text>
                                            </View>
                                        </View>
                                        <Text className="text-gray-900 dark:text-white font-bold">
                                            {currency}{item.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </>
                    )}
                </View>

                {/* Bottom Padding */}
                <View className="h-8" />
            </ScrollView>
        </SafeAreaView>
    );
}
