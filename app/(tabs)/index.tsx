import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import TransactionList from "../../components/TransactionList";
import { useEffect, useState, useCallback } from "react";
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useCurrency } from '../../context/CurrencyContext';
import { calculateDailyBudget, syncWidgetData } from '../../services/budgetService';
import { useFocusEffect } from 'expo-router';

type DisplayMode = 'daily' | 'monthly';

export default function Home() {
    const router = useRouter();
    const { theme } = useTheme();
    const { currency } = useCurrency();
    const [loading, setLoading] = useState(true);
    const [displayMode, setDisplayMode] = useState<DisplayMode>('daily');
    const [budgetStatus, setBudgetStatus] = useState<any>(null);

    // Refresh when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadBudgetStats(false);
        }, [])
    );

    // Auto-refresh budget every 5 seconds for real-time updates
    useEffect(() => {
        loadBudgetStats(true);
        const interval = setInterval(() => loadBudgetStats(false), 5000);
        return () => clearInterval(interval);
    }, []);

    const loadBudgetStats = async (showLoading = true) => {
        if (showLoading && !budgetStatus) setLoading(true);
        try {
            const status = await calculateDailyBudget();
            setBudgetStatus(status);
            // Keep the home-screen widget in sync on every poll / focus
            syncWidgetData(status, currency);
        } catch (error) {
            console.error('Error loading budget stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleDisplayMode = () => {
        setDisplayMode(prev => prev === 'daily' ? 'monthly' : 'daily');
    };

    const getDisplayAmount = () => {
        if (!budgetStatus) return 0;
        return displayMode === 'daily' ? budgetStatus.dailyLimit : budgetStatus.remainingTotal;
    };

    const getDisplayLabel = () => {
        return displayMode === 'daily' ? 'Safe to Spend Today' : 'Remaining This Month';
    };

    const getSubLabel = () => {
        if (!budgetStatus) return '';
        if (budgetStatus.isOverBudget) return 'Over budget!';
        return displayMode === 'daily'
            ? `${budgetStatus.daysLeft} days left • Month ends ${budgetStatus.periodEnd.toLocaleDateString()}`
            : `Daily avg: ${currency}${Math.round(budgetStatus.dailyLimit).toLocaleString('en-IN')}`;
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
            <View className="flex-1 px-6 pt-2">
                {/* Header */}
                <View className="mb-6 mt-2 flex-row justify-between items-center">
                    <View>
                        <Text className="text-slate-500 dark:text-slate-400 text-base font-medium">Welcome Back 👋</Text>
                        <Text className="text-2xl font-bold text-slate-900 dark:text-white">Spense</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push('/settings')}
                        className="bg-slate-200 dark:bg-slate-800 w-10 h-10 rounded-full items-center justify-center"
                    >
                        <Text className="text-lg">⚙️</Text>
                    </TouchableOpacity>
                </View>

                {/* Main Budget Card */}
                <View
                    style={{
                        borderRadius: 24,
                        backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                        elevation: 10,
                        shadowColor: theme === 'dark' ? '#000' : '#059669',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        marginBottom: 32
                    }}
                >
                    <LinearGradient
                        colors={
                            budgetStatus?.isOverBudget
                                ? ['#dc2626', '#ef4444']
                                : ['#059669', '#10b981', '#34d399']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="p-6"
                        style={{ borderRadius: 24, width: '100%' }}
                    >
                        <TouchableOpacity onPress={toggleDisplayMode} activeOpacity={0.7}>
                            <View className="flex-row items-center mb-2">
                                <Text className="text-emerald-50 font-medium text-sm uppercase tracking-wider">
                                    {getDisplayLabel()}
                                </Text>
                                <View className="bg-white/20 px-2 py-0.5 rounded-full ml-2">
                                    <Text className="text-white text-xs font-semibold">
                                        {displayMode === 'daily' ? 'Daily' : 'Monthly'} ▼
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                        <Text className="text-5xl font-bold text-white mb-2">
                            {currency}{Math.floor(getDisplayAmount()).toLocaleString('en-IN')}
                        </Text>
                        <Text className="text-emerald-50 text-sm">
                            {getSubLabel()}
                        </Text>
                    </LinearGradient>
                </View>

                {/* Recent Transactions */}
                <View className="mb-2 flex-row justify-between items-end">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white ml-2">Recent Activity</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                        <Text className="text-emerald-600 dark:text-emerald-400 font-semibold mb-1">View All</Text>
                    </TouchableOpacity>
                </View>

                {/* Transactions List — onRefresh triggers immediate budget recalc */}
                <TransactionList limit={5} onRefresh={() => loadBudgetStats(false)} />

                {/* Floating Add Button */}
                <TouchableOpacity
                    onPress={() => router.push('/add')}
                    activeOpacity={0.9}
                    className="absolute bottom-8 right-6 w-16 h-16 justify-center items-center"
                    style={{
                        borderRadius: 24,
                        backgroundColor: '#059669',
                        elevation: 8,
                        shadowColor: '#059669',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.4,
                        shadowRadius: 6,
                    }}
                >
                    <LinearGradient
                        colors={['#059669', '#047857']}
                        className="w-full h-full items-center justify-center"
                        style={{ borderRadius: 24, width: '100%', height: '100%' }}
                    >
                        <Text className="text-white text-3xl font-light pb-1">+</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
